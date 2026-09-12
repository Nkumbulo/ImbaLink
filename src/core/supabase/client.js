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
 * Canonical browser Supabase client.
 *
 * Architectural rule: UI/features never create their own Supabase client.
 * They may import this client only through a service/gateway boundary.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
