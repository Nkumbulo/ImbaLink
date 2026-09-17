import { photosFor } from "../../utils/propertyHelpers";

// Prefer a property's real listing photos (same as GridTile/PropertyDetail);
// only fall back to a generated placeholder when no real images exist.
export function propertyPhoto(property) {
  if (Array.isArray(property?.images) && property.images.length > 0) {
    return property.images[0];
  }
  return photosFor(property?.id)[0];
}

// Short "how to find a roommate" explainer video ID
export const ROOMMATE_TUTORIAL_VIDEO_ID = "M7lc1UVf-VE";
