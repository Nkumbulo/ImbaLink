# ImbaLink Architecture Baseline — Phase 1

## Objective

Stabilize the system before adding more product features. This phase establishes dependency boundaries and compatibility layers without a risky rewrite.

## Current target architecture

```text
                    React / UI
                       |
                hooks + feature services
                       |
          +------------+-------------+
          |                          |
     domain services           admin services
          |                          |
          +------------+-------------+
                       |
                 core gateways
          +------------+-------------+
          |            |             |
       Supabase      Cache        Errors/AuthZ
          |            |             |
       PostgreSQL   IndexedDB     Auth / RLS / RPC
```

## Canonical infrastructure

- `src/core/supabase/client.js` — the only browser Supabase client.
- `src/core/data/rpc.js` — canonical RPC and Edge Function gateway.
- `src/core/auth/authorization.js` — client-side authorization state for UX; server authorization remains authoritative.
- `src/core/errors/AppError.js` — common service-boundary error type.
- `src/core/cache/index.js` — cache abstraction.
- `src/services/presence.js` — domain gateway for presence RPCs.

## Compatibility boundaries

- `src/services/supabase.js` now re-exports the canonical client. It exists only so old code does not break during migration.
- `src/services/database.js` remains a compatibility facade over the already-split `src/services/db/*` domain modules. New code should not grow this facade.

## Admin boundary

Admin pages call `src/services/admin/*` only. Admin services call the core RPC/function gateway. UI components do not call Supabase RPCs directly.

Privileged actions still require server-side enforcement in SQL/RPC/Edge Functions. Client checks are never a security boundary.

## Dependency rules

1. UI cannot import `services/supabase`.
2. UI cannot call `supabase.from`, `supabase.rpc`, or `supabase.functions.invoke`.
3. New RPCs go through `core/data/rpc.js`.
4. New domain operations belong under `services/<domain>` rather than `services/database.js`.
5. Cache consumers use the cache boundary rather than IndexedDB directly.
6. Authentication may use the canonical Supabase client because auth is an infrastructure boundary.
7. Admin role changes, impersonation, deletion and other privileged operations must be server-authorized and audited.

## Phase 3 — Canonical lifecycle/state-machine contracts

The application now has one lifecycle contract in `src/core/domain/stateMachines.js`, mirrored by database transition predicates/triggers in `backend/032-state-machine-contracts.sql`.

Canonical machines: user lifecycle, property moderation/publication, verification, viewing requests, reports, payments, and Pro membership. UI/service code should use `canTransition`, `assertTransition`, and the exported state sets rather than inventing local status rules. The database remains authoritative and rejects illegal transitions.

Important separation: property moderation/publication state (`admin_status`) is distinct from identity/verification state (`verification`); payment state is a domain contract until a real payment ledger/provider is introduced.

## Remaining Phase 2 architecture work

### A. Domain-service extraction

Migrate the public application away from the large `services/database.js` facade one domain at a time:

- identity/profile
- properties
- interactions
- listings
- registrations
- verification
- viewing
- notifications
- messaging
- contractors
- student features

The facade remains until all consumers of a domain have moved.

### B. State-machine contracts

Define canonical states for:

- user lifecycle
- property moderation/publication/transaction
- verification
- payment
- reports
- viewing requests

Avoid mixing independent concerns into one status field.

### C. Server authorization contract

Introduce shared SQL functions such as:

- `require_admin()`
- `require_super_admin()`
- `require_permission(permission)`

All privileged RPCs and Edge Functions should use them.

### D. Immutable audit contract

Audit events become append-only. Mutating an audited resource and writing its audit event should occur in the same transaction wherever possible.

### E. Offline architecture

IndexedDB is a cache/offline queue, not a second source of truth. Every cached record must have an owner, freshness policy, and invalidation/reconciliation rule.

## Validation

Run:

```bash
npm run check:architecture
npm run build
npm test
```

The current environment could not complete `npm ci`/install before its execution timeout, so a production build still needs to be run in a normal project environment with dependencies installed.

## Phase 2 — Domain Data APIs

The application no longer uses `services/database` as its primary data-access API.
Domain APIs now live under `src/core/data/domains/` and expose explicit boundaries:

- `profile` — identity, profile, session and user state
- `properties` — property queries, listings and property interactions
- `registrations` — landlord, agent, agency/company, contractor and pro registration
- `notifications` — notification queries and subscriptions
- `interactions` — viewing, reports, enquiries and contractor interactions
- `students` — universities, interests and recommendations
- `sharing` — student/property share requests
- `quotes` — contractor quote requests
- `messaging` — legacy message bridge
- `verification` — verification state changes
- `debug` — development-only IndexedDB inspection

`src/services/database.js` is now explicitly a compatibility facade. New application
code must not import it. This makes the next phase (domain contracts/state machines)
possible without another large caller migration.

## Phase 6 — Offline/cache and synchronization
- `src/core/cache/*` is the canonical cache policy boundary.
- `src/core/sync/*` owns lifecycle-aware synchronization and conflict metadata.
- `src/core/sync/outbox.js` is the mutation queue; no feature may implement a second queue.
- IndexedDB sync metadata is device-local and contains no authentication secrets.

## Phase 13 — Architecture Consolidation

The application now has an explicit persistence-adapter boundary:
`src/core/data/domains/*` → `src/core/data/adapters/*` → legacy persistence
implementations. UI code must never import `services/db/*` or
`services/database.js` directly.

Cross-cutting infrastructure has been moved into `src/core`:

- `core/infrastructure/indexeddb.js` — IndexedDB engine
- `core/infrastructure/apiClient.js` — HTTP transport
- `core/cache/localCache.js` — local cache implementation
- `core/sync/outbox.js` — the single offline mutation queue

`core/errors/AppError.js` provides stable error categories and `core/data/rpc.js`
normalizes provider errors at the service boundary.

`npm run check:architecture` now checks dependency direction, unresolved local
imports and actual relative-import cycles in addition to persistence boundaries.
