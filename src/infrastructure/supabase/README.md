# Supabase Infrastructure

This directory is the provider-specific implementation boundary for Supabase.

## Rule

Only infrastructure/auth compatibility code should know that Supabase exists.

Application/domain code should depend on backend contracts under:

```text
src/core/backend/
```

and not on:

```text
@supabase/supabase-js
supabase.from(...)
supabase.rpc(...)
supabase.functions.invoke(...)
supabase.storage
Supabase Realtime APIs
```

## Phase 1 compatibility

The project still contains legacy consumers of `src/services/supabase.js` and
some existing core data implementations. They are deliberately left intact so
this architectural change does not alter product behavior.

Migration is domain-by-domain. A compatibility facade is removed only after
its consumers have been migrated and the architecture check confirms that no
consumer remains.

## Phase 1B adapters

The first concrete adapters are now wired:

- `adapters/auth.js` implements the Auth contract.
- `adapters/properties.js` implements the PropertyRepository contract while
  delegating to the existing property domain implementation.
- `backend.js` is the Supabase composition root.

The profile, messaging, storage, and realtime ports are deliberately explicit
stubs until their migrations are performed. They fail loudly rather than
silently bypassing the backend boundary.
