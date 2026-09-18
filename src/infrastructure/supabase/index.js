/**
 * Supabase infrastructure barrel.
 *
 * Only infrastructure/auth compatibility code should depend on this layer.
 * Domain/application code should consume backend contracts instead.
 */
export { supabase } from "./client";
export { backend } from "./backend";
export { supabaseAuthAdapter } from "./adapters/auth";
export { supabasePropertyRepository } from "./adapters/properties";

export { supabaseProfileRepository } from "./adapters/profiles";
