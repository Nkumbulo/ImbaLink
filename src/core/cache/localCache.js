/**
 * Native-first local cache for the Capacitor app.
 *
 * Small, frequently-read state lives in @capacitor/preferences.
 * Larger message/property cache blobs use IndexedDB on web and iOS, while
 * Android may use the native SQLite plugin. iOS deliberately stays on
 * IndexedDB because it avoids native bridge stalls in WKWebView.
 *
 * Supabase remains the source of truth. Every cache read returns age/staleness
 * metadata and callers should always refresh stale records in the background.
 */
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { idbGet, idbPut, idbDelete } from '../infrastructure/indexeddb';

const CACHE_VERSION = 1;
const DB_NAME = 'imbalink_local_cache';
const TABLE = 'cache_records';
const sqliteState = { connection: null, db: null, promise: null, queue: Promise.resolve() };

export const CACHE_TTL = Object.freeze({
  conversations: 2 * 60 * 1000,
  messages: 5 * 60 * 1000,
  conversationStatus: 30 * 24 * 60 * 60 * 1000,
  propertyFeed: 10 * 60 * 1000,
  properties: 15 * 60 * 1000,
});

function isNative() {
  try {
    return Capacitor.getPlatform() !== 'web';
  } catch {
    return false;
  }
}

function isIOS() {
  try {
    return Capacitor.getPlatform() === 'ios';
  } catch {
    return false;
  }
}

function preferenceKey(key) {
  return `imbalink:cache:${CACHE_VERSION}:${String(key)}`;
}

function sqliteKey(namespace, key) {
  return `${namespace}:${String(key)}`;
}

async function getSQLite() {
  // WKWebView already provides a persistent IndexedDB implementation.
  // Keep the native SQLite plugin out of the iOS hot path: native SQLite
  // bridge calls can block/stall the WebView when several cache reads/writes
  // happen around Realtime + keyboard events. Android can continue using the
  // native store.
  if (!isNative() || isIOS()) return null;
  if (sqliteState.db) return sqliteState.db;
  if (sqliteState.promise) return sqliteState.promise;

  sqliteState.promise = (async () => {
    const { CapacitorSQLite, SQLiteConnection } = await import('@capacitor-community/sqlite');
    const connection = new SQLiteConnection(CapacitorSQLite);
    const db = await connection.createConnection(DB_NAME, false, 'no-encryption', 1, false);
    await db.open();
    await db.execute(`
      CREATE TABLE IF NOT EXISTS ${TABLE} (
        cache_key TEXT PRIMARY KEY NOT NULL,
        namespace TEXT NOT NULL,
        value_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_${TABLE}_namespace ON ${TABLE}(namespace);
      CREATE INDEX IF NOT EXISTS idx_${TABLE}_updated ON ${TABLE}(updated_at);
    `);
    sqliteState.connection = connection;
    sqliteState.db = db;
    return db;
  })().catch((error) => {
    sqliteState.promise = null;
    console.warn('ImbaLink SQLite cache unavailable; using IndexedDB fallback.', error);
    return null;
  });

  return sqliteState.promise;
}

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function parseRecord(row) {
  if (!row?.value_json) return null;
  try {
    return {
      value: JSON.parse(row.value_json),
      cachedAt: Number(row.updated_at) || 0,
    };
  } catch {
    return null;
  }
}

// @capacitor-community/sqlite uses a single native connection. WKWebView can
// dispatch several JS promises at once, but overlapping query/run calls on the
// same connection are a common source of stalls on iOS. Serialize ALL native
// cache operations. This is deliberately kept inside the cache service so the
// rest of ImbaLink remains unchanged.
function withSQLiteLock(task) {
  const run = sqliteState.queue.then(task, task);
  sqliteState.queue = run.catch(() => {});
  return run;
}

async function getLarge(namespace, key) {
  return withSQLiteLock(async () => {
    const db = await getSQLite();
    if (db) {
      const result = await db.query(
        `SELECT value_json, updated_at FROM ${TABLE} WHERE cache_key = ? LIMIT 1`,
        [sqliteKey(namespace, key)]
      );
      return parseRecord(result?.values?.[0]);
    }

    const row = await idbGet('localCache', sqliteKey(namespace, key)).catch(() => null);
    return row ? { value: row.value, cachedAt: Number(row.updatedAt) || 0 } : null;
  });
}

async function setLarge(namespace, key, value) {
  const valueJson = safeJson(value);
  if (valueJson == null) return false;
  const cachedAt = Date.now();
  return withSQLiteLock(async () => {
    const db = await getSQLite();
    if (db) {
      await db.run(
        `INSERT OR REPLACE INTO ${TABLE}(cache_key, namespace, value_json, updated_at) VALUES (?, ?, ?, ?)`,
        [sqliteKey(namespace, key), namespace, valueJson, cachedAt]
      );
      return true;
    }

    await idbPut('localCache', {
      id: sqliteKey(namespace, key),
      value,
      updatedAt: cachedAt,
    }).catch(() => {});
    return true;
  });
}

async function removeLarge(namespace, key) {
  return withSQLiteLock(async () => {
    const db = await getSQLite();
    if (db) {
      await db.run(`DELETE FROM ${TABLE} WHERE cache_key = ?`, [sqliteKey(namespace, key)]);
      return;
    }
    await idbDelete('localCache', sqliteKey(namespace, key)).catch(() => {});
  });
}

async function getSmall(key) {
  const { value } = await Preferences.get({ key: preferenceKey(key) });
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return null;
    return { value: parsed.value, cachedAt: Number(parsed.cachedAt) || 0 };
  } catch {
    return null;
  }
}

async function setSmall(key, value) {
  const valueJson = safeJson({ value, cachedAt: Date.now() });
  if (valueJson == null) return false;
  await Preferences.set({ key: preferenceKey(key), value: valueJson });
  return true;
}

async function getRecord(namespace, key, large = false) {
  return large ? getLarge(namespace, key) : getSmall(`${namespace}:${key}`);
}

async function setRecord(namespace, key, value, large = false) {
  return large ? setLarge(namespace, key, value) : setSmall(`${namespace}:${key}`, value);
}

function withFreshness(record, maxAge) {
  if (!record) return { value: null, cachedAt: 0, age: Infinity, stale: true, hasCache: false };
  const age = Math.max(0, Date.now() - record.cachedAt);
  return { ...record, age, stale: age > maxAge, hasCache: true };
}

export const localCache = {
  async getConversations(userId) {
    if (!userId) return withFreshness(null, CACHE_TTL.conversations);
    return withFreshness(await getRecord('conversations', userId), CACHE_TTL.conversations);
  },
  async setConversations(userId, conversations) {
    if (!userId) return false;
    return setRecord('conversations', userId, conversations);
  },
  async getMessages(userId, conversationId) {
    if (!userId || !conversationId) return withFreshness(null, CACHE_TTL.messages);
    return withFreshness(await getRecord('messages', `${userId}:${conversationId}`, true), CACHE_TTL.messages);
  },
  async setMessages(userId, conversationId, messages) {
    if (!userId || !conversationId) return false;
    return setRecord('messages', `${userId}:${conversationId}`, messages, true);
  },
  async getConversationStatus(userId, conversationId) {
    if (!userId || !conversationId) return withFreshness(null, CACHE_TTL.conversationStatus);
    return withFreshness(
      await getRecord('conversation-status', `${userId}:${conversationId}`),
      CACHE_TTL.conversationStatus
    );
  },
  async setConversationStatus(userId, conversationId, status) {
    if (!userId || !conversationId || !status) return false;
    return setRecord('conversation-status', `${userId}:${conversationId}`, status);
  },
  async getPropertyPage(cacheKey) {
    return withFreshness(await getRecord('property-feed', cacheKey, true), CACHE_TTL.propertyFeed);
  },
  async setPropertyPage(cacheKey, value) {
    return setRecord('property-feed', cacheKey, value, true);
  },
  async getProperty(propertyId) {
    if (!propertyId) return withFreshness(null, CACHE_TTL.properties);
    return withFreshness(await getRecord('property', propertyId, true), CACHE_TTL.properties);
  },
  async setProperty(propertyId, property) {
    if (!propertyId || !property) return false;
    return setRecord('property', propertyId, property, true);
  },
  async removeProperty(propertyId) {
    if (!propertyId) return;
    await removeLarge('property', propertyId);
  },
  async getSmall(key, maxAge = CACHE_TTL.conversations) {
    return withFreshness(await getSmall(key), maxAge);
  },
  async setSmall(key, value) {
    return setSmall(key, value);
  },
  async removeSmall(key) {
    await Preferences.remove({ key: preferenceKey(key) });
  },
};
