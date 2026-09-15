export const isPropertyVerified = (p) => {
  if (!p) return false;
  return (
    p.verification === "verified" ||
    p.verified === true ||
    p.verificationStatus === "verified"
  );
};

export const bathsOf = (p) => Number(p?.baths ?? p?.bathrooms ?? NaN);

export const isFurnishedProp = (p) => p?.furnished === true || p?.furnished === "furnished";
export const isUnfurnishedProp = (p) => p?.furnished === false || p?.furnished === "unfurnished";
export const hasParkingProp = (p) => p?.parking === true || p?.hasParking === true;
export const isAvailableNowProp = (p) => p?.availableNow === true || p?.availability === "now" || !p?.availableFrom;
export const amenitiesOf = (p) => {
  const raw = p?.amenities;
  if (Array.isArray(raw)) return raw.map((a) => String(a).toLowerCase());
  return [];
};
// "Pet friendly" isn't its own column anywhere in the schema — it's stored
// as one of the strings inside properties.amenities, same as every other
// amenity (see ListingForm.jsx's AMENITIES list). This used to check
// p.petFriendly / p.pets / p.petsAllowed, none of which any real property
// object has, so turning this filter on excluded every single listing.
// Reads the real source of truth instead, same as AMENITY_OPTIONS.
export const isPetFriendlyProp = (p) => amenitiesOf(p).includes("pet friendly");
