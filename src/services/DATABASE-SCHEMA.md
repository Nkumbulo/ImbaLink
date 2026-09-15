# ImbaLink Database Schema v6

The app uses a normalized repository layer (`src/services/database.js`), while keeping database-style records and IDs so a server repository can be attached without changing the UI. No remote database connection or credentials are present in this package.

## Storage: offline-first IndexedDB

Persistence is a real browser database (IndexedDB), not localStorage — see `src/core/infrastructure/indexeddb.js` for the engine and `## Offline architecture` below for how it fits together. `services/database.js` is still the only file the rest of the app talks to; nothing above it (hooks, pages, components) knows or cares that IndexedDB is what's underneath.

## Core tables

- `users` — account identity and profile.
- `properties` — rental listings / feed posts.
- `property_likes` — one row per user/property like.
- `property_saves` — one row per user/property save.
- `property_viewing_requests` — viewing requests and statuses.
- `messages` — property conversations, capped client-side at 100 recent messages.
- `contractors` — verified/public contractor directory records.
- `contractor_registrations` — contractor applications and verification data.
- `contractor_likes` — one row per user/contractor like.
- `quote_requests` — tenant/customer requests sent to contractors.
- `landlord_registrations` — landlord identity/authority applications.
- `landlord_listings` — landlord-created listings, including verification state.
- `landlord_registrations` — one registration per user, updated rather than duplicated.
- `universities` — authoritative university directory used by Student Home and Roommate Finder.
- `student_share_requests` — roommate/share requests created from the Students page (university, budget, roommates needed, move-in date, preferences, linked property).

## Contractor registration data

A contractor application stores: full name, business name, phone, email, business address, primary trade, services, service areas, experience, ID type/number, business registration number, licence number, tax/ZIMRA number, description, emergency-service availability, quote availability, terms acceptance, verification status, timestamps and a generated application ID.

## Landlord registration data

A landlord registration stores: legal name, phone, email, landlord type, ID type/number, address, company/agency name and registration number where relevant, legal-authority confirmation, verification status, timestamps and a generated registration ID.

## Property listing data

A listing stores: title, suburb, street/address, city, property type, rent, deposit, bedrooms, bathrooms, bathroom type, furnished state, availability, lease term, description, amenities, rules, electricity, water, security, parking, ownership/authority type and reference, landlord identity, verification state and timestamps.

## Student share request data

A share request stores: requesting user id, the property it's attached to, university, roommates needed, budget, move-in date, preferences text, status (`active` | `withdrawn`) and timestamps. This is the real `Student ↔ Property ↔ Student` relationship the property-specific Find a Roommate mode reads from (`db.getActiveShareRequestsForProperty(propertyId)`): every student with an active record for a given property is shown against that property, backed by their real stored profile (`db.findProfileById`) — not demo data. General roommate discovery is assembled from active `student_share_requests` joined to real student profiles and their linked properties. A student without an active property-linked request is not shown as a roommate candidate.

## Student recommendations

General Roommate Finder recommendations are generated server-side by `public.get_student_recommendations(...)` (migration `backend/011-student-recommendations.sql`). A candidate must have an active `student_share_requests` record and share at least **two explicit `preference_tags`** with the signed-in student. University, preferred area/city, accommodation preference and budget proximity are additional ranking signals. The function returns at most 12 candidates and never exposes phone numbers, email addresses, credentials, or the full private profile JSON.

The client initially displays up to 12 recommendations. Every 10 minutes it asks the backend for candidates excluding the currently displayed IDs, then replaces at most three existing cards. If no new eligible candidates are available, the current list is preserved. This prevents the entire recommendation list from disappearing or reshuffling on each refresh.

## Verification rule

Registrations and listings are **pending by default**. The client never automatically grants a verified badge from a new registration.

The transition itself is `db.setVerificationStatus(storeName, id, status)`. It validates the store and the status, writes `verificationReviewedAt` / `verificationReviewedBy` / `verificationNote`, and maps `rejected` to `flagged` for listings (the only vocabulary `normalizeProperty()` accepts — an unrecognised value there is silently coerced back to `pending`, which would make a rejection look like it never happened).

**This is not an authorization boundary.** It is reachable only from the dev-only review queue in `components/dev/DatabaseInspector.jsx`, which exists so the pending → verified path is testable and so the exact state transition the server-side admin tool will own is pinned down. A real server must re-check that the caller is staff and treat any such call as a request, never a decision.

## Credentials

Business-account registrations (contractor, landlord, agent, company, pro) carry a username and password. Passwords are stored as PBKDF2-HMAC-SHA256 records — `{algorithm, iterations, salt, hash}` — never as cleartext; see `services/auth/credentials.js`. `withHashedCredentials()` in `database.js` hashes on every registration write and deletes the plaintext from both the stored record and the returned one.

Legacy plaintext credentials are migrated by the server-side `backend/migrate-business-passwords.mjs` job and the `business-auth` Edge Function. The browser never reads legacy credential fields or verifies passwords.

The hash format is PBKDF2-HMAC-SHA256. Client-side hashing is only used while saving a new credential; it is **not** authentication. The real credential check and Supabase Auth session issuance happen on the server.

## Identifiers

New records get a prefixed UUID from `services/ids.js` (`listing_9f2c…`). The previous `${Date.now()}` scheme collided: two registrations created in the same millisecond produced the same id and the second silently overwrote the first. Existing records keep the ids they were created with — both are plain strings, and every comparison in the app already goes through `String(a) === String(b)`.

## Sync

Writes are local-first and unconditional; each also records an intent in `outbox` (`core/sync/outbox.js`), which drains to the server when one is configured and reachable. Entries drain oldest-first and stop at the first retryable failure so ordering holds; repeated toggles of the same like/save collapse to one final state, while messages never collapse. Permanent rejections move to `outboxDeadLetter` instead of blocking the queue.

Conflict policy is last-write-wins per record on `updatedAt`. With `VITE_API_BASE_URL` unset the whole layer is a no-op, so the app behaves exactly as it did before it existed.

## Listing photos

`ListingForm` can now attach photos. Each is downscaled on-device to a 1280px long edge at JPEG q0.72 (~150KB, down from a 3–8MB phone original) and stored as a `data:` URL in the listing's existing `images` array — so every consumer that renders `<img src={photo}>` works unchanged. Re-encoding also strips EXIF, including the GPS coordinates phones attach by default.

The original Blob is kept in `media`, keyed by an id recorded on the listing as `mediaIds`. `uploadPending()` uploads those once object storage exists and returns the data-URL → remote-URL mapping, so the listing shape never changes — only the contents of the string.

## Crash protection

All persistence reads are JSON-safe, invalid records are normalized, storage errors are caught, collection sizes are bounded, and schema migrations preserve v2 user data when upgrading to later versions.

## Offline architecture

```
React UI (pages/components)
        ↓
existing hooks/context (useDatabase, AuthContext, useMessaging)
        ↓
services/database.js  ← the same public API as before this migration
        ↓
core/infrastructure/indexeddb.js       ← IndexedDB engine (open/seed/migrate/CRUD helpers)
        ↓
IndexedDB ("imbalink_db", version 6)
```

**Database name / version:** `imbalink_db`, version `6`. Every object store the app needs is created in one `onupgradeneeded` pass; a future schema change should add an `if (oldVersion < 2) { ... }` block in `idb.js` rather than deleting/recreating the database, so existing development data survives a version bump.

**Object stores:**

| Store | Keyed by | Notes |
|---|---|---|
| `properties` | `id` | Seed catalog from `data/properties.json`, seeded once when empty. |
| `contractors` | `id` | Seed catalog from `data/contractors.json`, seeded once when empty. |
| `landlordListings` | `id` (indexed by `userId`) | Landlord-created listings, merged with `properties` client-side exactly as before (in `useDatabase.js`). |
| `userState` | `userId` | The per-account blob: likes, saves, contractor likes, message threads, viewing requests. One record per signed-in account. |
| `contractorRegistrations` | `id` (indexed by `userId`) | |
| `landlordRegistrations` | `userId` | One registration per account. |
| `agentRegistrations` | `userId` | One registration per account. |
| `companyRegistrations` | `userId` | One registration per account. |
| `quoteRequests` | `id` | |
| `studentShareRequests` | `id` (indexed by `userId`) | |
| `profile` | `id` (fixed value `"current"`) | Device profile — see note below. |
| `messageReadCounts` | `userId` | Previously an unscoped localStorage key written directly by `MessagesPage.jsx`; now scoped per account through this database layer. |
| `media` | `id` (indexed by `ownerId`) | Downscaled listing photos, held as Blobs until object storage exists. See `services/media/imageStore.js`. |
| `outbox` | `id` (indexed by `operation`) | Pending server writes. Empty unless `VITE_API_BASE_URL` is set. |
| `outboxDeadLetter` | `id` | Writes the server permanently rejected, kept for inspection rather than dropped. |
| `meta` | `key` | Internal only — tracks whether the one-time localStorage migration has run. |

**Note on `profile` (deprecated):** the singular `profile` store is keyed by a fixed id (`"current"`) and is **no longer read or written by the app**. The live per-account store is `profiles` (plural), keyed by `userId` with a `phoneNormalized` lookup index; `decomposeLegacyRecords()` in `database.js` re-homes any old `profile` record to the right account once, after which the old store is inert history. This document previously described the singleton as current behaviour, which was out of date.

**Seeding:** `properties` and `contractors` are seeded from their bundled JSON files the first time each store is found empty (`idbCount(...) === 0`), fetched over the network first with a bundled-import fallback for offline use — the same fetch-then-bundled-fallback order `_ensureData()`/`getContractors()` already used before this migration.

**Migration from existing localStorage data:** on first run, before seeding, `idb.js` sweeps every known legacy localStorage key (the versioned/account-suffixed user-state blob, landlord listings, contractor/landlord/agent/company registrations, quote requests, student share requests, the device profile, and message read counts) and imports anything found into the matching IndexedDB store. This runs at most once per browser, tracked via the `meta` store's `migratedFromLocalStorage` flag. The original localStorage keys are left in place afterward (untouched, unread by the app going forward) rather than deleted, as a safety net.

**Offline behaviour:** every read/write goes through IndexedDB, which works with no network connection. The only network calls in this layer are the initial `fetch()` attempts when seeding `properties`/`contractors` for the very first time on a given browser — both already fall back to the bundled copy of the same JSON shipped in the app bundle, so first-run seeding also works fully offline.

**Backend readiness:** nothing above `services/database.js` imports `core/infrastructure/indexeddb.js` directly (the dev inspector goes through the `__debug*` read passthroughs on `db`, which it always documented but which did not previously exist). Replacing IndexedDB with Supabase later means rewriting the function bodies in `database.js` to call Supabase instead of the `idb*` helpers — every hook, page, and component keeps working unchanged, exactly as before this migration.

**Development reset tool:** `window.__IMBALINK_RESET_DB__()`, available in the browser console only when running in Vite's dev mode (`import.meta.env.DEV`). Clears every object store and re-seeds from scratch, then reloads the page. Not exposed anywhere in the production UI.
