/**
 * Compatibility facade for the legacy auth provider API.
 *
 * The implementation lives in infrastructure/supabase. Application code may
 * keep importing this module during the migration, but it no longer knows
 * about the Supabase SDK.
 */
export { supabaseAuthAdapter as supabaseAuthProvider } from "../infrastructure/supabase/adapters/auth";
