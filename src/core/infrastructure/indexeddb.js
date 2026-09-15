/**
 * ImbaLink offline database engine.
 *
 * This is the only file in the project that talks to IndexedDB directly.
 * `services/database.js` — the same data-access layer every page/hook
 * already calls through `db.*` — uses the helpers exported here instead of
 * localStorage. Nothing else should import this module; going through
 * services/database.js keeps a single source of truth for how data flows.
 *
 * This file is deliberately "dumb": it knows about object stores, keys and
 * indexes, but nothing about what a "like" or a "share request" means —
 * that business logic (normalizing old records, deciding what belongs in
 * which store) lives in services/database.js. Swapping IndexedDB for a
 * real backend later means rewriting the functions in services/database.js
 * to call that backend instead of the helpers here — nothing above that
 * layer (hooks, pages, components) needs to change.
 *
 * No new dependency was added for this — everything below is the native
 * browser IndexedDB API wrapped in small promise-based helpers.
 */

const DB_NAME = "imbalink_db";
const DB_VERSION = 8;

// Every object store the app needs, and how it's keyed/indexed. Kept in one
// place so the upgrade handler and the rest of this file agree, and so a
// future version bump only means adding to this map plus an
// `if (oldVersion < N)` block below — not deleting/recreating the database.
//
// v1 -> v2 note: `propertyLikes`/`propertySaves`/`contractorLikes`/
// `viewingRequests`/`messages` used to live nested inside one big
// `userState` blob record (one per account). They're now their own stores,
// each record individually keyed (`${userId}:${itemId}`) and indexed by
// `userId` -- a like/save/message is now a normal single-record write, not
// a read-modify-write against a shared blob. `userState` and the old
// singular `profile` store are kept (not deleted) purely as one-time
// migration sources -- see decomposeLegacyState()/decomposeLegacyProfile()
// in services/database.js, which read them once and fan their contents
// into the stores below, then never touch them again.
const STORES = {
  properties: { keyPath: "id" },
  contractors: { keyPath: "id" },
  universities: { keyPath: "id", indexes: [["city", "city"], ["active", "active"]] },
  landlordListings: { keyPath: "id", indexes: [["userId", "userId"]] },
  contractorRegistrations: { keyPath: "id", indexes: [["userId", "userId"]] },
  landlordRegistrations: { keyPath: "userId" },
  agentRegistrations: { keyPath: "userId" },
  companyRegistrations: { keyPath: "userId" },
  proRegistrations: { keyPath: "userId" },
  quoteRequests: { keyPath: "id" },
  studentShareRequests: { keyPath: "id", indexes: [["userId", "userId"]] },
  studentInterests: { keyPath: "id", indexes: [["userId", "userId"]] },
  propertyLikes: { keyPath: "id", indexes: [["userId", "userId"]] },
  propertySaves: { keyPath: "id", indexes: [["userId", "userId"]] },
  contractorLikes: { keyPath: "id", indexes: [["userId", "userId"]] },
  viewingRequests: { keyPath: "id", indexes: [["userId", "userId"]] },
  messages: { keyPath: "id", indexes: [["userId", "userId"]] },
  // `profiles` (plural) is the real, account-isolated profile store --
  // keyed by userId, with an index for the "log in by phone" lookup that
  // used to live in AuthContext's own localStorage registry. The index is
  // named "phone" but points at `phoneNormalized` (digits-only), not the
  // raw `phone` field -- so a lookup by typed digits matches a profile
  // regardless of how its phone number was originally formatted/spaced.
  profiles: { keyPath: "userId", indexes: [["phone", "phoneNormalized"]] },
  // Exactly one record, id fixed to "current" -- unlike `profiles`, this is
  // correct as a singleton: only one account can be the active session in
  // a given browser tab at a time, so there's nothing to isolate.
  session: { keyPath: "id" },
  messageReadCounts: { keyPath: "userId" },
  localCache: { keyPath: "id" },
  // v5 -> v6 additions. All three are new stores, created by the same
  // unconditional loop in onupgradeneeded that created every store before
  // them -- no existing store is touched, so upgrading a browser that
  // already has development data in it only adds empty stores.
  //
  // `media`: the original (downscaled) Blob for each uploaded listing photo,
  // held until object storage exists to receive it. Indexed by the record it
  // belongs to so a listing's photos can be found without scanning.
  // (No index on `uploaded`: a boolean is not a valid IndexedDB key, so
  // such an index would silently contain nothing. Pending uploads are
  // filtered in JS instead -- the set is small by construction.)
  media: { keyPath: "id", indexes: [["ownerId", "ownerId"]] },
  // `outbox`: pending server writes (see core/sync/outbox.js). Stays
  // empty until VITE_API_BASE_URL is configured.
  outbox: { keyPath: "id", indexes: [["operation", "operation"]] },
  // `outboxDeadLetter`: writes the server permanently rejected. Kept rather
  // than dropped so a failed sync is inspectable instead of invisible.
  outboxDeadLetter: { keyPath: "id" },
  // Sync metadata is device-local and contains no auth secrets.
  syncMeta: { keyPath: "key" },
  syncConflicts: { keyPath: "id", indexes: [["entityId", "entityId"], ["createdAt", "createdAt"]] },
  // Deprecated (v1) stores, kept only as one-time migration sources -- see
  // the note above. Nothing writes to these going forward.
  userState: { keyPath: "userId" },
  profile: { keyPath: "id" },
  meta: { keyPath: "key" },
};

// Legacy localStorage keys this app used before the IndexedDB migration.
// Shared between the one-time import (below) and resetDatabase() (so a
// reset can't be silently undone by the next load re-importing this data).
const LEGACY_LOCALSTORAGE_KEYS = [
  "imbalink_user_state_v2",
  "imbalink_user_state_v1",
  "rooma_landlord_listings_v2",
  "rooma_landlord_listings_v1",
  "imbalink_contractor_registrations_v1",
  "imbalink_landlord_registrations_v1",
  "imbalink_agent_registrations_v1",
  "imbalink_company_registrations_v1",
  "imbalink_quote_requests_v1",
  "imbalink_student_share_requests_v1",
  "imbalink_profile_v1",
  "imbalink_message_read_counts",
  "imbalink_session_v1",
  "imbalink_profiles_registry_v1",
];

/**
 * The names of every object store this version defines. Used by the
 * dev-only inspector (through the read-only passthroughs in
 * services/database.js -- nothing outside services/ imports this file).
 */
export function storeNames() {
  return Object.keys(STORES);
}

function supportsIndexedDb() {
  return typeof indexedDB !== "undefined";
}

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;

  if (!supportsIndexedDb()) {
    return Promise.reject(new Error("IndexedDB is not available in this environment."));
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const database = request.result;
      const oldVersion = event.oldVersion || 0;
      const transaction = event.currentTarget.transaction;

      // Create every store this version needs that doesn't exist yet. Safe
      // to run unconditionally for both a brand-new database (oldVersion 0)
      // and an upgrade from an earlier version (which already has some
      // stores) -- createObjectStore only runs for stores that aren't
      // there yet, and nothing here ever deletes an existing store.
      Object.entries(STORES).forEach(([name, config]) => {
        if (database.objectStoreNames.contains(name)) return;
        const objectStore = database.createObjectStore(name, { keyPath: config.keyPath });
        (config.indexes || []).forEach(([indexName, keyPath]) => {
          objectStore.createIndex(indexName, keyPath, { unique: false });
        });
      });

      // v2 -> v3: `profiles`' "phone" index was pointed at the raw/display
      // `phone` field instead of a normalized one, so looking a profile up
      // by typed digits could miss a record stored with spacing/punctuation.
      // Re-point the index at `phoneNormalized`; the index NAME stays
      // "phone" so findProfileByPhone()'s idbGetAllByIndex(..., "phone", …)
      // call doesn't need to change.
      if (oldVersion > 0 && oldVersion < 3 && database.objectStoreNames.contains("profiles")) {
        const profilesStore = transaction.objectStore("profiles");
        if (profilesStore.indexNames.contains("phone")) profilesStore.deleteIndex("phone");
        profilesStore.createIndex("phone", "phoneNormalized", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open the ImbaLink offline database."));
    request.onblocked = () => {
      console.warn("ImbaLink offline database upgrade is blocked by another open tab.");
    };
  }).catch((error) => {
    dbPromise = null; // don't cache a permanent failure -- allow retry on the next call
    throw error;
  });

  return dbPromise;
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed."));
  });
}

async function store(name, mode) {
  const database = await openDb();
  return database.transaction(name, mode).objectStore(name);
}

export async function idbGet(storeName, key) {
  if (key == null) return undefined;
  const objectStore = await store(storeName, "readonly");
  return requestToPromise(objectStore.get(key));
}

export async function idbGetAll(storeName) {
  const objectStore = await store(storeName, "readonly");
  return requestToPromise(objectStore.getAll());
}

export async function idbGetAllByIndex(storeName, indexName, value) {
  const objectStore = await store(storeName, "readonly");
  return requestToPromise(objectStore.index(indexName).getAll(value));
}

export async function idbPut(storeName, value) {
  const objectStore = await store(storeName, "readwrite");
  return requestToPromise(objectStore.put(value));
}

export async function idbDelete(storeName, key) {
  const objectStore = await store(storeName, "readwrite");
  return requestToPromise(objectStore.delete(key));
}

export async function idbClear(storeName) {
  const objectStore = await store(storeName, "readwrite");
  return requestToPromise(objectStore.clear());
}

export async function idbCount(storeName) {
  const objectStore = await store(storeName, "readonly");
  return requestToPromise(objectStore.count());
}

// --- Generic "run this exactly once" helper --------------------------
// Used for both the legacy-localStorage import and services/database.js's
// userState/profile decomposition -- same "check a meta flag, run, mark
// done" shape, so it's a single reusable primitive instead of two copies.
export async function runOnce(flagName, task) {
  let already = false;
  try {
    const record = await idbGet("meta", flagName);
    already = Boolean(record?.value);
  } catch {
    // If we can't even check, fall through and try to run -- worst case
    // this re-runs a migration, which every step below is written to
    // tolerate safely (idempotent puts, not blind appends).
  }
  if (already) return;
  try {
    await task();
  } finally {
    await idbPut("meta", { key: flagName, value: true }).catch(() => {});
  }
}

// --- One-time seed + legacy localStorage import -----------------------
// Runs at most once per browser. Imports whatever real development data
// already exists in localStorage into the OLD-shaped `userState`/`profile`
// stores (services/database.js then decomposes those into the normalized
// stores -- see decomposeLegacyState() there). This function only ever
// copies raw data across; it doesn't interpret it, keeping this file
// business-logic-free.
async function migrateLegacyLocalStorage() {
  if (typeof localStorage === "undefined") return;

  await runOnce("migratedFromLocalStorage", async () => {
    // The big per-user state blob used to live under `imbalink_user_state_v2`
    // (or `::<userId>`-suffixed per account, or the old v1 key for the very
    // first profile that ever used this device). Sweep every matching key.
    const stateKeyPattern = /^imbalink_user_state_v[12](::(.+))?$/;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const match = key.match(stateKeyPattern);
      if (!match) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        const userId = match[2] || parsed?.user?.id || null;
        if (!userId) continue;
        const existing = await idbGet("userState", userId);
        if (!existing) await idbPut("userState", { ...parsed, userId });
      } catch {
        // Corrupt legacy record -- skip it rather than fail the whole migration.
      }
    }

    // Flat-array collections, keyed by their own `id`.
    const arrayMigrations = [
      ["rooma_landlord_listings_v2", "landlordListings"],
      ["rooma_landlord_listings_v1", "landlordListings"],
      ["imbalink_contractor_registrations_v1", "contractorRegistrations"],
    ];
    for (const [lsKey, storeName] of arrayMigrations) {
      const raw = localStorage.getItem(lsKey);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        const records = Array.isArray(parsed) ? parsed : [];
        for (const record of records) {
          if (record && record.id != null) await idbPut(storeName, record);
        }
      } catch {
        // Corrupt legacy record -- skip.
      }
    }

    // `{ [id]: record }` map collections, keyed by their own `id`.
    const mapMigrations = [
      ["imbalink_quote_requests_v1", "quoteRequests"],
      ["imbalink_student_share_requests_v1", "studentShareRequests"],
    ];
    for (const [lsKey, storeName] of mapMigrations) {
      const raw = localStorage.getItem(lsKey);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        const records = parsed && typeof parsed === "object" ? Object.values(parsed) : [];
        for (const record of records) {
          if (record && record.id != null) await idbPut(storeName, record);
        }
      } catch {
        // Corrupt legacy record -- skip.
      }
    }

    // `{ [userId]: record }` map collections, one record per account.
    const byUserIdMigrations = [
      ["imbalink_landlord_registrations_v1", "landlordRegistrations"],
      ["imbalink_agent_registrations_v1", "agentRegistrations"],
      ["imbalink_company_registrations_v1", "companyRegistrations"],
    ];
    for (const [lsKey, storeName] of byUserIdMigrations) {
      const raw = localStorage.getItem(lsKey);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          for (const [userId, record] of Object.entries(parsed)) {
            if (record) await idbPut(storeName, { ...record, userId: record.userId || userId });
          }
        }
      } catch {
        // Corrupt legacy record -- skip.
      }
    }

    const profileRaw = localStorage.getItem("imbalink_profile_v1");
    if (profileRaw) {
      try {
        const parsed = JSON.parse(profileRaw);
        if (parsed) await idbPut("profile", { id: "current", ...parsed });
      } catch {
        // Corrupt legacy record -- skip.
      }
    }

    // Auth's session + phone->profile registry -- imported directly into
    // the new `session`/`profiles` stores (not an old-shaped holding
    // store; those two concepts didn't exist in the pre-migration blob
    // shape, so there's nothing for database.js's decompose step to do
    // here). `profiles` needs a `phoneNormalized` field for its lookup
    // index (see idb.js's STORES config) -- the legacy registry never had
    // that field, so it's derived here at import time rather than left
    // for the index to silently never match.
    const sessionRaw = localStorage.getItem("imbalink_session_v1");
    if (sessionRaw) {
      try {
        const parsed = JSON.parse(sessionRaw);
        if (parsed) await idbPut("session", { id: "current", ...parsed });
      } catch {
        // Corrupt legacy record -- skip.
      }
    }

    const registryRaw = localStorage.getItem("imbalink_profiles_registry_v1");
    if (registryRaw) {
      try {
        const parsed = JSON.parse(registryRaw);
        if (parsed && typeof parsed === "object") {
          for (const profileRecord of Object.values(parsed)) {
            if (profileRecord?.id) {
              const existing = await idbGet("profiles", String(profileRecord.id));
              if (!existing) {
                const rawPhone = String(profileRecord.phone || "").trim();
                await idbPut("profiles", {
                  ...profileRecord,
                  userId: String(profileRecord.id),
                  phone: rawPhone,
                  phoneNormalized: rawPhone.replace(/\D/g, ""),
                });
              }
            }
          }
        }
      } catch {
        // Corrupt legacy record -- skip.
      }
    }
  });
}

async function fetchJsonWithBundledFallback(url, bundledImport) {
  try {
    const res = await fetch(url).catch(() => null);
    if (res?.ok) {
      const json = await res.json();
      return Array.isArray(json) ? json : (Array.isArray(json?.properties) ? json.properties : Array.isArray(json?.contractors) ? json.contractors : []);
    }
  } catch {
    // fall through to bundled copy
  }
  try {
    const bundled = await bundledImport();
    const json = bundled.default || bundled;
    return Array.isArray(json) ? json : (Array.isArray(json?.properties) ? json.properties : Array.isArray(json?.contractors) ? json.contractors : []);
  } catch {
    return [];
  }
}

async function seedOrSyncCatalog(storeName, fetchItems) {
  // Development catalogs are bundled with the app.  Do not treat an existing
  // browser store as authoritative: older builds may have seeded only part
  // of the current catalog (for example 24 records). Reconcile the bundled
  // catalog by upserting every current record, while leaving user-created
  // stores untouched.
  const items = await fetchItems();
  if (!Array.isArray(items) || items.length === 0) return;

  for (const item of items) {
    if (item && item.id != null) await idbPut(storeName, item);
  }
}

// Resolves once the database is open and the raw legacy-localStorage import
// has run. Seeding the read-only catalogs and decomposing legacy records
// into the normalized stores are services/database.js's job (business
// logic); this only guarantees the database itself is open and the raw
// import has happened.
let readyPromise = null;

export function ensureReady() {
  if (!readyPromise) {
    readyPromise = (async () => {
      await openDb();
      await migrateLegacyLocalStorage();
      await seedOrSyncCatalog("properties", () =>
        fetchJsonWithBundledFallback("../../data/properties.json", () => import("../../data/properties.json"))
      );
      await seedOrSyncCatalog("contractors", () =>
        fetchJsonWithBundledFallback("../../data/contractors.json", () => import("../../data/contractors.json"))
      );
      await seedOrSyncCatalog("universities", () =>
        fetchJsonWithBundledFallback("../../data/universities.json", () => import("../../data/universities.json"))
      );
    })().catch((error) => {
      readyPromise = null; // allow a retry on the next call rather than caching a permanent failure
      console.error("ImbaLink offline database failed to initialize:", error);
      throw error;
    });
  }
  return readyPromise;
}

// --- Development-only reset tool ---------------------------------------
// Clears every IndexedDB store AND the legacy localStorage keys this app
// used before the IndexedDB migration -- clearing IndexedDB alone isn't a
// real reset, since the very next load would re-import that old
// localStorage data right back in. Only ImbaLink's own known keys are
// touched; nothing else in localStorage (or any other site data) is
// cleared. Never wired into any production UI -- callable only from the
// browser console during development, and only exposed when Vite's dev
// flag is on:
//   window.__IMBALINK_RESET_DB__()
export async function resetDatabase() {
  await openDb();
  for (const name of Object.keys(STORES)) {
    await idbClear(name).catch(() => {});
  }
  if (typeof localStorage !== "undefined") {
    for (const key of LEGACY_LOCALSTORAGE_KEYS) {
      try {
        localStorage.removeItem(key);
      } catch {
        // localStorage can be disabled/full -- nothing more to do.
      }
    }
  }
  readyPromise = null;
  await ensureReady();
}

if (typeof window !== "undefined" && typeof import.meta !== "undefined" && import.meta.env?.DEV) {
  window.__IMBALINK_RESET_DB__ = () => {
    resetDatabase().then(() => {
      console.info("ImbaLink offline database reset. Reloading...");
      window.location.reload();
    });
  };
}
