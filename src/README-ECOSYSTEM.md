# ImbaLink ecosystem expansion

The project is now structured around three connected user experiences:

- Tenant marketplace: Home, Search, Saved, Messages, Profile
- Landlord portal: `pages/LandlordDashboardPage.jsx`
- Contractor directory: `pages/ContractorsPage.jsx`

## New folders/files

- `src/components/landlord/ListingForm.jsx`
- `src/pages/LandlordDashboardPage.jsx`
- `src/pages/ContractorsPage.jsx`
- `src/data/contractors.json`

## Data behaviour

Landlord-created listings are stored in the app's offline IndexedDB database
(see `services/DATABASE-SCHEMA.md`), so the UI works without a backend.

Contractors are seeded from `src/data/contractors.json` into IndexedDB.

## Next backend step

**Status:** the client-side groundwork is done and the database schema is written
(`backend/schema.sql`, `backend/import-seed.mjs`, `backend/README.md`). No API
exists yet. Everything server-facing is inert until `VITE_API_BASE_URL` is set,
so the app currently behaves exactly as it did before that groundwork landed.

What changed on the client:

- Business-account passwords are PBKDF2-hashed instead of stored as cleartext,
  in a format that verifies server-side unchanged (`services/auth/credentials.js`).
- New records get UUIDs instead of `${Date.now()}`, which was colliding.
- Writes stay local-first and additionally queue to a durable outbox that drains
  in order when a server is reachable (`core/sync/outbox.js`).
- Listings can have photos, downscaled on-device, with an upload path ready
  (`services/media/imageStore.js`).
- Verification can actually be granted, through a dev-only review queue.

For production, the tables that back all of this:

- users
- landlord_profiles
- tenant_profiles
- contractor_profiles
- properties
- property_images
- viewing_requests
- conversations/messages
- contractor_quotes/jobs
- verification_records
- payments

The current UI is deliberately ready for that migration: the database access is
centralised in `src/services/database.js`. See `backend/README.md` for the
sequencing, and for the two things a server must never take the client's word
on (verification decisions, and the `user_id` in a request body).


## Database stability update

The app now uses a versioned normalized client database with safe migration from v1, bounded message/listing storage, defensive parsing, pagination guards, and separate property/contractor likes. See `services/DATABASE-SCHEMA.md`.


## Data persistence

The application seeds `src/data/properties.json` (161 properties) into the offline IndexedDB database the first time it runs on a given browser, so the property feed works with no backend. User-generated records are persisted through `src/services/database.js`: landlord registrations, contractor registrations, landlord listings, likes, saves, viewing requests and messages are stored with stable IDs and user ownership. See `services/DATABASE-SCHEMA.md` for the full store list, seeding behaviour, and legacy-localStorage migration.

The package does not currently contain a remote database URL/key or backend service. The repository layer is intentionally isolated so a PostgreSQL/Supabase/API implementation can replace the local persistence without rewriting the UI — see the "Supabase readiness" note in `services/DATABASE-SCHEMA.md`.
