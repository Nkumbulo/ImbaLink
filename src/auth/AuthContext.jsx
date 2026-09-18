import { setActiveUser } from '../core/data/domains/account.js';
import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { backend } from "../application/backend/index.js";
import { setAuthTokenProvider } from "../core/infrastructure/apiClient";

const AuthContext = createContext(null);

// --- DEV ONLY -------------------------------------------------------------
// Set VITE_AUTH_BYPASS=true in .env.local to skip the sign-in screen and boot
// straight into the app with a stand-in session. Nothing here talks to
// Supabase. Delete the flag to restore the real flow — do NOT ship with it on.
const DEV_BYPASS = import.meta.env.VITE_AUTH_BYPASS === "true";

const AUTH_BOOT_TIMEOUT_MS = 10000;
const AUTH_BOOT_TIMEOUT = Symbol("AUTH_BOOT_TIMEOUT");
const withAuthTimeout = (promise) =>
  Promise.race([
    promise,
    new Promise((resolve) => window.setTimeout(() => resolve(AUTH_BOOT_TIMEOUT), AUTH_BOOT_TIMEOUT_MS)),
  ]);

const PROFILE_HYDRATE_TIMEOUT_MS = 4000;
const PROFILE_HYDRATE_TIMEOUT = Symbol("PROFILE_HYDRATE_TIMEOUT");
const withProfileTimeout = (promise) =>
  Promise.race([
    promise,
    new Promise((resolve) => window.setTimeout(() => resolve(PROFILE_HYDRATE_TIMEOUT), PROFILE_HYDRATE_TIMEOUT_MS)),
  ]);

const DEV_SESSION = {
  token: "dev-bypass-token",
  createdAt: Date.now(),
  expiresAt: Date.now() + 86400000,
  user: {
    id: "dev-user",
    email: "dev@imbalink.test",
    firstName: "Dev",
    surname: "Tester",
    name: "Dev Tester",
    avatarUrl: "",
    phone: "",
    accountType: import.meta.env.VITE_AUTH_BYPASS_ROLE || "general",
    studentProfile: null,
    studentVerificationStatus: null,
    // Set VITE_AUTH_BYPASS_NEEDS_PROFILE=true to land on the profile step
    // instead of the app, for working on that screen without a real account.
    onboardedAt:
      import.meta.env.VITE_AUTH_BYPASS_NEEDS_PROFILE === "true"
        ? null
        : new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
};
// --- /DEV ONLY ------------------------------------------------------------

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileReady, setProfileReady] = useState(false);
  // Three-state profile knowledge: unknown while restoring, known when the
  // users row was read, and failed when the network/storage timed out. A
  // failed read must NEVER be interpreted as "new user" or flash onboarding.
  const [profileKnown, setProfileKnown] = useState(false);
  const [loading, setLoading] = useState(false);
  const sessionRef = useRef(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    setAuthTokenProvider(async () => sessionRef.current?.accessToken || sessionRef.current?.token || null);
    return () => setAuthTokenProvider(null);
  }, []);

  const applySession = useCallback((next) => {
    setActiveUser(next?.user?.id || null);
    setSession(next);
  }, []);

  // Mirrors sessionRef: the onAuthStateChange callback below is registered
  // once (see the effect's dependency array) and would otherwise close over
  // whatever `profileKnown` was AT THAT MOMENT (always `false`, since the
  // effect runs once on mount) rather than its current value on every later
  // firing. A ref keeps it live.
  const profileKnownRef = useRef(false);
  useEffect(() => {
    profileKnownRef.current = profileKnown;
  }, [profileKnown]);

  useEffect(() => {
    let active = true;
    setProfileKnown(false);

    if (DEV_BYPASS) {
      applySession(DEV_SESSION);
      setProfileReady(true);
      setProfileKnown(true);
      setAuthLoading(false);
      return () => { active = false; };
    }

    // Boot from the Supabase Auth session only. Do not block the splash on
    // public profile queries: iOS/Safari can leave those requests pending.
    withAuthTimeout(backend.auth.getSession())
      .then((initial) => {
        if (!active) return;

        // A timeout is not the same as "logged out". Keep the splash visible
        // during a slow iOS/Safari auth restore so a refresh never flashes the
        // onboarding screen over a session that is still being recovered.
        if (initial === AUTH_BOOT_TIMEOUT) {
          // Keep the splash during a slow restore, then make one direct retry.
          // We must not treat a timed-out session as a logged-out user.
          withAuthTimeout(backend.auth.getSession())
            .then((retry) => {
              if (!active) return;

              // Both attempts hung (~20s total, on top of Splash's own
              // display floor) — this was the actual "stuck on Connecting
              // spaces forever" bug: this branch used to just `return;`
              // here with NOTHING to fall back on, leaving authLoading
              // stuck at its initial `true` value permanently, since
              // nothing else in this whole effect ever sets it false for
              // this specific path. Rather than hang indefinitely, fall
              // through to a safe default and let the app render. If a
              // real session actually exists, it is not lost: the
              // onAuthStateChange listener registered further down in
              // this same effect is completely independent of this
              // getSession()-based timeout chain, and Supabase fires its
              // own INITIAL_SESSION event through it as soon as it
              // finishes reading the persisted session — so this will
              // still self-correct to signed-in moments later with no
              // action needed, instead of leaving the person stuck on a
              // frozen screen with no way in at all.
              if (retry === AUTH_BOOT_TIMEOUT) {
                setProfileReady(true);
                setProfileKnown(true);
                setAuthLoading(false);
                return;
              }
              applySession(retry);
              if (!retry) {
                setProfileReady(true);
                setProfileKnown(true);
                setAuthLoading(false);
                return;
              }
              withProfileTimeout(backend.auth.hydrateSession(retry))
                .then((hydrated) => {
                  if (!active) return;
                  if (hydrated && hydrated !== PROFILE_HYDRATE_TIMEOUT && hydrated.user) {
                    applySession(hydrated);
                    setProfileKnown(Boolean(hydrated.user.onboardedAt || hydrated.user.accountType));
                  } else {
                    setProfileKnown(false);
                  }
                  setProfileReady(true);
                  setAuthLoading(false);
                })
                .catch(() => {
                  if (active) { setProfileReady(true); setProfileKnown(false); setAuthLoading(false); }
                });
            })
            .catch(() => {
              // The retry call itself threw (not just timed out) — same
              // dead-end risk as above if left unhandled. Same safe
              // fallback: render the app instead of leaving Splash up
              // with no resolution.
              if (active) { setProfileReady(true); setProfileKnown(true); setAuthLoading(false); }
            });
          return;
        }

        applySession(initial);
        if (!initial) {
          setProfileReady(true);
          setProfileKnown(true);
          setAuthLoading(false);
        }

        // Hydrate the app profile after the shell is already usable. If the
        // network is slow/offline, the app still opens instead of hanging on
        // "Connecting spaces".
        if (initial) {
          withProfileTimeout(backend.auth.hydrateSession(initial))
            .then((hydrated) => {
              if (!active) return;
              if (hydrated && hydrated !== PROFILE_HYDRATE_TIMEOUT && hydrated.user) {
                applySession(hydrated);
                setProfileKnown(Boolean(hydrated.user.onboardedAt || hydrated.user.accountType));
              } else {
                setProfileKnown(false);
              }
              setProfileReady(true);
              setAuthLoading(false);
            })
            .catch(() => {
              if (active) {
                setProfileReady(true);
                setProfileKnown(false);
                setAuthLoading(false);
              }
            });
        }
      })
      .catch(() => {
        if (active) setAuthLoading(false);
      });

    // Fires when the browser returns from Google with tokens in the URL, and
    // again on every token refresh. This is what turns the redirect back into
    // a signed-in app — there is no callback route to write.
    const unsubscribeAuth = backend.auth.onAuthStateChange((_event, nextSupabaseSession) => {
      if (!active) return;

      // IMPORTANT: Supabase invokes this callback while its internal auth
      // state machinery is active. Never await another Supabase operation
      // here (especially getSession/refreshSession); Safari/WKWebView can
      // otherwise deadlock the auth lock and leave the app on Splash forever.
      if (!nextSupabaseSession?.user) {
        applySession(null);
        setProfileReady(true);
        setProfileKnown(true);
        setAuthLoading(false);
        return;
      }

      // Supabase's own autoRefreshToken machinery fires this same callback
      // (as 'TOKEN_REFRESHED', and on some versions 'SIGNED_IN' again) every
      // time the tab regains focus/visibility, not just on a genuine new
      // sign-in — that's supabase-js's documented behavior with
      // autoRefreshToken enabled (see services/supabase.js), and there is no
      // way to opt a single client out of it. THIS was the actual cause of
      // the "Connecting spaces" freeze on switching back to the tab: every
      // one of those routine refreshes used to unconditionally reset
      // profileReady/profileKnown to false below, which — via authLoading's
      // derivation at the bottom of this hook — put an already fully-loaded
      // app back behind the Splash screen for up to
      // PROFILE_HYDRATE_TIMEOUT_MS on every single tab switch, for a user
      // who never actually signed out or in. For the SAME user we already
      // have a known, hydrated profile for, this is not a new session
      // arriving — just refresh the token in place and touch nothing else
      // that gates rendering.
      const previousUserId = sessionRef.current?.user?.id || null;
      const sameUser = previousUserId && previousUserId === nextSupabaseSession.user.id;
      if (sameUser && profileKnownRef.current) {
        setSession((current) =>
          current ? { ...current, token: nextSupabaseSession.access_token } : current
        );
        return;
      }

      const next = backend.auth.sessionFromSupabase(nextSupabaseSession);
      applySession(next);
      setProfileReady(false);
      setProfileKnown(false);
      setAuthLoading(false);

      // Let Supabase finish the auth-state callback before doing the profile
      // query. The profile is enrichment, never a prerequisite for rendering.
      window.setTimeout(() => {
        if (!active) return;
        withProfileTimeout(backend.auth.hydrateSession(next))
          .then((hydrated) => {
            if (!active) return;
            if (hydrated && hydrated !== PROFILE_HYDRATE_TIMEOUT && hydrated.user) {
              applySession(hydrated);
              setProfileKnown(Boolean(hydrated.user.onboardedAt || hydrated.user.accountType));
            } else {
              setProfileKnown(false);
            }
            setProfileReady(true);
          })
          .catch(() => {
            if (active) { setProfileReady(true); setProfileKnown(false); }
          });
      }, 0);
    });

    return () => {
      active = false;
      unsubscribeAuth?.();
    };
  }, [applySession]);

  const signInWithGoogle = useCallback(async () => {
    setLoading(true);
    try {
      await backend.auth.signInWithGoogle();
      // On WEB, success means the page is already navigating away to
      // Google, so this line effectively never runs. On the NATIVE app,
      // though, signInWithGoogle() now opens a system browser SHEET over
      // this still-running app instead of navigating away — so unlike the
      // web path, execution actually does continue here once that sheet
      // is presented, and without this, the sign-in button would stay
      // stuck showing its loading/"Opening Google…" state for as long as
      // the person is on Google's page (real completion arrives later,
      // separately, through the appUrlOpen listener in main.jsx).
      setLoading(false);
    } catch (err) {
      setLoading(false);
      throw err;
    }
  }, []);

  // Google gives us an email and a name but not an account type, a phone
  // number, or a campus. This writes those and lifts the onboarding gate.
  const completeProfile = useCallback(async (details) => {
    setLoading(true);
    try {
      const user = await backend.auth.completeProfile(details);
      const current = sessionRef.current;
      applySession({ ...(current || {}), user });
      return user;
    } finally {
      setLoading(false);
    }
  }, [applySession]);

  // Business username/password authentication is delegated to the server-side
  // Edge Function through the compatibility provider.
  const logInWithCredentials = useCallback(async (username, password) => {
    setLoading(true);
    try {
      const { localAuthProvider } = await import("./localAuthProvider");
      const newSession = await localAuthProvider.signInWithCredentials(username, password);
      applySession(newSession);
      return newSession.user;
    } finally {
      setLoading(false);
    }
  }, [applySession]);

  const signOut = useCallback(async () => {
    if (DEV_BYPASS) {
      applySession(DEV_SESSION);
      return;
    }
    await backend.auth.signOut();
    applySession(null);
  }, [applySession]);

  const updateProfile = useCallback(async (updates) => {
    const current = sessionRef.current;
    if (!current) return;
    if (DEV_BYPASS) {
      applySession({ ...current, user: { ...current.user, ...updates } });
      return;
    }
    const updated = await backend.auth.updateProfile(current, updates);
    applySession(updated);
  }, [applySession]);

  const user = session?.user || null;

  const value = {
    user,
    token: session?.token || null,
    isAuthenticated: Boolean(user),
    // Signed in via Google, but hasn't chosen an account type yet. Business
    // sessions come from the local provider already complete, so they skip it.
    needsProfile: profileReady && profileKnown && Boolean(user) && !user.onboardedAt && user.accountType !== "business",
    authLoading: authLoading || (Boolean(user) && !profileReady),
    loading,
    signInWithGoogle,
    completeProfile,
    logInWithCredentials,
    signOut,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

export function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : null;
}
