/**
 * Compatibility facade for the legacy business-login import path.
 * The Supabase implementation lives under infrastructure.
 */
export { supabaseBusinessAuthAdapter as localAuthProvider } from "../infrastructure/supabase/adapters/businessAuth";
