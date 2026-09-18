/**
 * Background photo upload for landlord listings.
 *
 * createLandlordListing() used to upload every photo to Supabase Storage
 * and insert the property_images rows all inline, before returning — so
 * the whole "Submit listing" call, and the modal staying open behind it,
 * was gated on however long photo upload took (and any failure there
 * deleted the just-created property outright). This module splits photo
 * upload out into its own tracked, retryable background job so listing
 * creation itself can return the moment the property row exists.
 *
 * State lives in a module-level Map (not React state) because the upload
 * has to keep running and be retryable regardless of which component (if
 * any) is mounted to show it — the dashboard can unmount/remount, or the
 * listing can be created from a component that closes immediately, and
 * the upload must not be tied to that lifecycle.
 */
import { backend } from '../../application/backend';
import { newId } from '../ids';
import { getMediaRecord, assignOwner } from './imageStore';
import { idbGet, idbGetAll, idbPut } from '../../core/infrastructure/indexeddb';
import { supabase } from '../supabase';

// propertyId -> { status: 'uploading'|'done'|'failed', total, done, error }
const STATUS = new Map();
const LISTENERS = new Set();

function emit() {
  for (const fn of LISTENERS) {
    try { fn(new Map(STATUS)); } catch { /* listener errors are not this module's problem */ }
  }
}

function setStatus(propertyId, patch) {
  const id = String(propertyId);
  const current = STATUS.get(id) || { status: 'uploading', total: 0, done: 0, error: null };
  STATUS.set(id, { ...current, ...patch });
  emit();
}

export function subscribeUploadStatus(fn) {
  LISTENERS.add(fn);
  fn(new Map(STATUS));
  return () => LISTENERS.delete(fn);
}

export function getUploadStatus(propertyId) {
  return STATUS.get(String(propertyId)) || null;
}

export function clearUploadStatus(propertyId) {
  STATUS.delete(String(propertyId));
  emit();
}

// The actual upload work, shared by the initial attempt and every retry.
async function runUpload(propertyId, ownerId, mediaIds) {
  const id = String(propertyId);
  const ids = (mediaIds || []).filter(Boolean).slice(0, 8);
  setStatus(id, { status: 'uploading', total: ids.length, done: 0, error: null });

  if (!ids.length) {
    setStatus(id, { status: 'done' });
    return;
  }

  try {
    await assignOwner(ids, id, 'listing');
    const uploadedUrls = [];

    for (let position = 0; position < ids.length; position += 1) {
      const record = await getMediaRecord(ids[position]);
      if (!record?.blob) {
        // Photo no longer available locally (e.g. cache evicted) — skip it
        // rather than failing the whole listing over one missing photo.
        setStatus(id, { done: position + 1 });
        continue;
      }
      const path = `${ownerId}/${id}/${position}.jpg`;
      await backend.storage.upload('property-images', path, record.blob, { contentType: 'image/jpeg', upsert: true, cacheControl: '31536000' });

      const publicUrl = backend.storage.getUrl('property-images', path);
      if (!publicUrl) throw new Error('Storage did not return a public photo URL.');

      uploadedUrls.push({
        url: publicUrl, position,
        bytes: record.bytes, width: record.width, height: record.height,
      });
      setStatus(id, { done: position + 1 });
    }

    if (uploadedUrls.length) {
      const imageRows = uploadedUrls.map((item) => ({
        id: newId('img'), property_id: id, url: item.url, position: item.position,
        bytes: item.bytes, width: item.width, height: item.height,
      }));
      const { error: imageError } = await supabase.from('property_images').insert(imageRows);
      if (imageError) throw imageError;
    }

    // Mark the local cached listing as fully synced now that its photos
    // are actually uploaded, so a later background sync pass doesn't
    // re-attempt them.
    const local = await idbGet('landlordListings', id).catch(() => null);
    if (local) await idbPut('landlordListings', { ...local, pendingSync: false, photoUploadFailed: false });

    setStatus(id, { status: 'done' });
  } catch (error) {
    const local = await idbGet('landlordListings', id).catch(() => null);
    if (local) await idbPut('landlordListings', { ...local, photoUploadFailed: true });
    setStatus(id, { status: 'failed', error: error?.message || 'Photo upload failed.' });
  }
}

/**
 * Kick off (or re-kick, for retry) the background upload for a listing.
 * Fire-and-forget by design — callers do not await this; use
 * subscribeUploadStatus()/getUploadStatus() to observe progress.
 */
export function uploadListingPhotosInBackground(propertyId, ownerId, mediaIds) {
  void runUpload(propertyId, ownerId, mediaIds);
}

// Retry doesn't require the caller to still be holding the original
// mediaIds (the component that submitted the listing may be long gone) —
// the first upload attempt already tagged every media record's ownerId
// with the property id via assignOwner(), so we can reconstruct the list
// from IndexedDB directly.
export async function getStoredMediaIdsForListing(propertyId) {
  try {
    const rows = await idbGetAll('media');
    return (rows || [])
      .filter((r) => r && r.ownerType === 'listing' && String(r.ownerId || '') === String(propertyId))
      .map((r) => r.id);
  } catch {
    return [];
  }
}

export async function retryListingPhotoUpload(propertyId, ownerId) {
  const mediaIds = await getStoredMediaIdsForListing(propertyId);
  uploadListingPhotosInBackground(propertyId, ownerId, mediaIds);
}
