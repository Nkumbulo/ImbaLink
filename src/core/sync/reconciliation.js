import { idbGet, idbPut, idbDelete } from '../infrastructure/indexeddb';
import { chooseNewer } from './conflict';

const STORE_BY_OPERATION = {
  'listing.create': 'landlordListings', 'listing.update': 'landlordListings', 'listing.delete': 'landlordListings',
  'profile.upsert': 'profiles', 'like.set': 'propertyLikes', 'save.set': 'propertySaves',
  'contractorLike.set': 'contractorLikes', 'viewingRequest.create': 'viewingRequests',
  'message.send': 'messages', 'registration.upsert': null, 'quoteRequest.create': 'quoteRequests',
  'shareRequest.create': 'studentShareRequests', 'shareRequest.update': 'studentShareRequests',
  'shareRequest.delete': 'studentShareRequests', 'studentInterest.set': 'studentInterests',
};

const TEMP_PREFIXES = ['local-', 'outbox:', 'listing_', 'local_'];

function unwrap(response) {
  if (!response) return null;
  return response.data ?? response.result ?? response.item ?? response.record ?? response;
}

function normalizeRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
  return { ...record, updatedAt: record.updatedAt || record.updated_at || new Date().toISOString(), serverSyncedAt: new Date().toISOString() };
}

export function serverRecordFromResponse(response) {
  const value = unwrap(response);
  if (Array.isArray(value)) return normalizeRecord(value[0]);
  return normalizeRecord(value);
}

export function isTemporaryId(id) {
  return TEMP_PREFIXES.some((prefix) => String(id || '').startsWith(prefix));
}

async function reconcileRecord(storeName, localRecord, remoteRecord) {
  if (!storeName || !remoteRecord) return remoteRecord;
  const current = localRecord || await idbGet(storeName, remoteRecord.id);
  const winner = chooseNewer(current, remoteRecord);
  if (winner) await idbPut(storeName, winner);
  return winner;
}

export async function reconcileMutation(entry, response) {
  const remote = serverRecordFromResponse(response);
  const storeName = STORE_BY_OPERATION[entry.operation];
  const resolvedStore = entry.operation === 'registration.upsert'
    ? ({ landlord: 'landlordRegistrations', agent: 'agentRegistrations', company: 'companyRegistrations', contractor: 'contractorRegistrations' }[remote?.kind] || null)
    : storeName;
  if (!remote && entry.operation.endsWith('.delete')) {
    if (resolvedStore && entry.entityId) await idbDelete(resolvedStore, entry.entityId).catch(() => {});
    return { kind: 'deleted', entityId: entry.entityId };
  }
  if (!remote) return { kind: 'ack', entityId: entry.entityId };

  if (resolvedStore) {
    let local = entry.entityId ? await idbGet(resolvedStore, entry.entityId) : null;
    if (!local && entry.operation === 'registration.upsert') {
      const rows = await idbGetAll(resolvedStore).catch(() => []);
      local = rows.find((row) => String(row?.id || '') === String(remote.id || '') || String(row?.userId || '') === String(remote.user_id || '')) || null;
    }
    if (local && remote.id && String(remote.id) !== String(local.id) && isTemporaryId(local.id)) {
      await idbDelete(resolvedStore, local.id).catch(() => {});
    }
    const record = await reconcileRecord(resolvedStore, local, remote);
    return { kind: 'reconciled', entityId: record?.id || remote.id || entry.entityId, record };
  }
  return { kind: 'ack', entityId: remote.id || entry.entityId, record: remote };
}

export async function recordConflict({ operation, entityId, local, remote, reason = 'server-conflict' }) {
  const id = `${operation}:${entityId}:${Date.now()}`;
  const conflict = { id, operation, entityId: String(entityId || ''), local, remote, reason, createdAt: new Date().toISOString(), resolved: false };
  await idbPut('syncConflicts', conflict);
  return conflict;
}

export async function listConflicts() {
  const { idbGetAll } = await import('../infrastructure/indexeddb');
  return idbGetAll('syncConflicts');
}
