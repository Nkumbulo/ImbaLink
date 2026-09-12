# ImbaLink security regression checklist

- [x] Business username/password verification moved to server-side Supabase Edge Function.
- [x] Browser no longer reads all business registrations or verifies passwords.
- [x] Legacy plaintext migration job added; migrated rows have plaintext fields removed.
- [x] `property-images` bucket restricted to JPEG/PNG/WebP and 10 MiB.
- [x] `package.json` restored and dependency audit CI added.
- [x] Direct `conversations` INSERT policy removed; conversation creation is RPC-only.
- [x] Verification status writes moved behind a SECURITY DEFINER staff-role check.
- [x] Plain phone sign-in fallback removed from the legacy auth provider.
- [x] Messaging RLS regression tests added with a disposable PostgreSQL/Testcontainers harness.
- [x] Duplicate `conversations_insert` definitions removed from 002 and 007.
- [x] Duplicate `BottomNav.jsx` removed; `layouts/BottomNav.jsx` is the App import.
- [x] Moderation UI now reports authorization/update errors and uses the server RPC.

## Verification performed in this workspace

- Static search confirms no `conversations_insert` CREATE remains outside `999-messaging-production-fix.sql` (where the policy is intentionally absent).
- Static search confirms no `signInWithPhone` fallback remains in the source.
- Node syntax checks pass for the migration runner and test file.
- Full `npm audit`, dependency installation, Vite build, and Docker-backed Vitest
  execution require registry/Docker access, which is not available in this
  execution environment. GitHub Actions runs `npm audit --audit-level=high`,
  tests, and the production build on every push/PR.
