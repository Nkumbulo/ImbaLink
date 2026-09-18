import {
  getProperties,
  getPropertyById,
} from "../../../core/data/implementations/properties/queries";
import {
  createLandlordListing,
  updateLandlordListing,
  deleteLandlordListing,
} from "../../../core/data/implementations/properties/mutations";

/**
 * Compatibility-first property adapter.
 *
 * The existing property implementation remains the source of runtime
 * behavior for now. This adapter gives the application a stable business
 * contract while Phase 2 gradually moves provider-specific persistence out
 * of the legacy implementation.
 */
export const supabasePropertyRepository = Object.freeze({
  getProperty(id) {
    return getPropertyById(id);
  },

  getProperties(filters = {}) {
    return getProperties(filters);
  },

  createProperty(property, options = {}) {
    return createLandlordListing(property, options);
  },

  updateProperty(id, changes, options = {}) {
    return updateLandlordListing(id, changes, options);
  },

  deleteProperty(id) {
    return deleteLandlordListing(id);
  },
});
