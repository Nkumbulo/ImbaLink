export const BEDS_OPTIONS = ["Any", "1", "2", "3", "4", "5+"];
export const BATHS_OPTIONS = ["Any", "1", "2", "3+"];
export const FURNISHED_OPTIONS = ["Any", "Furnished", "Unfurnished"];
// Previously listed amenities ("wifi", "ac", "gym", "balcony") that don't
// exist anywhere in the actual data — ListingForm.jsx's AMENITIES list is
// the only place amenities actually get set on a property, and none of
// its values matched these keys (not even "wifi" vs the real "Wi-Fi",
// which amenitiesOf's lowercasing turns into "wi-fi" — still a mismatch).
// So this filter matched nothing, ever. Keys now mirror
// ListingForm.jsx's AMENITIES exactly (lowercased, matching amenitiesOf's
// own normalization) — "Parking" and "Pet friendly" are deliberately
// left out since those already have their own dedicated toggles above
// (hasParkingProp / isPetFriendlyProp) and would otherwise appear twice.
export const AMENITY_OPTIONS = [
  { key: "borehole", label: "Borehole" },
  { key: "backup water", label: "Backup water" },
  { key: "solar", label: "Solar" },
  { key: "generator", label: "Generator" },
  { key: "wi-fi", label: "Wi-Fi" },
  { key: "garden", label: "Garden" },
  { key: "security guard", label: "Security guard" },
  { key: "cctv", label: "CCTV" },
  { key: "electric fence", label: "Electric fence" },
  { key: "dstv ready", label: "DSTV ready" },
];

export const SORT_OPTIONS = [
  { key: "newest", label: "Newest" },
  { key: "price_asc", label: "Price: Low to High" },
  { key: "price_desc", label: "Price: High to Low" },
];
