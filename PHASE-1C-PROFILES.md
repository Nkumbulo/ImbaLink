# ImbaLink Phase 1C — Profile Backend Adapter

## Completed

The profile/account persistence boundary is now wired to the Supabase infrastructure adapter.

### Contract
`src/core/backend/contracts/profiles.js`

The provider-independent `ProfileRepository` contract now exposes:

- `getProfile(userId)`
- `getProfiles(ids)`
- `getPublicProfile(userId)`
- `updateProfile(userId, patch, studentProfile)`
- `upsertProfile(userId, row, studentProfile)`

### Supabase implementation
`src/infrastructure/supabase/adapters/profiles.js`

All direct Supabase table operations for the migrated profile implementation are now contained in this adapter.

### Domain migration
`src/core/data/implementations/profile/profile.js` now calls the profile repository adapter rather than importing the Supabase client directly.

The existing IndexedDB cache and sync/outbox behavior remains unchanged.

## Intentionally not migrated

- admin authorization/realtime
- chat presence
- notifications
- viewing requests
- student recommendation queries
- legacy property implementation
- messaging

Those remain separate migration steps to avoid changing runtime behavior unnecessarily.

## Validation

- Import check: PASS
- Architecture check: PASS
- 420 source files scanned
- No unresolved local imports
- No dependency cycles

Tests/build are not run in this project copy because dependencies are not installed.
