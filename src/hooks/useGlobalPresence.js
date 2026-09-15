import { useEffect } from "react";
import { heartbeatPresence } from "../services/presence";

const HEARTBEAT_MS = 20_000;
const ONLINE_WINDOW_MS = 75_000;

let sharedRefs = 0;
let heartbeatTimer = null;
let teardownTimer = null;

async function heartbeat() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  try {
    await heartbeatPresence();
  } catch {}
}

function startShared() {
  sharedRefs += 1;
  // A previous consumer's teardown may still be pending (see
  // scheduleTeardown below) — cancel it, since the resource is wanted
  // again before it actually fired.
  if (teardownTimer) {
    clearTimeout(teardownTimer);
    teardownTimer = null;
  }
  void heartbeat();
  if (!heartbeatTimer) heartbeatTimer = window.setInterval(() => {
    // Each mounted authenticated app normally has one user. Keeping the
    // callback lightweight avoids a heartbeat storm on route changes.
    void heartbeat();
  }, HEARTBEAT_MS);
  const onOnline = () => { void heartbeat(); };
  window.addEventListener("online", onOnline);
  return () => {
    window.removeEventListener("online", onOnline);
    sharedRefs = Math.max(0, sharedRefs - 1);
    if (!sharedRefs) scheduleTeardown();
  };
}

// Deferred by one tick rather than run synchronously the instant the ref
// count hits zero, for the same React 18 StrictMode double-mount reason the
// old channel teardown here used to guard against (mount -> unmount ->
// remount, all synchronously, in dev only). Presence's only consumer is
// useChatPresence inside MessagesPage, so losing this guard would mean the
// heartbeat interval flickering off and back on every StrictMode dev pass.
function scheduleTeardown() {
  if (teardownTimer) clearTimeout(teardownTimer);
  teardownTimer = window.setTimeout(() => {
    teardownTimer = null;
    if (sharedRefs > 0) return; // a new consumer mounted before this fired
    if (heartbeatTimer) {
      window.clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }, 0);
}

/**
 * Keeps the CURRENT user's own `user_presence.last_seen_at` row fresh on a
 * plain interval while mounted. Call-and-forget: nothing is returned,
 * because nothing reads a global "who's online" list anymore.
 *
 * This used to also open one shared Supabase Realtime channel that every
 * online user joined and `track()`-ed themselves onto every heartbeat, so
 * every user's presence update was broadcast to every OTHER user on that
 * channel. With C concurrent users that's C heartbeats per tick each
 * delivered to C-1 others — O(C^2) realtime message volume, not O(C) — and
 * it was heading towards Supabase's realtime message quota (and real
 * overage billing) at a much lower concurrent-user count than anything
 * else in the stack. Nobody actually needs a live global list: the only
 * consumer, useChatPresence, only ever looks up ONE specific other user at
 * a time. That lookup is handled by a Realtime subscription filtered to
 * that one user's row (`user_id=eq.<id>`, see useChatPresence.js), which
 * Supabase delivers only to clients that filtered for that exact row —
 * cost scales with how many people are currently viewing a chat with that
 * one person, not with how many people are online in total.
 *
 * Trade-off worth knowing: the old design also got an instant "gone
 * offline" the moment someone's tab closed (Realtime presence "leave"
 * event). That's gone too — a departed user now reads as offline once
 * their `last_seen_at` goes stale (ONLINE_WINDOW_MS, unchanged at 75s),
 * same as any other gap between heartbeats, not immediately on tab close.
 */
export function useGlobalPresence(userId) {
  useEffect(() => {
    if (!userId) return undefined;
    return startShared();
  }, [userId]);
}

export function isPresenceOnline(lastSeenAt) {
  if (!lastSeenAt) return false;
  const age = Date.now() - new Date(lastSeenAt).getTime();
  return Number.isFinite(age) && age <= ONLINE_WINDOW_MS;
}
