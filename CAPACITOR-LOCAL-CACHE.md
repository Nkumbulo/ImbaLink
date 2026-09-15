# ImbaLink local-first cache

ImbaLink now uses a cache-then-network loading model for Messages and the property feed.

## Native dependencies

Install in the app repo:

```bash
npm install @capacitor/core @capacitor/preferences @capacitor-community/sqlite
npx cap sync
```

If the native iOS/Android projects already pin a Capacitor major version, use the matching major version of these plugins rather than mixing Capacitor majors.

## Storage policy

- `@capacitor/preferences`: small account-scoped state such as conversation previews, unread counts, and the compact user-state snapshot.
- `@capacitor-community/sqlite`: larger message/property cache records.
- IndexedDB is only a browser/test fallback for the cache layer; native iOS/Android uses SQLite.
- Supabase remains the source of truth.

## Warm-open behavior

Messages and feed pages render the last successful local snapshot immediately. If the snapshot is stale, Supabase refreshes in the background. A true first-ever open still shows the normal loading state until the first network result exists.

Messages sent from the composer are inserted locally with `sending` status immediately, persisted to the cache, and reconciled with `send_message_atomic` when the server confirms them. Failed sends remain visible with `failed` status so the existing retry affordance can be used.

Realtime events continue to update in-memory state and are persisted by the active hooks, so the next cold open starts from the latest known state.
