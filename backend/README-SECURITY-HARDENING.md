# ImbaLink security hardening deployment

## Business username/password authentication

Business login no longer reads registrations in the browser. The browser calls
`supabase/functions/business-auth`, which runs with the Supabase service role,
reads `user_credentials`, verifies PBKDF2 server-side, and then signs the user
into Supabase Auth. The browser receives only a normal Supabase access/refresh
session.

Run these in order:

1. `schema.sql`
2. `google-auth.sql`
3. `002-app-alignment.sql`
4. `013-security-hardening.sql`
5. `999-messaging-production-fix.sql`

Deploy the Edge Functions in `supabase/functions/` and set the normal Supabase
function environment variables. For the legacy migration function, also set
`BUSINESS_PASSWORD_MIGRATION_SECRET` to a strong secret and invoke it once (or
from a protected scheduler) before removing legacy data.

For legacy plaintext passwords, the standalone Node job can also be run from a
trusted server:

```sh
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node backend/migrate-business-passwords.mjs
```

The job never logs plaintext passwords and removes `submitted.password`,
`submitted.confirmPassword`, and `submitted.passwordHash` after successful
migration.

## Staff verification

Set the Supabase Auth user's **server-controlled** `app_metadata.role` to one
of `admin`, `moderator`, or `staff`. Do not use `user_metadata` for this role.
`db.setVerificationStatus()` now calls the `set_verification_status` SECURITY
DEFINER RPC, which checks that role and takes the reviewer identity from
`auth.uid()`.

## Messaging

Conversation creation is RPC-only. The `conversations_insert` policy was
removed from the earlier migrations and is not recreated by the production
migration. The existing SECURITY DEFINER RPCs create the conversation and its
participants atomically.

## Storage

`property-images` is public-read but uploads are restricted to the owner's
folder and the bucket accepts only JPEG, PNG, and WebP up to 10 MiB.
