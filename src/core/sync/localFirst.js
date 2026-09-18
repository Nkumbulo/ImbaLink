import { idbGetAll, idbPut, idbDelete } from '../infrastructure/indexeddb';
import { enqueue } from './outbox';
import { newId } from '../../services/ids';

/**
 * Small local-first mutation primitives. Domain modules own business rules;
 * this module only guarantees that the local projection is written before the
 * server intent is queued.
 */
export async function putLocal(storeName, value, { operation, entityId = value?.id, payload = value, dedupeKey = null } = {}) {
  await idbPut(storeName, value);
  await enqueue(operation, { entityId, payload, dedupeKey });
  return value;
}

export async function deleteLocal(storeName, key, { operation, entityId = key, payload = null, dedupeKey = null } = {}) {
  await idbDelete(storeName, key);
  await enqueue(operation, { entityId, payload, dedupeKey });
  return key;
}

export async function setLocalRelation(storeName, { userId, itemId, liked, extra = {}, operation, routeEntityId = itemId }) {
  const id = `${String(userId)}:${String(itemId)}`;
  if (liked) {
    const row = { id, userId: String(userId), itemId: String(itemId), liked: true, updatedAt: new Date().toISOString(), ...extra };
    await idbPut(storeName, row);
    await enqueue(operation, { entityId: routeEntityId, payload: { ...row, liked: true }, dedupeKey: `${operation}:${userId}:${itemId}` });
  } else {
    await idbDelete(storeName, id);
    await enqueue(operation, { entityId: routeEntityId, payload: { userId: String(userId), itemId: String(itemId), liked: false }, dedupeKey: `${operation}:${userId}:${itemId}` });
  }
}

export async function localRelationCount(storeName, itemId) {
  const rows = await idbGetAll(storeName).catch(() => []);
  return rows.filter((row) => String(row.itemId) === String(itemId) && row.liked !== false).length;
}

export function localMutationId(prefix = 'mutation') {
  return newId(prefix);
}
