export const interestCount = (id) => 9 + ((id * 37) % 61);
export function photosFor(id, width = 900, height = 1125){
  const w = Number.isFinite(Number(width)) ? Math.max(160, Math.round(Number(width))) : 900;
  const h = Number.isFinite(Number(height)) ? Math.max(160, Math.round(Number(height))) : 1125;
  return [1,2,3].map(n => `https://picsum.photos/seed/harare-rent-${id}-${n}/${w}/${h}`);
}

// Sentinel used in place of a real image URL when a real (owner-created)
// listing has no photos yet — either because they haven't uploaded any, or
// because the upload is still in progress / failed. Consumers must check
// for this before rendering an <img>; it is never a fetchable URL.
export const PHOTO_PENDING = "__photo_pending__";

// `photosFor()` (random picsum stock photos, seeded off the property id) is
// meant only as filler for the seeded demo catalog, which has no owner and
// therefore no real photos to show. Applying that same fallback to a real
// landlord-created listing means a stranger's random stock photo shows up
// in place of the landlord's own house whenever their upload hasn't
// finished (or failed) — misleading, since it looks like a real photo of
// the property. Real listings (`ownerUserId` set) get the pending sentinel
// instead so the UI can show an honest "photo uploading" / "no photo yet"
// placeholder.
export function getDisplayPhotos(p, width, height) {
  if (Array.isArray(p?.images) && p.images.length > 0) return p.images;
  if (p?.ownerUserId) return [PHOTO_PENDING];
  return photosFor(p?.id, width, height);
}

export const normalizeCity = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

export function getCityProperties(properties, city) {
  const list = Array.isArray(properties) ? properties : [];
  if (city === "All") return list;
  const target = normalizeCity(city);
  return list.filter((p) => normalizeCity(p?.city) === target);
}

export function getPropertyTypes(cityProperties) {
  const values = (cityProperties || [])
    .map((p) => p?.type || p?.propertyType || p?.category)
    .filter(Boolean);
  return ["All", ...Array.from(new Set(values))];
}

// Every distinct suburb actually present in the current dataset — mirrors
// getPropertyTypes() above exactly, so a "Location" filter never shows a
// suburb with zero results. Shared (rather than each caller re-deriving
// this inline) for the same reason bedsOf() is shared: one definition
// that every filter UI reads from, not several copies that can quietly
// drift apart.
export function getSuburbs(cityProperties) {
  const values = (cityProperties || []).map((p) => p?.suburb).filter(Boolean);
  return ["All", ...Array.from(new Set(values)).sort()];
}

// Shared by HomePage's own filtering and App.jsx's `results` (which feeds
// Search/Explore) so a "beds" filter behaves identically everywhere it's
// exposed. Reads `.rooms` — the one real field every property actually
// has (see normalizeProperty() in services/database.js, which every
// property, seed or landlord-created, passes through). Earlier versions
// of this looked for `.beds`/`.bedrooms`, which don't exist anywhere in
// the real data model — every property has `.rooms` only, so that
// version silently matched zero properties whenever a specific bed count
// was selected.
export const bedsOf = (p) => Number(p?.rooms ?? NaN);

export function getPriceCeiling(cityProperties) {
  const max = Math.max(1000, ...(cityProperties || []).map((p) => Number(p?.rent) || 0));
  return Math.ceil(max / 100) * 100;
}

// Bucket counts of listings by rent, from 0 up to `ceiling`, for a
// histogram-behind-a-slider price control.
export function getPriceHistogram(cityProperties, ceiling, bins = 20) {
  const counts = new Array(bins).fill(0);
  const safeCeiling = ceiling > 0 ? ceiling : 1;
  (cityProperties || []).forEach((p) => {
    const rent = Number(p?.rent);
    if (!Number.isFinite(rent) || rent < 0) return;
    const idx = Math.min(bins - 1, Math.floor((rent / safeCeiling) * bins));
    counts[idx] += 1;
  });
  return counts;
}
