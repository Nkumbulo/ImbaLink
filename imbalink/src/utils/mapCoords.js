// Approximate coordinates for Harare (and a couple of other Zimbabwe
// cities') suburbs, used to show a property's general area on a map.
//
// Deliberately suburb-level, not per-listing precise geocoding: this app
// never collects or exposes an exact property location to the public (see
// PropertyDetail.jsx / GridTile.jsx — street_address is stored but never
// rendered anywhere), and a map pin sitting exactly on a landlord's home
// would undo that. Every property in the same suburb shares the same
// approximate point plus a small random jitter (see jitterCoords below)
// so multiple pins in one suburb don't stack exactly on top of each
// other, without implying any of them is an exact address.
//
// Coordinates are ordinary public geography (city/suburb centers), not
// anything scraped or private.

export const CITY_CENTERS = {
  Harare: { lat: -17.8292, lng: 31.0522 },
  Bulawayo: { lat: -20.15, lng: 28.5833 },
};

export const SUBURB_COORDS = {
  Harare: {
    "Avondale": { lat: -17.801, lng: 31.033 },
    "Belgravia": { lat: -17.81, lng: 31.045 },
    "Hatfield": { lat: -17.899, lng: 31.087 },
    "Mount Pleasant": { lat: -17.781, lng: 31.043 },
    "Milton Park": { lat: -17.823, lng: 31.033 },
    "Borrowdale": { lat: -17.75, lng: 31.085 },
    "Eastlea": { lat: -17.828, lng: 31.073 },
    "Mabelreign": { lat: -17.795, lng: 31.005 },
    "Highlands": { lat: -17.785, lng: 31.102 },
    "Warren Park": { lat: -17.825, lng: 30.97 },
    "Greendale": { lat: -17.813, lng: 31.11 },
    "Marlborough": { lat: -17.775, lng: 30.995 },
    "Waterfalls": { lat: -17.87, lng: 31.03 },
    "Msasa": { lat: -17.845, lng: 31.11 },
  },
};

// Deterministic jitter (not random per render) so the same property's pin
// doesn't visibly jump around every time the map re-renders — derived
// from the property id itself, small enough to stay visually "somewhere
// in this suburb", nowhere near enough precision to read as an address.
function jitterFromId(id, spread = 0.006) {
  const str = String(id || "");
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  const a = (hash % 1000) / 1000 - 0.5;
  const b = (Math.floor(hash / 1000) % 1000) / 1000 - 0.5;
  return { dLat: a * spread, dLng: b * spread };
}

// Returns { lat, lng, approximate: true } for a property, or null if
// there's genuinely nothing to place on a map (no suburb and no known
// city center).
export function coordsForProperty(property) {
  if (!property) return null;
  const city = property.city || "Harare";
  const suburb = property.suburb;
  const base =
    (SUBURB_COORDS[city] && SUBURB_COORDS[city][suburb]) ||
    CITY_CENTERS[city] ||
    CITY_CENTERS.Harare;
  if (!base) return null;
  const { dLat, dLng } = jitterFromId(property.id);
  return { lat: base.lat + dLat, lng: base.lng + dLng, approximate: true };
}
