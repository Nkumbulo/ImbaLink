# Phase 1 — Backend Boundary

## Goal

Make the backend provider replaceable without rewriting ImbaLink's UI.

The application is moving from:

```text
Application → Supabase
```

toward:

```text
Application → ImbaLink backend contracts → provider implementation
```

Supabase is currently the provider implementation.

## New layers

```text
src/core/backend/
    contracts/
    contract.js
    createBackend.js

src/infrastructure/supabase/
    client.js
    rpc.js
```

### Core backend

`src/core/backend` is provider-agnostic. Its contracts describe business
capabilities such as:

- `propertyRepository.getProperty()`
- `messageRepository.sendMessage()`
- `auth.signIn()`
- `storage.upload()`
- `realtime.subscribe()`

A contract must not mention Supabase tables, RPC names, query builders, or
provider-specific types.

### Supabase infrastructure

`src/infrastructure/supabase` is the provider-specific layer. It is the only
place where the Supabase SDK is imported.

## Compatibility facades

The following remain temporarily:

```text
src/core/supabase/client.js
src/services/supabase.js
src/core/data/rpc.js
```

They now delegate to `src/infrastructure/supabase`.

They are migration bridges, not new APIs.

## Dependency direction

```text
React / Features
       ↓
Application / Domain APIs
       ↓
Core Backend Contracts
       ↓
Infrastructure Adapter
       ↓
Supabase
```

The reverse dependency is prohibited. Infrastructure may depend on core
contracts/errors, but core contracts must never depend on Supabase.

## What was intentionally NOT changed

This phase does not rewrite:

- PropertyDetail
- StudentPage
- messaging UI
- authentication UX
- existing domain implementations
- IndexedDB/cache behavior
- Supabase SQL/RLS

That keeps the change behavior-preserving.

## Migration rule

Migrate one domain at a time:

1. Implement the contract in the provider adapter.
2. Move consumers to the contract/domain API.
3. Run architecture/import checks.
4. Remove the old compatibility path only when unused.
5. Repeat for the next domain.

## First migration candidates

Authentication and properties are suitable early candidates.

Messaging is deliberately later because it combines persistence, realtime,
presence, read state, optimistic UI, and offline synchronization.
