/**
 * @deprecated Compatibility facade for the Phase 1 migration.
 *
 * New application code must consume a backend contract/domain API rather than
 * importing Supabase. This file remains temporarily so existing behavior is
 * unchanged while domains migrate one at a time.
 */
export { supabase } from "../infrastructure/supabase/client";
