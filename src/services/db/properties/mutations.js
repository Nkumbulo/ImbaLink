import { supabase } from '../../../services/supabase';
import { newId } from '../../../services/ids';
import { getMediaRecord, assignOwner, deleteMedia } from '../../../services/media/imageStore';
import { requireUser, requireCurrentUserId } from '../../../services/db/shared/identity';
import { readPublicUserProfiles } from '../../../services/db/shared/publicProfiles';
import { rowToProperty, propertyToRow } from '../../../services/db/properties/mappers';
import { invalidatePropertyCache, readPropertySaveCounts } from './queries';
import { idbGet, idbGetAll, idbPut, idbDelete } from '../../../core/infrastructure/indexeddb';
import { enqueue } from '../../../core/sync/outbox';

// --- Landlord listings ---
// Listings are properties with an owner. Seeded catalog rows have
// owner_user_id NULL, which is what separates the two.
export async function getLandlordListings(userId = null) {
  let query = supabase.from('properties').select('*');
  if (userId) query = query.eq('owner_user_id', String(userId));
  else query = query.not('owner_user_id', 'is', null);
  const { data, error } = await query;
  if (error) {
    const localRows = (await idbGetAll('landlordListings').catch(() => []))
      .filter((r) => String(r.userId || '') === String(userId || r.userId || '') && !r.deleted);
    return localRows.map((r) => rowToProperty(r.row, r.images || [], null)).filter(Boolean);
  }

  const ids = (data || []).map((r) => String(r.id));
  const localRows = (await idbGetAll('landlordListings').catch(() => []))
    .filter((r) => String(r.userId || '') === String(userId || r.userId || '') && !r.deleted);
  const localById = new Map(localRows.map((r) => [String(r.id), r]));
  let byProperty = new Map();
  if (ids.length) {
    const { data: imageRows } = await supabase
      .from('property_images').select('property_id, url, position').in('property_id', ids).order('position');
    for (const img of imageRows || []) {
      const key = String(img.property_id);
      if (!byProperty.has(key)) byProperty.set(key, []);
      byProperty.get(key).push(img.url);
    }
  }
  const [ownerProfiles, saveCounts] = await Promise.all([
    readPublicUserProfiles((data || []).map((r) => r.owner_user_id)),
    readPropertySaveCounts(ids),
  ]);
  const serverProperties = (data || []).map((r) => {
    const property = rowToProperty(r, byProperty.get(String(r.id)) || [], ownerProfiles.get(String(r.owner_user_id)));
    if (property) property.saveCount = saveCounts.get(String(r.id)) || 0;
    return property;
  }).filter(Boolean);
  const localOnly = localRows
    .filter((r) => !serverProperties.some((p) => String(p.id) === String(r.id)))
    .map((r) => rowToProperty(r.row, r.images || [], null)).filter(Boolean);
  return [...serverProperties, ...localOnly];
}

async function uploadListingPhotosFirst({ propertyId, ownerId, mediaIds }) {
  const ids = (mediaIds || []).filter(Boolean).slice(0, 8);
  if (!ids.length) throw new Error('LISTING_PHOTOS_REQUIRED: Add at least one photo before publishing.');

  await assignOwner(ids, propertyId, 'listing');

  // Upload in small parallel batches. Sequentially uploading 8 photos makes
  // the slowest phone/network combination unnecessarily wait for every photo.
  // A bounded pool keeps the browser responsive without opening 8 concurrent
  // Storage requests on mobile data.
  const uploaded = new Array(ids.length);
  const concurrency = Math.min(3, ids.length);
  let nextIndex = 0;

  const uploadOne = async (position) => {
    const record = await getMediaRecord(ids[position]);
    if (!record?.blob) {
      throw new Error(`LISTING_PHOTO_UNAVAILABLE: Photo ${position + 1} is no longer available. Please add it again.`);
    }
    const path = `${ownerId}/${propertyId}/${position}.jpg`;
    const { error } = await supabase.storage
      .from('property-images')
      .upload(path, record.blob, {
        contentType: 'image/jpeg',
        upsert: true,
        cacheControl: '31536000',
      });
    if (error) throw error;

    const { data: publicData } = supabase.storage.from('property-images').getPublicUrl(path);
    if (!publicData?.publicUrl) throw new Error('Supabase did not return a public photo URL.');
    uploaded[position] = {
      path,
      url: publicData.publicUrl,
      position,
      bytes: record.bytes,
      width: record.width,
      height: record.height,
    };
  };

  try {
    await Promise.all(Array.from({ length: concurrency }, async () => {
      while (true) {
        const position = nextIndex++;
        if (position >= ids.length) return;
        await uploadOne(position);
      }
    }));
    return uploaded.filter(Boolean);
  } catch (error) {
    const paths = uploaded.filter(Boolean).map((item) => item.path);
    if (paths.length) await supabase.storage.from('property-images').remove(paths).catch(() => {});
    throw new Error(`LISTING_PHOTO_UPLOAD_FAILED: ${error?.message || 'One or more photos could not be uploaded.'}`);
  }
}

export async function createLandlordListing(input) {
  const ownerId = requireCurrentUserId(input?.userId);
  const id = newId('listing');

  const mediaIds = Array.isArray(input?.mediaIds)
    ? input.mediaIds.filter(Boolean).slice(0, 8)
    : [];

  // The landlord flow is intentionally atomic from the user's perspective:
  // upload the actual image files FIRST, then create the property row.
  // This prevents a published listing from existing with only local data-URL
  // previews while the real photos are still uploading in the background.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('LISTING_PHOTOS_UPLOAD_REQUIRED: Connect to the internet before publishing a listing so its photos can be uploaded first.');
  }
  if (!mediaIds.length) {
    throw new Error('LISTING_PHOTOS_REQUIRED: Add at least one photo before publishing.');
  }

  const uploadedPhotos = await uploadListingPhotosFirst({
    propertyId: id,
    ownerId,
    mediaIds,
  });

  const row = propertyToRow(input, { id, ownerUserId: ownerId });

  try {
    const { data, error } = await supabase.from('properties').insert(row).select();
    if (error) {
      throw new Error(`LISTING_CREATE_FAILED: ${error.message || 'The listing could not be saved.'}`);
    }
    if (!Array.isArray(data) || !data[0]) {
      throw new Error('LISTING_CREATE_FAILED: Supabase did not return the created listing.');
    }

    const imageRows = uploadedPhotos.map((item) => ({
      id: newId('img'),
      property_id: id,
      url: item.url,
      position: item.position,
      bytes: item.bytes,
      width: item.width,
      height: item.height,
    }));

    const { error: imageError } = await supabase
      .from('property_images')
      .insert(imageRows);

    if (imageError) {
      throw new Error(`LISTING_PHOTO_METADATA_FAILED: ${imageError.message || 'Photo metadata could not be saved.'}`);
    }

    const localRecord = {
      id,
      userId: ownerId,
      row: { ...data[0] },
      images: uploadedPhotos.map((item) => item.url),
      updatedAt: new Date().toISOString(),
      pendingSync: false,
      photoUploadFailed: false,
      deleted: false,
    };
    await idbPut('landlordListings', localRecord).catch(() => {});
    await enqueue('listing.create', {
      entityId: id,
      payload: { ...data[0], images: uploadedPhotos.map((item) => item.url) },
      dedupeKey: null,
    }).catch(() => {});

    invalidatePropertyCache();
    const ownerProfiles = await readPublicUserProfiles([ownerId]);
    return rowToProperty(
      data[0],
      uploadedPhotos.map((item) => item.url),
      ownerProfiles.get(ownerId)
    );
  } catch (error) {
    // Do not leave orphaned files or a half-created listing when either the
    // property insert or image metadata insert fails.
    await supabase.storage
      .from('property-images')
      .remove(uploadedPhotos.map((item) => item.path))
      .catch(() => {});

    await supabase.from('property_images').delete().eq('property_id', id).catch(() => {});
    await supabase.from('properties').delete().eq('id', id).eq('owner_user_id', String(ownerId)).catch(() => {});
    await idbDelete('landlordListings', id).catch(() => {});
    invalidatePropertyCache();
    throw error;
  }
}

// Edit an existing listing. Previously missing entirely — createLandlordListing
// and deleteLandlordListing existed, but nothing let a landlord change a
// listing after publishing it (confirmed: no edit UI, no update() call
// anywhere in this file). RLS already had an ownership-scoped UPDATE policy
// (properties_update_own, backend/002-app-alignment.sql) sitting unused.
// Photos: re-derives the full image set from form.images/mediaIds, same as
// create — existing photos come through as already-uploaded https URLs,
// new ones as fresh mediaIds. Simplest correct way to support add / remove
// / reorder in one save without a separate diffing path. Known limitation,
// deliberately not solved here: this replaces the property_images metadata
// rows but does not delete the underlying Storage objects for photos that
// were removed, so a removed photo's file can be left orphaned in Storage
// (a small, non-security cleanup gap, not a data-correctness one).
export async function updateLandlordListing(propertyId, input) {
  const ownerId = requireUser();
  const id = String(propertyId || '');
  if (!id) throw new Error('Listing id is required.');

  const row = propertyToRow(input, { id, ownerUserId: ownerId });
  delete row.id;
  delete row.owner_user_id;
  delete row.published_at; // preserve original publish time; not part of an edit
  delete row.verification; // moderation state is server-owned; edits must not auto-verify/re-submit

  const existingLocal = await idbGet('landlordListings', id).catch(() => null);
  const currentLocalImages = Array.isArray(existingLocal?.images) ? existingLocal.images : [];
  const inputImages = Array.isArray(input?.images) ? input.images.filter(Boolean).slice(0, 8) : currentLocalImages;
  const mediaIds = Array.isArray(input?.mediaIds) ? input.mediaIds.slice(0, 8) : [];

  // Keep the local copy immediately responsive. New photos are represented by
  // their local data URLs until the upload below turns them into remote URLs.
  const localRow = {
    ...(existingLocal?.row || {}),
    ...row,
    id,
    owner_user_id: ownerId,
    updated_at: new Date().toISOString(),
  };
  await idbPut('landlordListings', {
    ...(existingLocal || {}),
    id,
    userId: ownerId,
    row: localRow,
    images: inputImages,
    updatedAt: localRow.updated_at,
    pendingSync: true,
    deleted: false,
  });

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    await enqueue('listing.update', {
      entityId: id,
      payload: { ...row, images: inputImages.filter((url) => /^https?:\/\//i.test(String(url))) },
      dedupeKey: `listing:${id}`,
    });
    invalidatePropertyCache();
    return rowToProperty(localRow, inputImages, null);
  }

  // Listing edits must always hit the authenticated Supabase database.
  // The API/outbox layer may be used for offline reconciliation, but it must
  // never replace the canonical database write when the user is online.


  // Build the final gallery in exactly the order shown in the editor. Existing
  // remote URLs keep their positions; newly-added local media is uploaded into
  // that same position instead of being moved to the front of the gallery.
  const finalPhotos = new Array(inputImages.length);
  const uploadedPaths = [];
  const uploadedMediaIds = [];

  const uploadEditedPhoto = async (position) => {
    const url = String(inputImages[position] || '');
    const mediaId = mediaIds[position] || null;
    if (!mediaId) {
      if (/^https?:\/\//i.test(url)) finalPhotos[position] = { url, bytes: null, width: null, height: null };
      return;
    }

    const record = await getMediaRecord(mediaId);
    if (!record?.blob) {
      throw new Error(`LISTING_PHOTO_UNAVAILABLE: Photo ${position + 1} is no longer available. Please add it again.`);
    }
    const path = `${ownerId}/${id}/${position}-${Date.now()}-${position}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from('property-images')
      .upload(path, record.blob, {
        contentType: 'image/jpeg', upsert: false, cacheControl: '31536000',
      });
    if (uploadError) throw uploadError;

    const { data: publicData } = supabase.storage.from('property-images').getPublicUrl(path);
    if (!publicData?.publicUrl) throw new Error('Supabase did not return a public photo URL.');
    finalPhotos[position] = {
      url: publicData.publicUrl, bytes: record.bytes, width: record.width, height: record.height,
    };
    uploadedPaths.push(path);
    uploadedMediaIds.push(mediaId);
  };

  try {
    const concurrency = Math.min(3, inputImages.length);
    let nextIndex = 0;
    await Promise.all(Array.from({ length: concurrency }, async () => {
      while (true) {
        const position = nextIndex++;
        if (position >= inputImages.length) return;
        await uploadEditedPhoto(position);
      }
    }));
  } catch (uploadError) {
    await supabase.storage.from('property-images').remove(uploadedPaths).catch(() => {});
    throw new Error(`LISTING_PHOTO_UPLOAD_FAILED: ${uploadError?.message || 'The photo could not be uploaded.'}`);
  }

  const resolvedPhotos = finalPhotos.filter(Boolean).slice(0, 8);
  if (!resolvedPhotos.length) throw new Error('LISTING_PHOTOS_REQUIRED: Add at least one photo before saving.');

  // Replace only the metadata rows. The underlying Storage objects for removed
  // photos are intentionally cleaned up below after the new gallery is known.
  const { data: oldImageRows } = await supabase
    .from('property_images')
    .select('url, position')
    .eq('property_id', id);

  const { error: deleteImageError } = await supabase
    .from('property_images')
    .delete()
    .eq('property_id', id);
  if (deleteImageError) {
    await supabase.storage.from('property-images').remove(uploadedPaths).catch(() => {});
    throw new Error(`LISTING_PHOTO_METADATA_FAILED: ${deleteImageError.message}`);
  }

  const imageRows = resolvedPhotos.map((item, position) => ({
    id: newId('img'),
    property_id: id,
    url: item.url,
    position,
    bytes: item.bytes,
    width: item.width,
    height: item.height,
  }));
  const { error: imageError } = await supabase.from('property_images').insert(imageRows);
  if (imageError) {
    // Restore the previous metadata if the replacement failed.
    await supabase.from('property_images').delete().eq('property_id', id).catch(() => {});
    if (oldImageRows?.length) {
      await supabase.from('property_images').insert(oldImageRows.map((item, index) => ({
        id: newId('img'), property_id: id, url: item.url, position: item.position ?? index,
      }))).catch(() => {});
    }
    await supabase.storage.from('property-images').remove(uploadedPaths).catch(() => {});
    throw new Error(`LISTING_PHOTO_METADATA_FAILED: ${imageError.message || 'Photo metadata could not be saved.'}`);
  }

  // Only commit the property fields after the complete gallery is ready. If
  // this database update fails, the old property fields and old gallery are
  // restored instead of leaving a half-edited listing behind.
  const { data, error } = await supabase
    .from('properties')
    .update(row)
    .eq('id', id)
    .eq('owner_user_id', String(ownerId))
    .select();
  if (error || !data?.length) {
    await supabase.from('property_images').delete().eq('property_id', id).catch(() => {});
    if (oldImageRows?.length) {
      await supabase.from('property_images').insert(oldImageRows.map((item, index) => ({
        id: newId('img'), property_id: id, url: item.url, position: item.position ?? index,
      }))).catch(() => {});
    }
    await supabase.storage.from('property-images').remove(uploadedPaths).catch(() => {});
    if (error) throw new Error(`LISTING_UPDATE_FAILED: ${error.message || 'The listing could not be updated.'}`);
    throw new Error('LISTING_UPDATE_NOT_AUTHORIZED: This listing does not belong to your account.');
  }

  // Remove old ImbaLink Storage objects that are no longer part of the gallery.
  // Keep external/seed URLs untouched. Current listing uploads are stored under
  // ownerId/listingId/, so only delete objects belonging to this listing.
  const keepUrls = new Set(resolvedPhotos.map((item) => item.url));
  const oldPaths = (oldImageRows || [])
    .map((item) => {
      const url = String(item?.url || '');
      if (keepUrls.has(url)) return null;
      try {
        const parsed = new URL(url);
        const marker = '/storage/v1/object/public/property-images/';
        const index = parsed.pathname.indexOf(marker);
        if (index < 0) return null;
        const objectPath = decodeURIComponent(parsed.pathname.slice(index + marker.length));
        return objectPath.startsWith(`${ownerId}/${id}/`) ? objectPath : null;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  if (oldPaths.length) await supabase.storage.from('property-images').remove(oldPaths).catch(() => {});

  for (const mediaId of uploadedMediaIds) await deleteMedia(mediaId);

  const finalUrls = resolvedPhotos.map((item) => item.url);
  const finalLocalRow = { ...data[0] };
  await idbPut('landlordListings', {
    ...(existingLocal || {}),
    id,
    userId: ownerId,
    row: finalLocalRow,
    images: finalUrls,
    updatedAt: new Date().toISOString(),
    pendingSync: false,
    photoUploadFailed: false,
    deleted: false,
  }).catch(() => {});

  // Supabase is already the canonical write. If the optional API gateway is
  // configured, queue the successful mutation only as a reconciliation intent;
  // Save Changes must never depend on that gateway being reachable.
  if (import.meta.env?.VITE_API_BASE_URL) {
    await enqueue('listing.update', {
      entityId: id,
      payload: { ...row, images: finalUrls },
      dedupeKey: `listing:${id}`,
    });
  }

  invalidatePropertyCache();
  const ownerProfiles = await readPublicUserProfiles([ownerId]);
  return rowToProperty(data[0], finalUrls, ownerProfiles.get(ownerId));
}

export async function toggleLandlordListingPause(propertyId, paused) {
  const ownerId = requireUser();
  const id = String(propertyId || '');
  if (!id) throw new Error('Listing id is required.');
  const isPaused = Boolean(paused);

  const { data, error } = await supabase
    .from('properties')
    .update({ is_paused: isPaused })
    .eq('id', id)
    .eq('owner_user_id', String(ownerId))
    .select()
    .single();

  if (error) throw new Error(`LISTING_PAUSE_UPDATE_FAILED: ${error.message || 'The listing status could not be updated.'}`);
  if (!data) throw new Error('LISTING_UPDATE_NOT_AUTHORIZED: This listing does not belong to your account.');

  const existingLocal = await idbGet('landlordListings', id).catch(() => null);
  if (existingLocal) {
    await idbPut('landlordListings', {
      ...existingLocal,
      row: { ...(existingLocal.row || {}), ...data },
      updatedAt: new Date().toISOString(),
    }).catch(() => {});
  }

  invalidatePropertyCache();
  const ownerProfiles = await readPublicUserProfiles([ownerId]);
  return rowToProperty(data, existingLocal?.images || [], ownerProfiles.get(ownerId));
}

export async function deleteLandlordListing(propertyId) {
  const ownerId = requireUser();
  const id = String(propertyId || '');
  if (!id) throw new Error('Listing id is required.');

  await idbDelete('landlordListings', id).catch(() => {});
  await enqueue('listing.delete', { entityId: id, payload: null, dedupeKey: `listing-delete:${id}` });
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    invalidatePropertyCache();
    return id;
  }

  // Remove listing photos from Storage first. The database cascade below
  // removes their metadata rows; Storage objects need an explicit cleanup.
  const { data: imageRows } = await supabase
    .from('property_images')
    .select('position')
    .eq('property_id', id);
  const storagePaths = (imageRows || [])
    .map((row) => `${ownerId}/${id}/${Number(row.position) || 0}.jpg`)
    .filter(Boolean);
  if (storagePaths.length) {
    const { error: storageError } = await supabase.storage
      .from('property-images')
      .remove(storagePaths);
    if (storageError) console.warn('Listing photo cleanup failed:', storageError.message);
  }

  const { error } = await supabase
    .from('properties')
    .delete()
    .eq('id', id)
    .eq('owner_user_id', String(ownerId));
  if (error) console.warn('Listing delete sync failed:', error.message);

  invalidatePropertyCache();
  return id;
}
