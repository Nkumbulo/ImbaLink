import { supabase } from '../../../../services/supabase';
import { now } from '../shared/helpers';
import { readPublicUserProfiles } from '../shared/publicProfiles';
import { applyFilters, rowToProperty } from './mappers';

// Cache state lives here, alongside the query functions that read AND write
// it (subscribeToPropertyFeed patches it in place on realtime events;
// _ensureData/getProperties populate it). Splitting the state into its own
// module would mean every read/write here going through getter/setter
// indirection for no real benefit — cohesion matters more than atomization
// for state this tightly coupled to its readers.
const PROPERTY_CACHE_TTL_MS = 30_000;
const PROPERTY_PAGE_CACHE = new Map();
let ALL_DATA = null;
let ALL_DATA_CACHED_AT = 0;

// Exposed for db/account.js (clearCache/setActiveUser both need to
// invalidate this on sign-out/account-switch) and for the mutation
// functions in ./mutations.js (create/update/delete all invalidate the
// same cache after writing).
export function invalidatePropertyCache() {
  ALL_DATA = null;
  PROPERTY_PAGE_CACHE.clear();
}

export async function readPropertySaveCounts(propertyIds) {
  const ids = Array.from(new Set((propertyIds || []).filter((id) => id != null).map((id) => String(id))));
  const result = new Map(ids.map((id) => [id, 0]));
  if (!ids.length) return result;

  // Use a SECURITY DEFINER aggregate so the count includes every user's save,
  // while RLS still prevents users from reading individual save rows.
  const { data, error } = await supabase.rpc('get_property_save_counts', { property_ids: ids });
  if (!error && Array.isArray(data)) {
    for (const row of data) result.set(String(row.property_id), Math.max(0, Number(row.save_count) || 0));
    return result;
  }

  // If the aggregate RPC is unavailable, only the current user's own row is
  // visible under RLS. Do NOT pretend that one visible row is the global count.
  // Returning 0 is more honest than showing an incorrect number.
  return result;
}

export async function readSinglePropertySaveCount(propertyId) {
  const id = String(propertyId);
  const { data, error } = await supabase.rpc('get_property_save_count', { p_property_id: id });
  if (!error && data != null) return Math.max(0, Number(data) || 0);
  const counts = await readPropertySaveCounts([id]);
  return counts.get(id) || 0;
}

// Live feed updates: keep one Realtime channel per browser tab instead of
// polling the database. Consumers receive normalized property records for
// INSERT/UPDATE/DELETE and can update their visible feed immediately.
export function subscribeToPropertyFeed(onChange) {
  if (typeof onChange !== 'function') return () => {};

  const channel = supabase
    .channel('imbalink-properties-feed')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'properties' },
      async (payload) => {
        const eventType = payload?.eventType;
        const row = payload?.new || payload?.old;
        const id = row?.id == null ? null : String(row.id);
        if (!id) return;

        if (eventType === 'DELETE') {
          ALL_DATA = Array.isArray(ALL_DATA)
            ? ALL_DATA.filter((p) => String(p.id) !== id)
            : ALL_DATA;
          PROPERTY_PAGE_CACHE.clear();
          onChange({ eventType, propertyId: id, property: null });
          return;
        }

        // A properties INSERT/UPDATE realtime event can arrive before the
        // property_images INSERT events. Never replace a listing's gallery
        // with [] just because the property row arrived first. Re-read the
        // gallery as part of the property event so the public feed always
        // keeps the landlord's real photos after navigation/re-rendering.
        const [ownerProfiles, saveCounts, imageResult] = await Promise.all([
          readPublicUserProfiles([row.owner_user_id]),
          readPropertySaveCounts([id]),
          supabase
            .from('property_images')
            .select('url, position')
            .eq('property_id', id)
            .order('position'),
        ]);
        const images = !imageResult.error && Array.isArray(imageResult.data)
          ? imageResult.data.map((image) => image.url).filter(Boolean).slice(0, 8)
          : [];
        const property = rowToProperty(row, images, ownerProfiles.get(String(row.owner_user_id)));
        if (property) property.saveCount = saveCounts.get(id) || 0;
        if (!property) return;

        if (Array.isArray(ALL_DATA)) {
          const index = ALL_DATA.findIndex((p) => String(p.id) === id);
          if (index >= 0) ALL_DATA[index] = property;
          else ALL_DATA.unshift(property);
          ALL_DATA_CACHED_AT = now();
        }
        PROPERTY_PAGE_CACHE.clear();
        onChange({ eventType, propertyId: id, property });
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'property_saves' },
      async (payload) => {
        const row = payload?.new || payload?.old;
        const propertyId = row?.property_id == null ? null : String(row.property_id);
        if (!propertyId) return;

        const counts = await readPropertySaveCounts([propertyId]);
        const saveCount = counts.get(propertyId) || 0;

        if (Array.isArray(ALL_DATA)) {
          ALL_DATA = ALL_DATA.map((p) => String(p.id) === propertyId ? { ...p, saveCount } : p);
        }
        PROPERTY_PAGE_CACHE.clear();
        onChange({ eventType: 'SAVE_COUNT', propertyId, saveCount });
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'property_images' },
      async (payload) => {
        const row = payload?.new || payload?.old;
        const propertyId = row?.property_id == null ? null : String(row.property_id);
        if (!propertyId) return;

        // A listing can have up to 8 photos. Realtime must update the whole
        // gallery, not just position 0; otherwise every later photo replaces
        // the previous one and the UI appears to have only one image.
        const { data: imageRows, error } = await supabase
          .from('property_images')
          .select('url, position')
          .eq('property_id', propertyId)
          .order('position');
        const images = !error && Array.isArray(imageRows)
          ? imageRows.map((image) => image.url).filter(Boolean).slice(0, 8)
          : [];

        if (Array.isArray(ALL_DATA)) {
          const property = ALL_DATA.find((p) => String(p.id) === propertyId);
          if (property) property.images = images;
        }
        PROPERTY_PAGE_CACHE.clear();
        onChange({
          eventType: payload?.eventType === 'DELETE' ? 'IMAGE_DELETE' : 'IMAGE_UPSERT',
          propertyId,
          imageUrl: images[0] || null,
          images,
        });
      }
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn(`ImbaLink property realtime ${status.toLowerCase()}`);
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function _ensureData() {
  // TTL, not "cache forever": without this, a browser tab that loaded
  // _ensureData() once (the fallback path used when
  // properties_with_meta/properties_feed haven't been created on this
  // Supabase project yet) would never see a NEW listing from anyone
  // else for the rest of that tab's session unless the realtime
  // subscription in subscribeToPropertyFeed() happens to be live and
  // firing — and realtime only patches this cache in place, it never
  // re-fetches it, so if the realtime publication for `properties`
  // (backend/005-realtime-feed.sql) was never actually run on this
  // project, a newly published listing would be permanently invisible
  // to every other already-open tab, while the landlord who created it
  // still sees it immediately via their own separate
  // getLandlordListings() merge in useDatabase.js — which is exactly
  // the "it shows for me but not for everyone else" shape of this bug.
  // Reusing the same TTL getProperties()'s own page cache already uses
  // means this self-heals within 30s regardless of realtime's state,
  // instead of requiring a full page reload.
  if (ALL_DATA && (now() - ALL_DATA_CACHED_AT) < PROPERTY_CACHE_TTL_MS) return ALL_DATA;

  // Fast path: properties_with_meta (backend/010-properties-with-meta-view.sql)
  // pre-joins owner profile info and save counts server-side, so this is
  // ONE round trip instead of "fetch properties, then — only once that
  // comes back, since it needs each row's id/owner_user_id — fetch
  // owner profiles and save counts separately." That second, dependent
  // round trip was the main cost behind a slow "Connecting spaces"
  // splash on a slower connection. Falls back to the original two-step
  // fetch if that view hasn't been created yet on this Supabase project,
  // so this never hard-fails a deployment that hasn't run the migration.
  // Run alongside (not after) the images query — the two are unrelated,
  // so there's no reason for one to wait on the other.
  const [fast, imagesRes] = await Promise.all([
    supabase
      .from('properties_with_meta')
      .select('*')
      .then(
        (res) => res,
        (err) => ({ data: null, error: err })
      ),
    // Image metadata is tiny (URL + position); fetching all image rows here
    // does NOT download the actual image files. The browser still lazy-loads
    // gallery images, so users can see all photos without repeatedly querying
    // the database when they open a listing.
    supabase.from('property_images').select('property_id, url, position').order('property_id').order('position'),
  ]);
  const imageRows = imagesRes?.data;

  const byProperty = new Map();
  for (const img of imageRows || []) {
    const key = String(img.property_id);
    if (!byProperty.has(key)) byProperty.set(key, []);
    byProperty.get(key).push(img.url);
  }

  if (!fast.error && Array.isArray(fast.data)) {
    ALL_DATA = fast.data
      .map((row) => {
        const property = rowToProperty(row, byProperty.get(String(row.id)) || [], { avatar_url: row.avatar_url });
        if (property) property.saveCount = Number(row.save_count) || 0;
        return property;
      })
      .filter(Boolean);
    ALL_DATA_CACHED_AT = now();
    return ALL_DATA;
  }

  // Fallback: the view doesn't exist yet on this project. Same result,
  // just the original two-sequential-round-trips path.
  const { data: rows, error } = await supabase.from('properties').select('*');
  if (error) throw error;

  const propertyIds = (rows || []).map((row) => row.id);
  const [ownerProfiles, saveCounts] = await Promise.all([
    readPublicUserProfiles((rows || []).map((row) => row.owner_user_id)),
    readPropertySaveCounts(propertyIds),
  ]);
  ALL_DATA = (rows || [])
    .map((row) => {
      const property = rowToProperty(row, byProperty.get(String(row.id)) || [], ownerProfiles.get(String(row.owner_user_id)));
      if (property) property.saveCount = saveCounts.get(String(row.id)) || 0;
      return property;
    })
    .filter(Boolean);
  ALL_DATA_CACHED_AT = now();
  return ALL_DATA;
}

export async function getProperties({ page = 1, limit = 24, ...filters } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 24));
  const normalizedFilters = {
    city: filters.city || 'All',
    suburb: filters.suburb || 'All',
    type: filters.type || 'All',
    minPrice: Number.isFinite(Number(filters.minPrice)) ? Number(filters.minPrice) : null,
    maxPrice: Number.isFinite(Number(filters.maxPrice)) ? Number(filters.maxPrice) : null,
    verifiedOnly: Boolean(filters.verifiedOnly),
    query: typeof filters.query === 'string' ? filters.query.trim().toLowerCase() : '',
  };
  const cacheKey = JSON.stringify([safePage, safeLimit, normalizedFilters]);
  const cached = PROPERTY_PAGE_CACHE.get(cacheKey);
  if (cached && (now() - cached.cachedAt) < PROPERTY_CACHE_TTL_MS) {
    return { ...cached.value, data: cached.value.data.map((p) => ({ ...p })) };
  }

  // Real server-side pagination and filtering — this is the actual fix
  // for a feed that stays fast regardless of how many listings exist.
  // The old approach loaded the ENTIRE properties table into memory on
  // first load, every time, and only filtered/sliced it down to one
  // page in JavaScript afterward — so load time scaled with the total
  // number of listings ever created, not with the 24 someone's about to
  // see. This is the same shape every large listing feed (Marketplace,
  // Airbnb, etc.) actually uses: push filtering and LIMIT/OFFSET into
  // the database query itself, and only fetch one cover photo per card
  // (see properties_feed in backend/010-properties-with-meta-view.sql)
  // instead of every photo of every listing just to render thumbnails.
  let query = supabase.from('properties_feed').select('*', { count: 'exact' });
  if (normalizedFilters.city !== 'All') query = query.eq('city', normalizedFilters.city);
  if (normalizedFilters.suburb !== 'All') query = query.eq('suburb', normalizedFilters.suburb);
  if (normalizedFilters.type !== 'All') query = query.eq('property_type', normalizedFilters.type);
  if (normalizedFilters.minPrice != null) query = query.gte('rent_usd', normalizedFilters.minPrice);
  if (normalizedFilters.maxPrice != null) query = query.lte('rent_usd', normalizedFilters.maxPrice);
  if (normalizedFilters.verifiedOnly) query = query.eq('verification', 'verified');
  if (normalizedFilters.query) {
    // Strip characters that are structurally meaningful to PostgREST's
    // .or() filter syntax (comma separates conditions, parens group
    // them, quotes/periods have their own meaning) — none of those are
    // meaningful in a free-text search phrase anyway. Then escape SQL
    // LIKE wildcards so a literal "%" or "_" in someone's search isn't
    // treated as a wildcard.
    const q = normalizedFilters.query
      .replace(/[,()."'\\]/g, '')
      .replace(/[%_]/g, (c) => `\\${c}`);
    if (q) {
      query = query.or(
        `title.ilike.%${q}%,suburb.ilike.%${q}%,property_type.ilike.%${q}%,landlord_name.ilike.%${q}%`
      );
    }
  }
  const start = (safePage - 1) * safeLimit;
  query = query.order('created_at', { ascending: false }).range(start, start + safeLimit - 1);

  const { data, error, count } = await query;

  if (!error) {
    // The feed query intentionally uses the lightweight cover-image view,
    // but the client-side property object should still know the complete
    // public gallery. Fetch the tiny property_images metadata for ONLY this
    // page of listings (not the whole database), then every consumer has a
    // stable all-images property object when the user opens a listing and
    // when they navigate back to Home.
    const pageIds = (data || []).map((row) => String(row.id));
    const { data: pageImageRows } = pageIds.length
      ? await supabase
          .from('property_images')
          .select('property_id, url, position')
          .in('property_id', pageIds)
          .order('position')
      : { data: [] };
    const imagesByProperty = new Map();
    for (const image of pageImageRows || []) {
      const key = String(image.property_id);
      if (!imagesByProperty.has(key)) imagesByProperty.set(key, []);
      imagesByProperty.get(key).push(image.url);
    }

    const chunk = (data || [])
      .map((row) => {
        const images = imagesByProperty.get(String(row.id)) ||
          (row.cover_image_url ? [row.cover_image_url] : []);
        const property = rowToProperty(row, images.slice(0, 8), { avatar_url: row.avatar_url });
        if (property) property.saveCount = Number(row.save_count) || 0;
        return property;
      })
      .filter(Boolean);
    const total = typeof count === 'number' ? count : start + chunk.length;
    const value = {
      data: chunk,
      total,
      page: safePage,
      limit: safeLimit,
      hasMore: start + safeLimit < total,
    };
    PROPERTY_PAGE_CACHE.set(cacheKey, { cachedAt: now(), value });
    if (PROPERTY_PAGE_CACHE.size > 100) {
      const oldestKey = PROPERTY_PAGE_CACHE.keys().next().value;
      if (oldestKey !== undefined) PROPERTY_PAGE_CACHE.delete(oldestKey);
    }
    return { ...value, data: value.data.map((p) => ({ ...p })) };
  }

  // Fallback: properties_feed doesn't exist yet on this project. Same
  // result, just the original fetch-everything-then-filter-in-JS path.
  const all = await _ensureData();
  const filtered = applyFilters(all, normalizedFilters);
  const chunk = filtered.slice(start, start + safeLimit);
  const value = {
    data: chunk,
    total: filtered.length,
    page: safePage,
    limit: safeLimit,
    hasMore: start + safeLimit < filtered.length,
  };
  PROPERTY_PAGE_CACHE.set(cacheKey, { cachedAt: now(), value });
  if (PROPERTY_PAGE_CACHE.size > 100) {
    const oldestKey = PROPERTY_PAGE_CACHE.keys().next().value;
    if (oldestKey !== undefined) PROPERTY_PAGE_CACHE.delete(oldestKey);
  }
  return { ...value, data: value.data.map((p) => ({ ...p })) };
}

// Similar properties — same suburb + type first, broadening to city + type
// if there aren't enough results, always excluding the listing itself.
// Previously entirely absent (P8's "Similar properties" checklist item).
// Reuses properties_feed (single cover photo per card, same as the main
// feed) rather than fetching full galleries for listings nobody has
// opened yet — this is a browse-and-glance list, not a detail view.
export async function getSimilarProperties(property, limit = 6) {
  if (!property?.id) return [];
  const excludeId = String(property.id);
  const safeLimit = Math.min(12, Math.max(1, Number(limit) || 6));

  const runQuery = async (scope) => {
    let query = supabase.from('properties_feed').select('*').neq('id', excludeId).limit(safeLimit);
    if (scope === 'suburb') query = query.eq('suburb', property.suburb).eq('property_type', property.type);
    else if (scope === 'city') query = query.eq('city', property.city).eq('property_type', property.type);
    else if (scope === 'city-any-type') query = query.eq('city', property.city);
    // scope === 'broadest': no filter at all beyond excluding this listing
    query = query.order('created_at', { ascending: false });
    const { data, error } = await query;
    return error ? null : (data || []);
  };

  let rows = await runQuery('suburb');
  if (rows === null) {
    // properties_feed doesn't exist on this project yet — fall back to
    // filtering the already-loaded full set instead of a second query
    // shape, same fallback pattern as getProperties()/getPropertyById().
    const all = await _ensureData();
    const sameType = all.filter((p) => String(p.id) !== excludeId && p.type === property.type);
    const bySuburb = sameType.filter((p) => p.suburb === property.suburb);
    const pool = bySuburb.length >= 3 ? bySuburb : sameType.filter((p) => p.city === property.city);
    return pool.slice(0, safeLimit);
  }
  if (rows.length < 3) {
    const broader = await runQuery('city');
    if (broader && broader.length > rows.length) rows = broader;
  }
  if (rows.length < 3) {
    const broadest = await runQuery('broadest');
    if (broadest && broadest.length > rows.length) rows = broadest;
  }

  return rows
    .map((row) => rowToProperty(row, row.cover_image_url ? [row.cover_image_url] : [], { avatar_url: row.avatar_url }))
    .filter(Boolean);
}

export async function getPropertyById(id) {
  // Direct single-row lookup instead of loading every property in the
  // database into memory just to find one by id — the same "query only
  // what's needed" fix as getProperties() above, applied here too.
  const { data: row, error } = await supabase
    .from('properties_with_meta')
    .select('*')
    .eq('id', String(id))
    .maybeSingle();

  let property = null;
  if (!error && row) {
    property = rowToProperty(row, [], { avatar_url: row.avatar_url });
    if (property) property.saveCount = Number(row.save_count) || 0;
  } else {
    // Fallback: properties_with_meta doesn't exist yet on this project.
    const all = await _ensureData();
    property = all.find((p) => String(p.id) === String(id)) || null;
  }
  if (!property) return null;

  // Only when a user opens the listing do we fetch the full gallery.
  // Search/home cards deliberately carry only position 0 (see
  // properties_feed's cover_image_url in getProperties() above).
  const { data: imageRows, error: imageError } = await supabase
    .from('property_images')
    .select('url, position')
    .eq('property_id', String(id))
    .order('position');
  if (!imageError && Array.isArray(imageRows) && imageRows.length) {
    property.images = imageRows.map((row) => row.url).filter(Boolean).slice(0, 8);
  }
  return property;
}

// Batch fetch specific properties by id, independent of the main feed's
// pagination/city/filter state. Needed for Favorites/Saved: that page
// used to just filter the already-loaded `properties` array by saved id,
// which silently dropped a saved listing the moment it fell outside
// whatever page/city/filter the main feed happened to have loaded —
// not just genuinely deleted listings, ANY saved listing outside the
// current feed window vanished from Favorites with no explanation.
// Returns { found: Property[], missingIds: string[] } so the caller can
// show "no longer available" for ids that don't resolve to a real row,
// instead of just quietly omitting them.
export async function getPropertiesByIds(ids) {
  const wanted = [...new Set((ids || []).map((id) => String(id)).filter(Boolean))];
  if (!wanted.length) return { found: [], missingIds: [] };

  const { data: rows, error } = await supabase
    .from('properties_with_meta')
    .select('*')
    .in('id', wanted);

  let sourceRows = rows;
  if (error) {
    // Same fallback as getPropertyById: properties_with_meta may not be
    // installed on this project yet.
    const all = await _ensureData();
    sourceRows = null;
    const found = all.filter((p) => wanted.includes(String(p.id)));
    const foundIds = new Set(found.map((p) => String(p.id)));
    return { found, missingIds: wanted.filter((id) => !foundIds.has(id)) };
  }

  const ownerIds = (sourceRows || []).map((r) => r.owner_user_id).filter(Boolean);
  const ownerProfiles = ownerIds.length ? await readPublicUserProfiles(ownerIds) : new Map();
  const propertyIds = (sourceRows || []).map((r) => String(r.id));
  const imagesByProperty = new Map();
  if (propertyIds.length) {
    const { data: imageRows } = await supabase
      .from('property_images').select('property_id, url, position').in('property_id', propertyIds).order('position');
    for (const img of imageRows || []) {
      const key = String(img.property_id);
      if (!imagesByProperty.has(key)) imagesByProperty.set(key, []);
      imagesByProperty.get(key).push(img.url);
    }
  }

  const found = (sourceRows || []).map((row) => {
    const property = rowToProperty(row, imagesByProperty.get(String(row.id)) || [], ownerProfiles.get(String(row.owner_user_id)));
    if (property) property.saveCount = Number(row.save_count) || 0;
    return property;
  }).filter(Boolean);

  const foundIds = new Set(found.map((p) => String(p.id)));
  const missingIds = wanted.filter((id) => !foundIds.has(id));
  return { found, missingIds };
}
