/**
 * Deterministic client-side conflict helpers.
 *
 * Server timestamps remain authoritative. These helpers only decide whether a
 * local record is newer than a cached/server record and produce metadata that
 * can be attached to an outbox mutation.
 */
export function toTimestamp(value) {
  const time = value == null ? NaN : new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function compareUpdatedAt(left, right) {
  const a = toTimestamp(left?.updatedAt ?? left?.updated_at ?? left?.serverUpdatedAt);
  const b = toTimestamp(right?.updatedAt ?? right?.updated_at ?? right?.serverUpdatedAt);
  if (a === b) return 0;
  return a > b ? 1 : -1;
}

export function chooseNewer(localRecord, remoteRecord) {
  if (!localRecord) return remoteRecord || null;
  if (!remoteRecord) return localRecord;
  return compareUpdatedAt(localRecord, remoteRecord) >= 0 ? localRecord : remoteRecord;
}

export function mutationMetadata({ entityId, baseUpdatedAt = null, operation }) {
  return {
    clientMutationId: `${operation || 'mutation'}:${entityId || 'unknown'}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`,
    baseUpdatedAt: baseUpdatedAt || null,
    clientUpdatedAt: new Date().toISOString(),
  };
}
