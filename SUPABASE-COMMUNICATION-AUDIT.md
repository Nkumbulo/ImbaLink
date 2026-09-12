# ImbaLink Supabase Communication Audit

## Root cause found

The landlord registration failure was caused by an identity fallback in the frontend:

- `App.jsx` passed `userProfile?.id || "local-user"` into the landlord registration service.
- If profile hydration had not completed, the real authenticated Supabase user already existed, but the registration payload contained `local-user`.
- `registrations` is correctly protected by RLS with `user_id = auth.uid()::text`.
- PostgreSQL therefore rejected the INSERT/UPSERT with `new row violates row-level security policy for table "registrations"`.

This was an application identity bug, not a reason to weaken RLS.

## Fix applied

1. Registration handlers now use the authenticated session user ID (`user.id`).
2. Database write services now use `requireCurrentUserId()` and reject a supplied ID that differs from the authenticated Supabase identity.
3. Synthetic `local-user` values are no longer accepted as database write identities.
4. Profile upserts, Pro registration, share requests and landlord listing creation are hardened against stale/spoofed user IDs.
5. `findProfileByPhone()` no longer attempts to read the protected `users` table for cross-account discovery. It fails closed instead of weakening user-table RLS.
6. `backend/038-rls-communication-fix.sql` explicitly restores secure self-owned RLS policies for the critical authenticated write surfaces.

## Important deployment step

Run `backend/038-rls-communication-fix.sql` in the Supabase SQL Editor if the live database policies may differ from this project's migrations.

Also make sure `backend/google-auth.sql` has been run so every Auth user has its corresponding `public.users` row. The trigger is the preferred creation path; the client only provides a safe fallback.

## Security result

RLS remains enabled. The browser still uses only the Supabase publishable/anon key. No service-role key is placed in the frontend. Ownership is derived from `auth.uid()` and cannot be changed by submitting another user's ID.

## Verification limitation

A real authenticated registration could not be executed from this offline source-code environment because it does not have the user's Supabase Auth session. The code path and RLS contract were audited against the included migrations, and the exact live SQL repair is included above. After running the migration, test with a real logged-in account and confirm the `registrations` row uses that account's `auth.users.id`.
