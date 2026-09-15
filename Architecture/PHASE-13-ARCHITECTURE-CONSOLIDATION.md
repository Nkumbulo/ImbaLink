# Phase 13 — Architecture Consolidation

## Objective

Turn the Phase 1–12 architectural intent into enforceable boundaries while
preserving product behaviour. This phase is a consolidation pass, not a
feature rewrite.

## Completed

### 1. Persistence adapter boundary

Public domain APIs under `src/core/data/domains/*` now depend on explicit
infrastructure adapters under `src/core/data/adapters/*` rather than importing
`services/db/*` directly.

The legacy `src/services/db/*` modules remain implementation details during the
migration window. No page, component, hook or feature should consume them.

### 2. Infrastructure ownership

The following cross-cutting infrastructure now lives under `src/core`:

- `src/core/infrastructure/indexeddb.js` — IndexedDB engine
- `src/core/infrastructure/apiClient.js` — HTTP transport
- `src/core/cache/localCache.js` — local cache implementation
- `src/core/sync/outbox.js` — single mutation queue

The old service paths are no longer the canonical locations.

### 3. Error contract

`src/core/errors/AppError.js` now defines stable categories:

- `ValidationError`
- `AuthenticationError`
- `AuthorizationError`
- `NotFoundError`
- `ConflictError`
- `NetworkError`
- `TimeoutError`
- `ServerError`

Provider errors can be normalized at the boundary instead of leaking provider
specific status/string handling into the UI.

### 4. Architecture enforcement

`npm run check:architecture` now validates:

- no UI direct persistence imports
- no UI direct Supabase data access
- no non-domain access to low-level persistence adapters
- no core → UI dependency
- no unresolved local imports
- no actual relative-import cycles

Comments/documentation examples are ignored by the dependency scanner.

### 5. Contract tests

Added:

- `tests/architecture-boundaries.test.js`
- `tests/error-contract.test.js`

These complement the existing security, sync, messaging, state-machine and API
contract tests.

## Remaining work

This phase deliberately does not perform a risky behavioural rewrite of every
legacy persistence module. The next consolidation step should migrate the
implementation bodies from `services/db/*` into the adapter/domain structure,
then remove the compatibility layer once all consumers have moved.

Messaging should be the next domain decomposition target because it carries the
highest behavioural complexity: realtime, presence, delivery, read state,
conversation resolution, optimistic sends and mobile lifecycle handling.

## Validation

Run:

```bash
npm run check:architecture
npm test
npm run build
npm run audit
```

The source-level architecture check passes in the supplied project snapshot.
A full dependency-backed test/build run requires `npm ci` to complete in a
normal development environment.
