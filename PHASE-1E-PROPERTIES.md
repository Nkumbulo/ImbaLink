# ImbaLink Phase 1E — Property Backend Boundary

## Goal
Route property feature operations through the provider-neutral `PropertyRepository` contract without changing the property UI or behavior.

## Changes
- Added `src/application/backend/index.js` as the application composition boundary.
- Migrated `usePropertyFeed` reads and listing mutations to `backend.propertyRepository`.
- Kept property realtime subscription on the existing domain path; realtime is a separate migration phase.
- Kept the existing property implementation as the compatibility-backed Supabase adapter, avoiding a risky rewrite of mature property logic.

## Runtime path
`usePropertyFeed -> application/backend -> infrastructure/supabase/backend -> supabasePropertyRepository -> existing property implementation -> Supabase`

This intentionally preserves runtime behavior while removing provider knowledge from the feature hook.

## Validation
- Import check: PASS (422 source files)
- Architecture check: PASS (422 source files; no unresolved local imports or dependency cycles)
- Production build: not run successfully in this environment because dependencies could not be fully installed; Vite was unavailable after the install attempt.

## Next
Phase 1F should migrate property interactions (likes, saves, view tracking, recommendations) into dedicated backend contracts before moving on to media/storage.


## Hotfix: Authentication contract
The Supabase auth adapter now implements `getCurrentUser()` required by the backend auth contract. This restores backend composition validation without bypassing the provider boundary.
