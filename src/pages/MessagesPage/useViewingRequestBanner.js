import { getViewingRequestStatus, respondToViewingRequest, subscribeViewingRequestStatuses } from '../../core/data/domains/interactions.js';
import { useCallback, useEffect, useMemo, useState } from "react";

const keyFor = (propertyId, requesterId) => `${String(propertyId || '')}:${String(requesterId || '')}`;

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
  const [busyKey, setBusyKey] = useState(null);

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

  useEffect(() => {
    let cancelled = false;
    if (!contexts.length) {
      setRequestStatuses({});
      return undefined;
    }

    setRequestStatuses({});
    Promise.all(
      contexts.map(async (context) => {
        const status = await getViewingRequestStatus(context.property.id, context.requesterId);
        return [keyFor(context.property.id, context.requesterId), status];
      })
    ).then((entries) => {
      if (cancelled) return;
      setRequestStatuses(Object.fromEntries(entries.filter(([, status]) => status)));
    });

    // Status changes are the authoritative realtime event for declines and
    // cancellations. Do not wait for a message INSERT or a page refresh.
    const unsubscribe = subscribeViewingRequestStatuses({
      propertyIds: contexts.map((c) => c.property.id),
      requesterIds: contexts.map((c) => c.requesterId),
      onChange: ({ propertyId, requesterId, status }) => {
        const key = keyFor(propertyId, requesterId);
        if (!contextKeySet.has(key)) return;
        setRequestStatuses((prev) => ({ ...prev, [key]: status || null }));
      },
    });

    // Keep a lightweight reconciliation loop while the conversation is open.
    // Realtime remains the primary path, but this guarantees the tenant sees
    // a landlord decision even when the Supabase Realtime publication or
    // connection temporarily drops. Only the small set of request rows in
    // this conversation is checked.
    const reconcile = async () => {
      const entries = await Promise.all(
        contexts.map(async (context) => {
          const status = await getViewingRequestStatus(context.property.id, context.requesterId);
          return [keyFor(context.property.id, context.requesterId), status];
        })
      );
      if (cancelled) return;
      setRequestStatuses((prev) => {
        const next = { ...prev };
        for (const [key, status] of entries) {
          if (status) next[key] = status;
        }
        return next;
      });
    };
    const reconcileTimer = setInterval(() => { void reconcile(); }, 1500);

    return () => {
      cancelled = true;
      clearInterval(reconcileTimer);
      unsubscribe();
    };
  }, [contexts, contextKeySet]);

  const getStatus = useCallback((propertyId, requesterId) => {
    return requestStatuses[keyFor(propertyId, requesterId)] || null;
  }, [requestStatuses]);

  const handleViewingResponse = useCallback(async (status, propertyId = null, requesterId = null) => {
    const property = contexts.find((c) => String(c.property.id) === String(propertyId || currentProperty?.id));
    const targetPropertyId = property?.property?.id || propertyId || currentProperty?.id;
    const targetRequesterId = property?.requesterId || requesterId || otherParticipantId || currentUserId;
    const key = keyFor(targetPropertyId, targetRequesterId);
    if (!targetPropertyId || !targetRequesterId || busyKey) return;

    setBusyKey(key);
    // Optimistic state makes the UI instant; the realtime event and response
    // result then reconcile it with Supabase.
    setRequestStatuses((prev) => ({ ...prev, [key]: status }));
    try {
      const result = await respondToViewingRequest(targetPropertyId, targetRequesterId, status);
      setRequestStatuses((prev) => ({ ...prev, [key]: result?.status || status }));
    } catch (error) {
      setRequestStatuses((prev) => ({ ...prev, [key]: null }));
      alert(error?.message || "Could not update the viewing request.");
    } finally {
      setBusyKey(null);
    }
  }, [contexts, currentProperty?.id, otherParticipantId, currentUserId, busyKey]);

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
    viewingRequestBusy: !!busyKey,
    viewingRequestBusyKey: busyKey,
    isPropertyOwner,
    viewingRequesterId,
    handleViewingResponse,
  };
}
