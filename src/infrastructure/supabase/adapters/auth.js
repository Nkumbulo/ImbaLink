import { supabase } from "../client";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";

/**
 * Google-only authentication against Supabase Auth.
 *
 * The phone/OTP path is gone: there is no SMS provider to pay for, no code to
 * mistype, and Google hands us a verified email plus a name and avatar, so a
 * new account starts with most of its profile already filled in.
 *
 * Row creation in public.users is handled by the on_auth_user_created trigger
 * in backend/google-auth.sql. ensureProfile() below repeats that work on the
 * client so the app still functions if the trigger has not been installed yet.
 */

// Custom URL scheme Google's OAuth flow redirects back into on iPhone/
// Android once sign-in completes — see the long comment on
// signInWithGoogle() below for why the native app needs a completely
// different redirect mechanism than the web build.
//
// REQUIRES matching native-project configuration this repo does not
// contain (the ios/ and android/ Capacitor projects live outside this
// web source tree):
//   1. iOS: add "imbalink" as a URL scheme in the native project's
//      Info.plist (Xcode: target -> Info -> URL Types -> add URL Scheme
//      "imbalink"). Android: a matching <intent-filter> with
//      android:scheme="imbalink" in AndroidManifest.xml (already the
//      default behavior once @capacitor/app is installed and
//      `npx cap sync` has been run, which adds the scaffolding — the
//      scheme string itself still has to match this constant).
//   2. Add "imbalink://auth-callback" to Supabase Auth's allow-listed
//      Redirect URLs (Supabase dashboard -> Authentication -> URL
//      Configuration). Supabase itself completes the round trip with
//      Google — Google's own OAuth client only ever needs Supabase's
//      callback URL registered, never this app's custom scheme.
const NATIVE_OAUTH_REDIRECT_URL = "imbalink://auth-callback";

function isNativeApp() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function normalizePhone(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("+")) return `+${raw.slice(1).replace(/\D/g, "")}`;
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("263")) return `+${digits}`;
  if (digits.startsWith("0")) return `+263${digits.slice(1)}`;
  return `+${digits}`;
}

// Google returns given_name/family_name for most accounts but only full_name
// for some (older accounts, some Workspace configs), so fall back to splitting.
function namesFromMetadata(metadata = {}) {
  const first = metadata.given_name || "";
  const surname = metadata.family_name || "";
  if (first || surname) return { first, surname };

  const full = String(metadata.full_name || metadata.name || "").trim();
  if (!full) return { first: "", surname: "" };
  const parts = full.split(/\s+/);
  return { first: parts[0], surname: parts.slice(1).join(" ") };
}

function appUser(authUser, row = null) {
  const metadata = authUser?.user_metadata || {};
  const fallback = namesFromMetadata(metadata);

  return {
    id: authUser.id,
    email: row?.email ?? authUser.email ?? "",
    firstName: row?.first_name ?? fallback.first,
    surname: row?.surname ?? fallback.surname,
    name:
      row?.display_name ||
      `${row?.first_name ?? fallback.first} ${row?.surname ?? fallback.surname}`.trim() ||
      authUser.email ||
      "",
    // Google's metadata wins over the stored row: it is refreshed on every
    // sign-in, so a changed profile picture shows up, and a link that has since
    // expired gets replaced instead of being served forever from our copy.
    // Flip the order if the app ever lets people upload their own photo.
    avatarUrl: metadata.avatar_url || metadata.picture || row?.avatar_url || "",
    phone: row?.phone ?? "",
    accountType: row?.account_type ?? null,
    studentProfile: row?.studentProfile ?? null,
    studentVerificationStatus: row?.studentVerificationStatus ?? null,
    // Null until the user finishes the profile step. App.jsx uses this to
    // decide whether to keep showing onboarding after a successful sign-in.
    onboardedAt: row?.onboarded_at ?? null,
    createdAt: row?.created_at ?? authUser.created_at ?? null,
  };
}

async function readProfileRow(userId) {
  const { data, error } = await supabase
    .from("users")
    .select(
      "id, email, phone, first_name, surname, display_name, avatar_url, account_type, onboarded_at, created_at"
    )
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;

  if (data.account_type === "student") {
    const student = await supabase
      .from("student_profiles")
      .select("verification_status, details")
      .eq("user_id", userId)
      .maybeSingle();
    if (!student.error && student.data) {
      data.studentProfile = student.data.details || {};
      data.studentVerificationStatus = student.data.verification_status;
    }
  }

  return data;
}

/**
 * Make sure a public.users row exists for this auth user. Safe to call on
 * every session read — it is a no-op once the row is there.
 */
async function ensureProfile(authUser) {
  const metadata = authUser.user_metadata || {};
  const googleAvatar = metadata.avatar_url || metadata.picture || null;
  const existing = await readProfileRow(authUser.id);

  // Keep the public users row synchronized with the Google profile. The app
  // renders other people's avatars through `public_user_profiles`, not the
  // private Supabase Auth session, so an older account can otherwise have a
  // Google photo in Auth while every public card only has the user's initial.
  if (existing) {
    const changed = googleAvatar && googleAvatar !== existing.avatar_url;
    if (changed) {
      const { data: updated, error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: googleAvatar, updated_at: new Date().toISOString() })
        .eq('id', authUser.id)
        .select('id, email, phone, first_name, surname, display_name, avatar_url, account_type, onboarded_at, created_at')
        .maybeSingle();
      if (!updateError && updated) return updated;
    }
    return existing;
  }

  const { first, surname } = namesFromMetadata(metadata);

  const { error } = await supabase.from("users").insert({
    id: authUser.id,
    email: authUser.email || null,
    first_name: first,
    surname,
    display_name: `${first} ${surname}`.trim() || authUser.email || "",
    avatar_url: metadata.avatar_url || metadata.picture || null,
    // account_type keeps its 'general' default; onboarded_at stays null so the
    // profile step still runs.
  });

  // A trigger may have inserted the row between our read and our write. That
  // is the expected race, not a failure — re-read and use whichever won.
  if (error && error.code !== "23505") throw error;

  return (await readProfileRow(authUser.id)) || null;
}

function makeSession(supabaseSession, row = null) {
  if (!supabaseSession?.user) return null;
  return {
    token: supabaseSession.access_token,
    user: appUser(supabaseSession.user, row),
    createdAt: new Date(supabaseSession.user.created_at || Date.now()).getTime(),
    expiresAt: (supabaseSession.expires_at || 0) * 1000,
  };
}

// Never make the first paint depend on a public.users query. Safari/iOS can
// leave a Supabase request pending when the network changes or the app is
// resumed from the background. The authenticated Supabase session itself is
// enough to boot the app; profile hydration happens immediately afterwards.
function sessionFromSupabase(supabaseSession) {
  if (!supabaseSession?.user) return null;
  return makeSession(supabaseSession);
}

async function hydrateSession(session) {
  if (!session?.user?.id) return session;
  const { data } = await supabase.auth.getSession();
  const authUser = data?.session?.user;
  if (!authUser) return session;
  const row = await ensureProfile(authUser).catch(() => null);
  return makeSession(data.session, row) || session;
}

export const supabaseAuthAdapter = {
  /**
   * Subscribe to Supabase authentication state changes.
   *
   * This is deliberately exposed by the backend auth adapter because the
   * application AuthContext needs a provider-neutral lifecycle hook. The
   * adapter owns the Supabase SDK details and returns the same simple
   * unsubscribe function the legacy provider expects.
   */
  onAuthStateChange(callback) {
    const { data } = supabase.auth.onAuthStateChange(callback);
    return () => {
      try {
        data?.subscription?.unsubscribe?.();
      } catch {
        // Unsubscription is best-effort during React effect cleanup.
      }
    };
  },

  /**
   * Sends the browser to Google. Nothing after this line runs on success —
   * the page navigates away and comes back to redirectTo with the session in
   * the URL, which the client picks up via detectSessionInUrl.
   *
   * NATIVE (iPhone/Android app) IS A COMPLETELY DIFFERENT PATH from the one
   * above, and is why "stuck at opening Google" specifically only ever
   * happened on iPhone: the old code called window.location.assign(data.url)
   * unconditionally, which — inside a Capacitor iOS app — navigates the
   * app's own embedded WKWebView itself directly to Google's sign-in page.
   * Google actively detects and blocks OAuth sign-in inside an embedded
   * app WebView on security grounds (its "disallowed_useragent" policy) —
   * it isn't a timing/network bug, Google's own servers refuse to complete
   * the flow there, which is exactly why it would hang/stall with no error
   * ever surfacing back to the app. A plain mobile Safari TAB (not the
   * wrapped native app) is a normal browser, not an embedded WebView, so
   * this never affected testing there — only the native app build.
   *
   * The fix Google requires is to run the OAuth flow in a genuine system
   * browser view (iOS SFSafariViewController / Android Chrome Custom Tabs)
   * instead of the app's own WebView, then hand control back to the app via
   * a redirect the OS recognizes and routes back in — @capacitor/browser's
   * Browser.open() opens exactly that system browser view, and the
   * corresponding app-side handoff is handleNativeOAuthRedirect() below,
   * wired to @capacitor/app's appUrlOpen listener in main.jsx.
   */
  async signInWithGoogle() {
    if (isNativeApp()) {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: NATIVE_OAUTH_REDIRECT_URL,
          queryParams: { prompt: "select_account" },
          // Without this, supabase-js's default web behavior tries to
          // navigate the CURRENT page (this app's own WebView) to
          // data.url itself — the exact behavior being replaced here.
          // skipBrowserRedirect leaves that entirely to us, so Browser.open()
          // below is the only thing that ever navigates anywhere.
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("Google sign-in could not be started.");
      // Presents Google's page in a real system browser view, never in the
      // app's own embedded WebView. Resolves once the view is presented —
      // NOT once the user finishes signing in — so nothing after this line
      // should assume completion; completion arrives later, out of band,
      // through the appUrlOpen listener when the OS hands the redirect back.
      await Browser.open({ url: data.url, presentationStyle: "popover" });
      return;
    }

    // WEB PATH — this is a genuinely different bug from the native one
    // above, and the actual explanation for "stuck at opening Google" when
    // testing in plain mobile Safari (not the wrapped native app): even
    // though this project's OAuth flow is 'implicit' (see
    // services/supabase.js — no flowType is set, and this supabase-js
    // version defaults to 'implicit'), meaning building the Google
    // authorize URL is pure, synchronous string construction with no real
    // network call involved, supabase.auth.signInWithOAuth() still wraps
    // that in its own internal `await this._getUrlForProvider(...)` before
    // it calls window.location.assign() itself — confirmed by reading
    // node_modules/@supabase/auth-js's actual source. Crossing ANY `await`
    // boundary — even one that resolves on the very next microtask with no
    // real async work behind it — means the code that finally calls
    // window.location.assign() is no longer running synchronously inside
    // the original click handler's call stack. iOS Safari specifically
    // (far more strictly than desktop browsers) can silently refuse a
    // programmatic navigation once it decides the "trusted user gesture"
    // backing it has lapsed — with no error, which is exactly why this
    // looked like a silent freeze rather than a visible failure. This is a
    // well-known category of complaint against supabase-js specifically on
    // iOS Safari for exactly this reason.
    //
    // The fix: since building this URL is deterministic and needs no
    // network call for the implicit flow, build it ourselves and navigate
    // immediately — with NO `await` anywhere before this line — so the
    // navigation is guaranteed to still be running inside the original
    // click's own call stack, exactly the same way a plain `<a href>`
    // click would be. This mirrors _getUrlForProvider()'s own URL shape
    // exactly (provider + redirect_to + queryParams as a query string),
    // just without the unavoidable await this library wraps around it.
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const params = new URLSearchParams({
      provider: "google",
      redirect_to: window.location.origin,
      prompt: "select_account",
    });
    window.location.assign(`${supabaseUrl}/auth/v1/authorize?${params.toString()}`);
  },

  // Provider-neutral sign-in entry point required by the backend contract.
  // ImbaLink currently uses Google as its user authentication flow, so the
  // generic contract method delegates to the existing Google implementation
  // instead of exposing Supabase-specific behavior to application code.
  async signIn() {
    return this.signInWithGoogle();
  },

  async getCurrentUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) return null;
    const row = await readProfileRow(data.user.id).catch(() => null);
    return appUser(data.user, row);
  },

  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) return null;
    return sessionFromSupabase(data.session);
  },

  sessionFromSupabase,
  hydrateSession,

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  /**
   * Writes the details Google can't give us: account type, phone, and the
   * student profile. Stamping onboarded_at is what clears the onboarding gate.
   */
  async completeProfile(updates = {}) {
    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData?.user;
    if (!authUser) throw new Error("NOT_SIGNED_IN");

    const accountType = updates.accountType === "student" ? "student" : "general";
    const firstName = String(updates.firstName || "").trim();
    const surname = String(updates.surname || "").trim();
    const phone = String(updates.phone || "").trim();

    const patch = {
      first_name: firstName,
      surname,
      display_name: `${firstName} ${surname}`.trim(),
      account_type: accountType,
      onboarded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (phone) {
      patch.phone = phone;
      patch.phone_normalized = normalizePhone(phone).replace(/^\+/, "");
    }

    const { error } = await supabase.from("users").update(patch).eq("id", authUser.id);
    if (error) throw error;

    if (accountType === "student") {
      const { error: studentError } = await supabase.from("student_profiles").upsert(
        {
          user_id: authUser.id,
          verification_status: updates.studentVerificationStatus || "pending",
          details: updates.studentProfile || {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      if (studentError) throw studentError;
    }

    const row = await readProfileRow(authUser.id);
    return appUser(authUser, row);
  },

  async updateProfile(currentSession, updates) {
    if (!currentSession?.user?.id) return currentSession;
    const user = await this.completeProfile({ ...currentSession.user, ...updates });
    return { ...currentSession, user };
  },

  async refreshSession() {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) return null;
    return sessionFromSupabase(data.session);
  },

  normalizePhone,

  /**
   * The other half of the native Google sign-in flow above. Wired to
   * @capacitor/app's appUrlOpen listener in main.jsx, which fires with
   * whatever URL the OS hands back to the app once Google/Supabase finish
   * and redirect to NATIVE_OAUTH_REDIRECT_URL — a custom-scheme URL, which
   * never becomes window.location.href the way a normal web redirect would
   * (the OS delivers it out of band), so it can't rely on
   * detectSessionInUrl the way the plain web flow does; the session has to
   * be pulled out of this URL and installed manually.
   *
   * Handles both OAuth response shapes since this project's Supabase
   * client doesn't pin an explicit flowType (see services/supabase.js):
   * a `code` query param (PKCE) or `access_token`/`refresh_token` in the
   * URL fragment (implicit, the current default for this supabase-js
   * version) — whichever one actually comes back is used; the other
   * branch is simply skipped.
   */
  async handleNativeOAuthRedirect(url) {
    try {
      await Browser.close();
    } catch {
      // Already closed, or never actually opened one — not fatal either way.
    }

    if (!url || typeof url !== "string") return;
    if (!url.startsWith(NATIVE_OAUTH_REDIRECT_URL)) return;

    let parsed;
    try {
      // Custom-scheme URLs ("imbalink://auth-callback?...") aren't
      // necessarily parsed the same as http(s) URLs by every environment —
      // substituting a valid http(s) origin so URL() only ever needs to
      // parse the query/hash portion reliably.
      parsed = new URL(url.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, "https://placeholder.local/"));
    } catch (err) {
      console.error("Could not parse native OAuth redirect URL:", err);
      return;
    }

    const code = parsed.searchParams.get("code");
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
      return;
    }

    const hashParams = new URLSearchParams(parsed.hash ? parsed.hash.slice(1) : "");
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) throw error;
      return;
    }

    const errorDescription = parsed.searchParams.get("error_description") || hashParams.get("error_description");
    if (errorDescription) throw new Error(errorDescription);
  },
};


// Backward-compatible name used by the legacy AuthContext/main entry points.
export const supabaseAuthProvider = supabaseAuthAdapter;
