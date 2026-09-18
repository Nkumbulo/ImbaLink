import { defineBackendContract } from "../contract";

/**
 * Business-level property port.
 *
 * These method names describe ImbaLink operations, not database tables or
 * Supabase query syntax.
 */
export const PROPERTY_REPOSITORY_METHODS = [
  "getProperty",
  "getProperties",
  "createProperty",
  "updateProperty",
  "deleteProperty",
];

export const propertyRepositoryContract = defineBackendContract(
  "PropertyRepository",
  PROPERTY_REPOSITORY_METHODS
);
