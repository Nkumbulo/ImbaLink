/**
 * Compatibility wrapper for the legacy business-login import path.
 * Business credentials are authenticated by the Supabase Edge Function
 * `business-auth`; this module never reads or verifies credentials locally.
 */
import { supabase } from "../core/supabase/client";

export const localAuthProvider = {
  async signInWithCredentials(username, password) {
    const cleanUsername = String(username || "").trim();
    const cleanPassword = String(password || "");
    if (!cleanUsername || !cleanPassword) throw new Error("CREDENTIALS_REQUIRED");

    const { data, error } = await supabase.functions.invoke("business-auth", {
      body: { action: "signIn", username: cleanUsername, password: cleanPassword },
    });
    if (error) throw new Error(error.message || "Business sign-in failed. Please try again.");

    const accessToken = data?.session?.access_token;
    const refreshToken = data?.session?.refresh_token;
    if (!accessToken || !refreshToken) throw new Error("AUTH_SESSION_INVALID");

    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken, refresh_token: refreshToken,
    });
    if (sessionError || !sessionData.session) throw sessionError || new Error("AUTH_SESSION_INVALID");

    return {
      token: sessionData.session.access_token,
      user: data.user,
      createdAt: new Date(sessionData.session.user?.created_at || Date.now()).getTime(),
      expiresAt: (sessionData.session.expires_at || 0) * 1000,
    };
  },
};
