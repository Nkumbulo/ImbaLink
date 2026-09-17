// Tracks which account the current browser session belongs to. This is
// deliberately the ONLY thing this module does — cache invalidation on
// user-switch lives in db/account.js, which composes this with the
// property/contractor caches rather than this module reaching into them.

let ACTIVE_USER_ID = null;

export function setActiveUser(userId) {
  ACTIVE_USER_ID = userId ? String(userId) : null;
}

// Every row this file writes is owned by a real account. Returning a
// placeholder id would produce rows RLS then refuses to read back, so callers
// get null and skip the write instead.
export function activeUserKey() {
  return ACTIVE_USER_ID;
}

export function requireUser() {
  const id = activeUserKey();
  if (!id) throw new Error('NOT_SIGNED_IN');
  return id;
}

/**
 * Database writes must never trust a user id supplied by UI state or form data.
 * RLS is authoritative, but failing early here prevents stale profile state
 * (or the old `local-user` fallback) from producing an RLS error that looks
 * like a database outage.
 */
export function requireCurrentUserId(candidate = null) {
  const authenticatedId = requireUser();
  if (candidate != null && String(candidate).trim() && String(candidate) !== authenticatedId) {
    throw new Error('USER_ID_MISMATCH');
  }
  return authenticatedId;
}
