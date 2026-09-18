import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    [
      "Supabase environment variables are missing.",
      `VITE_SUPABASE_URL = ${supabaseUrl ?? "undefined"}`,
      `VITE_SUPABASE_ANON_KEY = ${supabaseAnonKey ? "set" : "undefined"}`,
      "",
      "Put .env.local beside package.json and restart Vite.",
    ].join("\n")
  );
}

/**
 * Infrastructure-only Supabase client.
 *
 * This module is intentionally below the application/backend contract
 * boundary. Application code must not import @supabase/supabase-js directly.
 * During Phase 1, compatibility facades still expose this client to legacy
 * code. Those facades will be removed domain-by-domain in later phases.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
