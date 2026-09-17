# ImbaLink Core Architecture

This directory contains infrastructure that must remain independent from UI and feature modules.

## Dependency direction

```text
UI / pages / components
        ↓
feature services / hooks
        ↓
core gateways + domain services
        ↓
Supabase / IndexedDB / native APIs
```

## Rules

1. There is exactly one browser Supabase client: `core/supabase/client.js`.
2. UI must not call `supabase.from()`, `supabase.rpc()` or `supabase.functions.invoke()` directly.
3. Privileged admin operations must use a service gateway and be authorized again on the server.
4. `services/database.js` is a compatibility facade. New feature code should use a domain service instead of adding methods to the facade.
5. Cache/storage implementations are behind a cache boundary.
6. Authentication state is owned by `auth/`; authorization decisions are server-enforced and only mirrored client-side for UX.
7. Errors crossing a service boundary should be normalized to `AppError`.
8. No feature may import another feature's internal implementation. Shared behavior belongs in `core/` or `components/common/`.

## Migration strategy

This is an incremental architecture. Compatibility facades remain temporarily so the application can be refactored domain-by-domain without a risky rewrite.
