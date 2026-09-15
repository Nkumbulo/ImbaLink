/**
 * Write-through outbox.
 *
 * The sync question this answers: IndexedDB is currently the source of
 * truth, and the app is genuinely usable with no connection. Pointing
 * `services/database.js` straight at HTTP would break that — every like,
 * message and listing would need a live connection to succeed.
 *
 * So writes stay local-first and unconditional, exactly as they are today,
 * and each one additionally records an intent here. This queue drains to the
 * server whenever one is configured and reachable. The local write never
 * waits for it and never fails because of it.
 *
 * Conflict policy: last-write-wins, per record, decided by the server on
 * `updatedAt`. That is the right trade for this data — two devices editing
 * the same listing is rare, and the loser losing a field edit is a far
 * cheaper failure than the merge machinery needed to avoid it. Messages are
 * the exception and are append-only by construction (each has its own id),
 * so they never conflict; they interleave by timestamp.
 *
 * Ordering: entries drain oldest-first and a retryable failure stops the
 * drain rather than skipping ahead. This matters — "create listing" followed
 * by "upload its photo" must not be reordered, and neither must "create
 * share request" then "withdraw it".
 *
 * WITH NO BACKEND CONFIGURED THIS MODULE IS A NO-OP. enqueue() returns
 * immediately without writing anything, so the queue can't accumulate
 * entries that will never be sent. That keeps today's behaviour bit-for-bit
 * unchanged until VITE_API_BASE_URL is set.
 */

import { idbGet, idbGetAll, idbPut, idbDelete, ensureReady } from "../../core/infrastructure/indexeddb";
import { newId } from "../../services/ids";
import { isBackendEnabled, request, ApiError } from "../infrastructure/apiClient";
import { reconcileMutation } from './reconciliation';

const MAX_ATTEMPTS = 8;
const MAX_QUEUE = 5_000;
const IN_FLIGHT_TIMEOUT_MS = 2 * 60_000;
const BASE_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 5 * 60_000;

// Maps an outbox entry to its HTTP call. Keeping the routing table here
// rather than in each database.js method means the REST shape can change
// without touching the data layer.
const ROUTES = {
  "listing.create": (entry) => ({ method: "POST", path: "/v1/listings", body: entry.payload }),
  "listing.update": (entry) => ({ method: "PATCH", path: `/v1/listings/${entry.entityId}`, body: entry.payload }),
  "listing.delete": (entry) => ({ method: "DELETE", path: `/v1/listings/${entry.entityId}` }),
  "profile.upsert": (entry) => ({ method: "PUT", path: `/v1/profiles/${entry.entityId}`, body: entry.payload }),
  "like.set": (entry) => ({ method: "PUT", path: `/v1/properties/${entry.entityId}/like`, body: entry.payload }),
  "save.set": (entry) => ({ method: "PUT", path: `/v1/properties/${entry.entityId}/save`, body: entry.payload }),
  "contractorLike.set": (entry) => ({ method: "PUT", path: `/v1/contractors/${entry.entityId}/like`, body: entry.payload }),
  "viewingRequest.create": (entry) => ({ method: "POST", path: "/v1/viewing-requests", body: entry.payload }),
  "message.send": (entry) => ({ method: "POST", path: "/v1/messages", body: entry.payload }),
  "registration.upsert": (entry) => ({ method: "PUT", path: `/v1/registrations/${entry.entityId}`, body: entry.payload }),
  "quoteRequest.create": (entry) => ({ method: "POST", path: "/v1/quote-requests", body: entry.payload }),
  "shareRequest.create": (entry) => ({ method: "POST", path: "/v1/share-requests", body: entry.payload }),
  "shareRequest.update": (entry) => ({ method: "PATCH", path: `/v1/share-requests/${entry.entityId}`, body: entry.payload }),
  "shareRequest.delete": (entry) => ({ method: "DELETE", path: `/v1/share-requests/${entry.entityId}` }),
  "studentInterest.set": (entry) => ({ method: "PUT", path: `/v1/student-interests/${entry.entityId}`, body: entry.payload }),
  "media.attach": (entry) => ({ method: "POST", path: "/v1/media/attach", body: entry.payload }),
};

let draining = false;
let drainTimer = null;
const listeners = new Set();

function notify(status) {
  listeners.forEach((listener) => {
    try {
      listener(status);
    } catch {
      // A broken listener must not stop the queue.
    }
  });
}

/** Subscribe to { pending, draining, lastError } changes. Returns unsubscribe. */
export function subscribeToSyncStatus(listener) {
  if (typeof listener !== "function") return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function pendingCount() {
  if (!isBackendEnabled()) return 0;
  try {
    await ensureReady();
    return (await idbGetAll("outbox")).length;
  } catch {
    return 0;
  }
}

/**
 * Record an intent to sync. Safe to call from anywhere, including inside a
 * failed local write — it never throws and never blocks the caller.
 *
 * `dedupeKey` collapses repeated writes to the same thing: toggling a like
 * five times before the connection returns should send one final state, not
 * five. Entries without a dedupeKey (messages, listing creates) are always
 * appended.
 */
export async function enqueue(operation, { entityId = null, payload = null, dedupeKey = null } = {}) {
  if (!isBackendEnabled()) return null;
  if (!ROUTES[operation]) return null;

  try {
    await ensureReady();

    if (dedupeKey) {
      const existing = (await idbGetAll("outbox")).find((row) => row.dedupeKey === dedupeKey && !row.inFlight);
      if (existing) {
        const merged = { ...existing, payload, entityId, queuedAt: Date.now(), attempts: 0, nextAttemptAt: 0, lastError: null };
        await idbPut("outbox", merged);
        scheduleDrain();
        return merged.id;
      }
    }

    const all = await idbGetAll("outbox");
    if (all.length >= MAX_QUEUE) {
      // Never silently discard user mutations. A full queue is an explicit
      // storage-pressure condition; callers keep their local state and the
      // sync layer surfaces the condition for support/recovery.
      notify({ draining: false, pending: all.length, lastError: "SYNC_QUEUE_FULL" });
      return null;
    }

    const entry = {
      id: newId("outbox"),
      operation,
      entityId: entityId == null ? null : String(entityId),
      payload,
      dedupeKey,
      queuedAt: Date.now(),
      attempts: 0,
      nextAttemptAt: 0,
      inFlight: false,
      lastError: null,
      schemaVersion: 1,
      clientMutationId: `${operation}:${entityId || "none"}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`,
    };
    await idbPut("outbox", entry);
    scheduleDrain();
    return entry.id;
  } catch {
    // The local write already succeeded; failing to record the sync intent
    // must not surface to the user. The next full-state sync reconciles it.
    return null;
  }
}

function backoffFor(attempts) {
  return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1));
}

function scheduleDrain(delayMs = 0) {
  if (!isBackendEnabled()) return;
  if (drainTimer) return;
  drainTimer = setTimeout(() => {
    drainTimer = null;
    drain().catch(() => {});
  }, delayMs);
}

/**
 * Send queued entries oldest-first. Stops at the first retryable failure so
 * ordering is preserved; drops entries the server has definitively rejected
 * so one bad payload can't wedge the queue forever.
 */
export async function drain() {
  if (!isBackendEnabled() || draining) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;

  draining = true;
  notify({ draining: true });

  try {
    await ensureReady();
    const queue = (await idbGetAll("outbox")).sort((a, b) => (a.queuedAt || 0) - (b.queuedAt || 0));

    for (const entry of queue) {
      if (entry.nextAttemptAt && Date.now() < entry.nextAttemptAt) {
        scheduleDrain(entry.nextAttemptAt - Date.now());
        break;
      }

      const route = ROUTES[entry.operation]?.(entry);
      if (!route) {
        // Unknown operation — written by a newer build, or corrupt. Drop it
        // rather than blocking everything behind it.
        await idbDelete("outbox", entry.id).catch(() => {});
        continue;
      }

      try {
        await idbPut("outbox", { ...entry, inFlight: true, inFlightAt: Date.now() });
        const response = await request(route.path, { method: route.method, body: route.body, headers: { 'X-Client-Mutation-Id': entry.clientMutationId } });
        try { await reconcileMutation(entry, response); } catch (reconcileError) {
          notify({ draining: true, lastError: reconcileError?.message || 'SYNC_RECONCILIATION_FAILED' });
          // The server has accepted the mutation. Do not retry it just because
          // the local projection could not be updated; the next reconciliation
          // pass can repair the cache.
        }
        await idbDelete("outbox", entry.id).catch(() => {});
      } catch (error) {
        const attempts = Number(entry.attempts || 0) + 1;
        const retryable = error instanceof ApiError ? error.retryable : true;
        const message = error?.message || "Sync failed.";

        if (!retryable || attempts >= MAX_ATTEMPTS) {
          // Permanent. Move it aside so it is visible in the inspector and
          // recoverable by hand, instead of vanishing silently.
          await idbPut("outboxDeadLetter", {
            ...entry,
            inFlight: false,
            attempts,
            failedAt: Date.now(),
            lastError: message,
          }).catch(() => {});
          await idbDelete("outbox", entry.id).catch(() => {});
          notify({ draining: true, lastError: message });
          continue;
        }

        await idbPut("outbox", {
          ...entry,
          inFlight: false,
          inFlightAt: 0,
          attempts,
          nextAttemptAt: Date.now() + backoffFor(attempts),
          lastError: message,
        }).catch(() => {});
        notify({ draining: false, lastError: message });
        scheduleDrain(backoffFor(attempts));
        break; // preserve ordering
      }
    }
  } finally {
    draining = false;
    notify({ draining: false, pending: await pendingCount() });
  }
}

/** Recover entries left in-flight by a killed tab/app. */
export async function recoverStaleInFlight() {
  try {
    await ensureReady();
    const now = Date.now();
    const rows = await idbGetAll("outbox");
    for (const row of rows) {
      if (row.inFlight && now - Number(row.inFlightAt || 0) > IN_FLIGHT_TIMEOUT_MS) {
        await idbPut("outbox", { ...row, inFlight: false, inFlightAt: 0, nextAttemptAt: 0, lastError: "Recovered stale in-flight mutation." });
      }
    }
  } catch { /* recovery is best effort */ }
}

/** Entries the server permanently rejected, for the inspector / support. */
export async function deadLetters() {
  try {
    await ensureReady();
    return await idbGetAll("outboxDeadLetter");
  } catch {
    return [];
  }
}

export async function discardDeadLetter(id) {
  try {
    await ensureReady();
    await idbDelete("outboxDeadLetter", String(id));
  } catch {
    // nothing to do
  }
}

export async function getEntry(id) {
  try {
    await ensureReady();
    return (await idbGet("outbox", String(id))) || null;
  } catch {
    return null;
  }
}

// Drain on reconnect, and once at startup to pick up anything left from a
// previous session. Both are no-ops while the backend is disabled.
if (typeof window !== "undefined" && isBackendEnabled()) {
  window.addEventListener("online", () => scheduleDrain(500));
  scheduleDrain(1_500);
}
