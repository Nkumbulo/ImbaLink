# ImbaLink backend

This app talks to Supabase directly from the client by default
(`src/services/database.js` and friends call `supabase.from(...)` /
`supabase.rpc(...)`). An earlier draft of this README claimed the
`VITE_API_BASE_URL`-fronted `/v1/` API layer never got built and was
abandoned in favor of going straight to Supabase — **that's since become
wrong.** `037-api-mutation-gateway.sql` + `supabase/functions/api-v1/`
implement a real transactional `/v1` mutation gateway (idempotency ledger,
advisory locks, server-side ownership checks). It's a genuine compatibility
boundary, not dead code: direct-Supabase calls remain the default path when
`VITE_API_BASE_URL` is unset (so local dev needs no extra setup), and the
outbox switches to routing migrated mutations through the gateway once
that env var is configured. See `Architecture/PHASE-9.md` through
`PHASE-12.md` for the full sync/gateway design.

## Files

| File | What it is |
|---|---|
| `schema.sql` | Base PostgreSQL schema. Everything else in this directory is a migration applied on top of it. |
| `import-seed.mjs` | One-time importer for `src/data/*.json`. Idempotent. |
| `migrate-business-passwords.mjs` | One-time migration for legacy plaintext business-account passwords into `user_credentials` (PBKDF2 hashes). |

## Getting it up

```bash
createdb imbalink
psql imbalink -f backend/schema.sql

# then run every numbered migration below, in order
psql imbalink -f backend/002-app-alignment.sql
psql imbalink -f backend/003-registration-persistence.sql
# ...through 030 (see "Migration run order" below)

# validate the seed mapping without touching a database
node backend/import-seed.mjs --dry-run

npm i pg
DATABASE_URL=postgres://localhost/imbalink node backend/import-seed.mjs
```

## Migration run order

Run these against the live Supabase project's SQL Editor in order. Each is
written to be idempotent (`CREATE OR REPLACE`, `DROP POLICY IF EXISTS`, etc.)
so re-running one that's already applied is safe.

1. `schema.sql` — base tables, enums, indexes.
2. `002-app-alignment.sql` — RLS policies matching the client's actual read/write patterns.
3. `003-registration-persistence.sql` — landlord/agent/company/contractor registration records.
4. `004-property-image-storage.sql` — `property-images` bucket: mime/size limits, ownership-scoped storage RLS.
5. `005-realtime-feed.sql` — realtime publication wiring for the property feed.
6. `006-landlord-listing-management.sql` — `properties_delete_own` policy (create/update already covered by 002).
7. `007-real-save-count-and-owner-messaging.sql` — server-computed save counts, owner-side messaging grants.
8. `010-properties-with-meta-view.sql` — `properties_with_meta` view (cover image + save count in one query).
9. `011-student-recommendations.sql` — student/roommate matching support.
10. `012-landlord-identity-verification.sql` — private ID-document storage for landlord verification.
11. `013-security-hardening.sql` — `is_staff_caller()` / `set_verification_status()` (role-gated via `auth.jwt()->app_metadata.role`), `verification_events` audit trail.
12. `014-message-delivery-status.sql` — WhatsApp-style delivered/read receipts (`last_delivered_at`/`last_read_at` + RPCs).
13. `015-global-user-presence.sql` — app-wide heartbeat / last-seen, independent of MessagesPage being open.
14. `016-viewing-request-response.sql` — lets a landlord accept/decline/complete a viewing request, and a tenant cancel their own (previously: only creation existed, there was no response path at all).
15. `017-listing-reports.sql` — "Report listing" + the staff moderation queue it feeds (`reports` table, `report_listing()`, `set_report_status()`).
16. `018-listing-view-counts.sql` — per-listing view counts (`view_count` column, `record_property_view()` RPC, skips the owner's own views).
17. `019-notifications.sql` — in-app notifications (`notifications` table, trigger-only creation on viewing-request/verification changes, never a direct client insert).
18. `020-admin-dashboard.sql` — staff dashboard RPCs (KPIs, growth, breakdowns), `admin_audit_log` with automatic triggers on verification/report changes, `property_view_events` for per-view analytics.
19. `021-admin-operations.sql` — operational insights, CSV/JSON data export, and the first version of the staff verification queue.
20. `022-admin-only-verification.sql` — **tightens verification decisions from any staff role to admin-only**, both via the RPC and a database trigger (defense in depth against a direct table UPDATE bypassing the RPC). Also adds `landlord_verifications` as a verifiable store.
21. `023-verification-center-operations.sql` — neglect/restore workflow (`admin_neglected_verifications`) so a record can be set aside from the active queue without a status change.
22. `024-verification-center-command-center.sql` — verification queue excludes neglected records; adds center-wide metrics and full decision history.
23. `025-verification-center-recovery.sql` — refines the neglected-records view with subject names/details for display.
24. `026-fix-verification-user-id-types.sql` — casts an enum column to text at a join boundary in `get_neglected_verifications()` (bugfix on 025, superseded by this file).
25. `027-admin-realtime-sync.sql` — adds admin/verification tables to the realtime publication with `REPLICA IDENTITY FULL`, so staff clients see changes immediately.
26. `028-hide-flagged-listings-public.sql` — **closes a real gap**: flagged/rejected listings were readable by anyone via direct PostgREST query (`properties_read` was `USING (true)`); now enforced at the RLS layer, not just filtered client-side.
27. `029-monetization-control.sql` — Pro-membership gate for new listings/viewing requests, **off by default** (`monetization_settings.enabled = false`). No payment provider is connected — this only gates access based on existing Pro registrations.
28. `030-monetization-analytics.sql` — monetization readiness metrics (verified users, Pro penetration, "locked opportunity") and the matching viewing-request-side Pro gate.
29. `031-admin-command-center.sql` — further admin dashboard/command-center RPC consolidation.
30. `032-state-machine-contracts.sql` — canonical lifecycle state machines (user, property moderation/publication, verification, viewing requests, reports, payments, Pro membership), mirroring `src/core/domain/stateMachines.js` with DB-level transition predicates/triggers so illegal transitions are rejected at the database, not just client-side.
31. `033-authorization-contract.sql` — shared server authorization functions (`require_admin()`, `require_super_admin()`, `require_permission()`) for privileged RPCs/Edge Functions to use instead of ad hoc role checks.
32. `034-immutable-audit-and-transactional-admin.sql` — append-only `admin_audit_log` (no client UPDATE/DELETE, DB trigger enforces it even against privileged SQL paths), `audit_event()` SECURITY DEFINER write boundary, two-phase hard user deletion (Auth + `public.users` can't share a transaction), settings mutation + its audit event now written atomically.
33. `035-sync-contract.sql` — append-only `sync_changes` feed + triggers, `sync_changes_after(cursor, limit)` RPC, `sync_idempotency` ledger keyed by actor + client mutation ID, powers the offline-sync client work in Phases 6–8.
34. `036-secure-sync-scope.sql` — **closes a real gap in 035**: the initial change feed could expose unrelated users' rows through a global authenticated feed. This replaces it with a visibility-aware projection (user-scoped profile/registration events, owner/participant-scoped viewing/quote/share/message events, public catalog projections for properties/contractors, sensitive columns excluded). Required before enabling the sync endpoint in production.
35. `037-api-mutation-gateway.sql` — the transactional `/v1` mutation gateway: `api_mutation(operation, mutation_id, entity_id, payload)` SECURITY DEFINER RPC, caller identity from `auth.uid()` only (never the payload), transaction-scoped advisory lock against concurrent duplicate execution, idempotency lookup+store in the same transaction, server-side ownership/participant checks. Backs `supabase/functions/api-v1/index.ts`.

`999-messaging-production-fix.sql` is a separate, self-sufficient, idempotent
migration — it does **not** depend on `007` (it recreates every RPC it
needs). Run it any time messaging/viewing-request RPCs need to be
reinstalled from scratch; see "Messaging / viewing-request fix" below.
`1000-phase6-messaging-reply-fix.sql` and `1001-phase6-message-read-rpc.sql`
depend on `999` having been run first (both recreate RPCs `999` also
touches). `1002-cursor-message-sync.sql` depends on `1001` — it adds an
optional `(p_after_sent_at, p_after_id)` cursor to
`get_conversation_messages()` so the client can sync "everything new since
the last message I have" instead of re-fetching the most-recent-100 window
on every reconnect; existing calls with no cursor are unaffected.
`1003-viewing-request-dual-notifications.sql` depends on
`019-notifications.sql` — it widens `notify_viewing_request_status_change()`
to notify BOTH the tenant and the landlord on every accept/decline/cancel/
complete transition (previously only whichever side didn't act was
notified; the actor now also gets a confirmation), reusing the existing
`viewing_status` notification type so the bell's icon/sound mapping needs
no client changes.
`1004-request-viewing-property-linkage.sql` depends on `1002` — tags every
viewing-request message with the exact `related_property_id` it's about
(a real FK, restoring what `050` originally did before `999`/`1000`/`1001`
silently dropped it on later redefinitions of the same two functions) and
returns it through `get_conversation_messages()`. Fixes a real, confirmed
bug: the client previously matched a message back to a property purely by
parsing the property NAME out of the message text and searching the
*entire* catalog for a title match — not scoped to the conversation's
landlord — so two properties sharing an identical title (confirmed to
happen in this app's own seed data) could resolve to the wrong one.
`016` and `017` both depend on `999-messaging-production-fix.sql` and
`013-security-hardening.sql` respectively having been run first. `020`
onward depend on `013`, `017`, and `018` having been run first (each says so
in its own header comment) — run them in the numbered order above. `036`
depends on `035`; `037` depends on `036`.

**As of this writing, `020` through `037` have only ever been verified
against disposable local Postgres, never against the live Supabase
project.** Applying them there is a real deployment step, not a
formality — do it in numbered order and check for errors at each step.

## Admin system

`020` through `030` add a staff/admin control plane: a dashboard, a
verification center (with a neglect/restore workflow and full decision
history), a reports queue, CSV/JSON export, an automatic audit log, and an
optional Pro-membership monetization gate. None of it is reachable in the
app unless the signed-in account's `auth.jwt()->app_metadata.role` is set to
`admin`, `moderator`, or `staff` — that claim has to be set directly on the
Supabase Auth user (e.g. via the dashboard or the Admin API), there's no
in-app way to grant it. Verification *decisions* specifically (approve /
reject / flag / neglect / restore, and the monetization toggle) require the
stricter `admin` role — `moderator`/`staff` can view the same screens but
their write attempts are rejected server-side, not just hidden in the UI.

There are now two live admin entry points, not one:

- `src/pages/AdminPage.jsx`, reachable from Profile → an "Admin" tile that
  only renders once the client-side `checkStaffRole()` check passes — a
  convenience gate only; every RPC re-checks server-side regardless, so
  this cannot be the actual security boundary and isn't meant to be.
- `src/services/admin/AdminApp.jsx` + `AdminLoginPage.jsx`, a standalone
  admin portal at the `/admin` path (`/admin/login` for the login screen)
  with its own auth flow, added during the later architecture-hardening
  phases. Its page components (`Admin*Page.jsx` in the same directory) are
  a gateway-compliant rewrite of the same dashboard/users/reports/
  verification/monetization screens as `AdminPage.jsx`'s section files.

Both are wired into `src/App.jsx` and both work. They're genuinely
duplicate implementations of overlapping functionality, not just two
routes to the same code — a fix in one won't propagate to the other. An
orphaned, unimported third copy of the `/admin`-path pages previously
existed at `src/pages/admin/` (byte-near-identical to
`src/services/admin/`, minified to single-line JSX, still importing the
legacy `services/supabase` client) and has been deleted as dead code; it
was never reachable from any route. Consolidating the two remaining live
admin surfaces into one is still an open decision, not done here.

`src/services/admin/*.js` (the non-page files) are thin RPC wrappers, one
file per concern (analytics, moderation, tools, verification center),
matching the pattern the rest of `services/` already uses.
`adminMonetization.js` was added alongside the integration — the SQL
migrations shipped with corresponding JS callers for everything except the
monetization RPCs.

**Not included, and not built here:** the `admin-create-landlord` Supabase
Edge Function that `adminTools.js`'s `createLandlordInvite()` calls. That
function doesn't exist yet — the JS wrapper is wired up and will throw an
ordinary reachable-but-missing-function error until it's added separately.


## Things the server must not trust the client on

- **Verification status.** `db.setVerificationStatus()` calls the
  `set_verification_status` SECURITY DEFINER RPC. The RPC uses the caller's
  server-controlled `auth.app_metadata.role` and only permits `admin`,
  `moderator`, or `staff`.
- **Password checks.** Verified only in the server-side `business-auth` Edge
  Function. Credential hashes live in `user_credentials`, which has no
  browser RLS policy.
- **`user_id` in a payload.** Never trust a client-supplied user id; every
  RPC in this directory takes identity from `auth.uid()`, not from an
  argument.

## Conflict policy

Last-write-wins per record on `updated_at`. Messages are the exception and
are append-only by construction — each has its own id, so they interleave
by timestamp instead of conflicting.

## Messaging / viewing-request fix

If Request Viewing or two-way messaging fails, run
`backend/999-messaging-production-fix.sql` once in the Supabase SQL Editor.
It is idempotent and self-sufficient, and installs the atomic
viewing/message RPCs plus the `auth.uid()`-based RLS. After running it,
either wait a few seconds for PostgREST's schema cache or run
`NOTIFY pgrst, 'reload schema';`.

If it still fails after that, open the browser console on the failing
click — `services/database.js` logs the exact Supabase/Postgres error
object (code, message, details, hint) before falling back, instead of only
showing a generic toast. That tells you exactly which layer is rejecting
the write (RPC not found, RLS denial, FK violation, etc.).

**Confirmed root cause of "Couldn't send your request" / `400` on
`rpc/request_property_viewing`:** `request_property_viewing()` and
`send_message_atomic()` both `RETURNS TABLE (...)`, which gives PL/pgSQL an
implicit OUT-parameter variable for every returned column
(`conversation_id`, `message_id`, `id`, ...). Those functions also use
plain `INSERT ... ON CONFLICT (conversation_id, user_id)` /
`ON CONFLICT (id)` clauses — and PL/pgSQL's default behavior when a bare
identifier in embedded SQL matches both a declared variable (including an
OUT parameter) and a table column is to raise `column reference "..." is
ambiguous` (SQLSTATE 42702) at **call time**, not at `CREATE FUNCTION`
time, which is why this passed review but failed on every real click. This
was reproduced locally against a real Postgres 16 instance and confirmed
fixed by adding `#variable_conflict use_column` as the first line of each
function body.

**Resolved (was a known limitation in an earlier draft of this file):**
property conversations are keyed `<propertyId>::<tenantId>`, not by
property id alone — each tenant who requests a viewing on the same listing
gets their own conversation with the landlord, rather than every tenant
landing in one shared thread. See `ensure_property_conversation()` and
`request_property_viewing()` in `999-messaging-production-fix.sql`.

### Migrations 038–054 (previously undocumented in this list)
- `038-rls-communication-fix.sql` repairs row-level-security policies for authenticated self-owned data (run after `schema.sql` / `002-app-alignment.sql` / `google-auth.sql`).
- `039-public-listing-visibility-fix.sql` fixes the `properties_read` policy so public/anon visibility rules match the intended verification-status logic.
- `040-listing-photo-storage-hardening.sql` (re)configures the `property-images` Storage bucket: public read, 10MB limit, JPEG/PNG/WebP only.
- `041-public-landlord-listings-gallery.sql` — public listing + complete gallery contract: a landlord listing and its gallery/Storage objects are public-readable unless flagged/rejected.
- `042-admin-property-image-review.sql` gives admins photo review/deletion on landlord listings; reads stay public, deletion is admin-only.
- `044-landlord-listing-pause.sql` lets a landlord temporarily pause a listing without deleting it; paused listings stay visible so tenants understand why.
- `045-property-recommendations.sql` — recommendation signals; the Link button is an explicit "show me more like this" signal, not a save.
- `047-viewing-request-assistant-messages.sql` replaces participant decline/cancellation messages with a green ImbaLink-assistant chat bubble rendered by the UI.
- `048-viewing-request-realtime.sql` guarantees viewing-request status changes are delivered through Supabase Realtime so an open tenant chat updates promptly.
- `049-viewing-request-notification-sync.sql` — real, persisted ImbaLink Assistant messages for viewing-request decline/cancellation, synced live to both tenant and landlord.
- `050-viewing-request-workflow.sql` — viewing-request workflow with the database as source of truth: dedicated fields, atomic authorized status transitions (including landlord cancellation), one assistant message per (request, status), re-request after declined/cancelled/completed. Run after `049`.
- `053-reset-notification-history.sql` *(renumbered from `050-reset-notification-history.sql` — that number collided with `050-viewing-request-workflow.sql` above; this migration has no ordering dependency, so it was the one moved)* lets an authenticated user permanently clear their own notification history via `reset_all_notifications()`.
- `054-support-requests.sql` *(renumbered from `041-support-requests.sql` — collided with `041-public-landlord-listings-gallery.sql` above; this one was moved since it's a self-contained new table with no ordering dependency)* creates the `support_requests` inbox for app-wide bug/safety/support reports.

Note: `999-messaging-final-fix.sql` has been removed — it was byte-identical
to `999-messaging-production-fix.sql` (confirmed via diff) and was never
referenced anywhere in this README or the app; keeping two files claiming the
same "999" slot was pure duplication, not two different fixes.

### Legal documents
- `051-legal-documents.sql` creates the published legal-document store with public read access only for published documents.
- `052-publish-terms-template.sql` publishes the approved Terms & Conditions after the reviewed text has been pasted into the template.
- `IMBALINK-TERMS-AND-CONDITIONS.md` contains the full draft text supplied for legal review and publication.
