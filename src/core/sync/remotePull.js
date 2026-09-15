import { request, isBackendEnabled, ApiError } from '../infrastructure/apiClient';
import { idbGet, idbPut } from '../infrastructure/indexeddb';
import { chooseNewer } from './conflict';

const STORE_BY_COLLECTION = {
  listings: 'landlordListings', profiles: 'profiles', messages: 'messages',
  viewingRequests: 'viewingRequests', quoteRequests: 'quoteRequests',
  shareRequests: 'studentShareRequests', studentInterests: 'studentInterests',
  properties: 'properties', contractors: 'contractors',
  registrations: 'landlordRegistrations',
};

export async function pullRemoteChanges({ cursor = null, limit = 200 } = {}) {
  if (!isBackendEnabled()) return { cursor, applied: 0, skipped: 0 };
  const query = new URLSearchParams({ limit: String(limit) });
  if (cursor) query.set('cursor', cursor);
  const response = await request(`/v1/sync/changes?${query.toString()}`);
  const payload = response?.data ?? response ?? {};
  const changes = Array.isArray(payload.changes) ? payload.changes : [];
  let applied = 0;
  let skipped = 0;
  for (const change of changes) {
    const store = STORE_BY_COLLECTION[change.collection || change.type];
    const record = change.record || change.data || (change.recordId ? { id: change.recordId } : null);
    if (!store || !record?.id) { skipped += 1; continue; }
    const current = await idbGet(store, record.id);
    if (change.deleted || change.action === 'delete') {
      // Deletions are only applied when the remote event is newer than the
      // local projection; tombstones are retained in syncMeta for cursors.
      const remoteTime = new Date(change.occurredAt || change.updatedAt || record.updatedAt || 0).getTime();
      const localTime = new Date(current?.updatedAt || 0).getTime();
      if (!current || remoteTime >= localTime) {
        await idbPut('syncMeta', { key: `tombstone:${store}:${record.id}`, updatedAt: change.occurredAt || change.updatedAt || new Date().toISOString() });
        const { idbDelete } = await import('../infrastructure/indexeddb');
        await idbDelete(store, record.id).catch(() => {});
        applied += 1;
      } else skipped += 1;
      continue;
    }
    const winner = chooseNewer(current, { ...record, serverSyncedAt: new Date().toISOString() });
    if (winner) { await idbPut(store, winner); applied += 1; } else skipped += 1;
  }
  if (payload.nextCursor !== undefined) await idbPut('syncMeta', { key: 'remoteCursor', value: payload.nextCursor });
  return { cursor: payload.nextCursor ?? cursor, applied, skipped };
}

export async function syncFromServer() {
  const saved = await idbGet('syncMeta', 'remoteCursor');
  try { return await pullRemoteChanges({ cursor: saved?.value || null }); }
  catch (error) {
    if (error instanceof ApiError && error.status === 404) return { cursor: saved?.value || null, applied: 0, skipped: 0, unsupported: true };
    throw error;
  }
}
