import { backend } from '../../application/backend/index.js';

const getViewingRequestStatus = (...args) => backend.viewingRequestRepository?.getViewingRequestStatus?.(...args) ?? null;
const respondToViewingRequest = (...args) => {
  const repository = backend.viewingRequestRepository;
  if (!repository?.respondToViewingRequest) {
    return Promise.reject(new Error('Viewing request backend is not available. Please refresh the app and try again.'));
  }
  return repository.respondToViewingRequest(...args);
};
const subscribeViewingRequestStatuses = (...args) => {
  const repository = backend.viewingRequestRepository;
  if (!repository?.subscribeViewingRequestStatuses) return () => {};
  return repository.subscribeViewingRequestStatuses(...args);
};
import { localCache } from '../../core/cache';
import { VIEWING_TERMINAL_STATUSES } from '../../features/messaging/utils/messageViewModel';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const keyFor = (propertyId, requesterId) => `${String(propertyId || '')}:${String(requesterId || '')}`;
const resolutionCacheKey = (propertyId, requesterId) => `viewing-resolution:${keyFor(propertyId, requesterId)}`;

function isTerminal(status) {
  return VIEWING_TERMINAL_STATUSES.includes(status);
}

// Once a request reaches a terminal status, its resolution (status + date)
// is cached locally via localCache's small-value store (Capacitor
// Preferences — no IndexedDB schema change needed). This is what lets the
// resolved summary in MessageList paint instantly from a cold app start,
// same local-first pattern as messages/conversation status, rather than
// waiting on the Supabase round trip that the still-open initial fetch and
// the 1.5s reconcile loop below also do. Supabase's viewing_requests row
// remains the authoritative source; this is a read-through cache of it.
async function cacheResolutionIfTerminal(propertyId, requesterId, status, updatedAt) {
  if (!isTerminal(status)) return;
  await localCache.setSmall(resolutionCacheKey(propertyId, requesterId), { status, updatedAt: updatedAt || null }).catch(() => {});
}

async function readCachedResolution(propertyId, requesterId) {
  const record = await localCache.getSmall(resolutionCacheKey(propertyId, requesterId)).catch(() => null);
  return record?.value || null;
}

// Viewing-request state is conversation-aware and realtime. A single DM can
// contain requests for several properties, so this hook deliberately tracks
// status per (property, requester) instead of one global status.
export function useViewingRequestBanner({
  currentThreadType,
  currentProperty,
  currentUserId,
  otherParticipantId,
  requestContexts = [],
}) {
  const [requestStatuses, setRequestStatuses] = useState({});
  const [requestResolvedAt, setRequestResolvedAt] = useState({});
  const [busyKey, setBusyKey] = useState(null);
  // Mirrors both maps so the reconcile loop can compare "did anything
  // actually change" without needing requestStatuses/requestResolvedAt in
  // its own effect dependencies (which would restart the poll/subscription
  // on every status change instead of only when the conversation changes).
  const statusesRef = useRef({});
  const resolvedAtRef = useRef({});
  useEffect(() => { statusesRef.current = requestStatuses; }, [requestStatuses]);
  useEffect(() => { resolvedAtRef.current = requestResolvedAt; }, [requestResolvedAt]);

  const contexts = useMemo(() => {
    const base = Array.isArray(requestContexts) ? requestContexts : [];
    if (base.length) return base.filter((c) => c?.property?.id && c?.requesterId);
    if (currentThreadType !== 'property' || !currentProperty?.id) return [];
    const requesterId = String(
      String(currentProperty.ownerUserId || '') === String(currentUserId || '')
        ? (otherParticipantId || '')
        : (currentUserId || '')
    );
    return requesterId ? [{ property: currentProperty, requesterId }] : [];
  }, [requestContexts, currentThreadType, currentProperty, currentUserId, otherParticipantId]);

  const contextKeySet = useMemo(
    () => new Set(contexts.map((c) => keyFor(c.property.id, c.requesterId))),
    [contexts]
  );

  // Applies a batch of { key, status, updatedAt } entries to both state
  // maps in one pass, but ONLY calls setState for a map that actually
  // changed value. The previous version unconditionally spread a new
  // object into state every time this ran (including the 1.5s reconcile
  // poll, forever, for as long as a property thread stayed open) even
  // when every fetched status was identical to what was already shown —
  // a needless re-render of the whole message list every 1.5s, which
  // cascades into every attachment/image in the thread re-rendering too.
  const applyEntries = useCallback((entries, { cache = true } = {}) => {
    let statusesChanged = false;
    let resolvedChanged = false;
    const nextStatuses = { ...statusesRef.current };
    const nextResolvedAt = { ...resolvedAtRef.current };

    for (const { key, status, updatedAt } of entries) {
      if (!status) continue;
      if (nextStatuses[key] !== status) {
        nextStatuses[key] = status;
        statusesChanged = true;
      }
      const resolved = isTerminal(status) ? (updatedAt || null) : null;
      if (nextResolvedAt[key] !== resolved) {
        nextResolvedAt[key] = resolved;
        resolvedChanged = true;
      }
      if (cache) {
        const [propertyId, requesterId] = key.split(':');
        void cacheResolutionIfTerminal(propertyId, requesterId, status, updatedAt);
      }
    }

    if (statusesChanged) { statusesRef.current = nextStatuses; setRequestStatuses(nextStatuses); }
    if (resolvedChanged) { resolvedAtRef.current = nextResolvedAt; setRequestResolvedAt(nextResolvedAt); }
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!contexts.length) {
      statusesRef.current = {};
      resolvedAtRef.current = {};
      setRequestStatuses({});
      setRequestResolvedAt({});
      return undefined;
    }

    statusesRef.current = {};
    resolvedAtRef.current = {};
    setRequestStatuses({});
    setRequestResolvedAt({});

    // Local-first paint: any already-resolved request in this thread shows
    // its cached summary immediately, before the network round trip below
    // completes — the same "cache first, Supabase confirms" shape the rest
    // of messaging already uses.
    Promise.all(
      contexts.map(async (context) => {
        const cached = await readCachedResolution(context.property.id, context.requesterId);
        return cached ? { key: keyFor(context.property.id, context.requesterId), status: cached.status, updatedAt: cached.updatedAt } : null;
      })
    ).then((entries) => {
      if (cancelled) return;
      applyEntries(entries.filter(Boolean), { cache: false });
    });

    Promise.all(
      contexts.map(async (context) => {
        const result = await getViewingRequestStatus(context.property.id, context.requesterId);
        return { key: keyFor(context.property.id, context.requesterId), status: result?.status || null, updatedAt: result?.updatedAt || null };
      })
    ).then((entries) => {
      if (cancelled) return;
      applyEntries(entries);
    });

    // Status changes are the authoritative realtime event for declines and
    // cancellations. Do not wait for a message INSERT or a page refresh.
    const unsubscribe = subscribeViewingRequestStatuses({
      propertyIds: contexts.map((c) => c.property.id),
      requesterIds: contexts.map((c) => c.requesterId),
      onChange: ({ propertyId, requesterId, status, updatedAt }) => {
        const key = keyFor(propertyId, requesterId);
        if (!contextKeySet.has(key)) return;
        if (!status) return;
        applyEntries([{ key, status, updatedAt }]);
      },
    });

    // Keep a lightweight reconciliation loop while the conversation is open.
    // Realtime remains the primary path, but this guarantees the tenant sees
    // a landlord decision even when the Supabase Realtime publication or
    // connection temporarily drops. Only the small set of request rows in
    // this conversation is checked — and, per applyEntries above, a poll
    // that finds nothing new no longer touches React state at all.
    const reconcile = async () => {
      const entries = await Promise.all(
        contexts.map(async (context) => {
          const result = await getViewingRequestStatus(context.property.id, context.requesterId);
          return { key: keyFor(context.property.id, context.requesterId), status: result?.status || null, updatedAt: result?.updatedAt || null };
        })
      );
      if (cancelled) return;
      applyEntries(entries);
    };
    const reconcileTimer = setInterval(() => { void reconcile(); }, 1500);

    return () => {
      cancelled = true;
      clearInterval(reconcileTimer);
      unsubscribe();
    };
  }, [contexts, contextKeySet, applyEntries]);

  const getStatus = useCallback((propertyId, requesterId) => {
    return requestStatuses[keyFor(propertyId, requesterId)] || null;
  }, [requestStatuses]);

  const getResolvedAt = useCallback((propertyId, requesterId) => {
    return requestResolvedAt[keyFor(propertyId, requesterId)] || null;
  }, [requestResolvedAt]);

  const handleViewingResponse = useCallback(async (status, propertyId = null, requesterId = null) => {
    const property = contexts.find((c) => String(c.property.id) === String(propertyId || currentProperty?.id));
    const targetPropertyId = property?.property?.id || propertyId || currentProperty?.id;
    const targetRequesterId = property?.requesterId || requesterId || otherParticipantId || currentUserId;
    const key = keyFor(targetPropertyId, targetRequesterId);
    if (!targetPropertyId || !targetRequesterId || busyKey) return;

    setBusyKey(key);
    // Optimistic state makes the UI instant; the realtime event and response
    // result then reconcile it with Supabase. The optimistic resolvedAt is
    // "now" — close enough for a day-granularity date, and corrected by the
    // real updated_at once the RPC result (or realtime/reconcile) arrives.
    applyEntries([{ key, status, updatedAt: new Date().toISOString() }]);
    try {
      const result = await respondToViewingRequest(targetPropertyId, targetRequesterId, status);
      applyEntries([{ key, status: result?.status || status, updatedAt: result?.updated_at || new Date().toISOString() }]);
    } catch (error) {
      applyEntries([{ key, status: null, updatedAt: null }]);
      alert(error?.message || "Could not update the viewing request.");
    } finally {
      setBusyKey(null);
    }
  }, [contexts, currentProperty?.id, otherParticipantId, currentUserId, busyKey, applyEntries]);

  const currentContext = contexts.find((c) => String(c.property.id) === String(currentProperty?.id)) || contexts[contexts.length - 1] || null;
  const viewingRequestStatus = currentContext ? getStatus(currentContext.property.id, currentContext.requesterId) : null;
  const ownerId = currentContext?.property?.ownerUserId
    || currentContext?.property?.owner_user_id
    || currentContext?.property?.landlordUserId
    || currentContext?.property?.landlord_user_id
    || null;
  const isPropertyOwner = currentThreadType === "property"
    && !!currentContext?.property
    && String(ownerId || "") === String(currentUserId || "");
  const viewingRequesterId = currentContext?.requesterId || null;

  return {
    viewingRequestStatus,
    viewingRequestStatuses: requestStatuses,
    getViewingRequestStatus: getStatus,
    getViewingRequestResolvedAt: getResolvedAt,
    viewingRequestBusy: !!busyKey,
    viewingRequestBusyKey: busyKey,
    isPropertyOwner,
    viewingRequesterId,
    handleViewingResponse,
  };
}
