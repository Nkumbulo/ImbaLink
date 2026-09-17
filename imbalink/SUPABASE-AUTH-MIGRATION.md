# ImbaLink Supabase Auth patch

This patch moves general and student phone authentication from the old browser-only provider to Supabase Auth with SMS OTP, while preserving the existing AuthContext API and UI structure.

## Files changed
- `src/services/supabase.js` — Supabase client.
- `src/auth/supabaseAuthProvider.js` — phone OTP auth + app-profile sync.
- `src/auth/AuthContext.jsx` — uses Supabase Auth/session events.
- `src/components/common/UserOnboarding.jsx` — adds the OTP verification step without changing the visual design system.
- `backend/supabase-auth-policies.sql` — RLS for the authenticated user's own `users` and `student_profiles` rows.

## Required setup
1. Install: `npm install @supabase/supabase-js`
2. Create `.env.local` in the project root:
   `VITE_SUPABASE_URL=...`
   `VITE_SUPABASE_ANON_KEY=...`
3. In Supabase Authentication, enable Phone provider and configure an SMS provider.
4. Run `backend/supabase-auth-policies.sql` in Supabase SQL Editor.
5. Start the app and test registration/login with a real phone number.

## Intentionally not migrated yet
Business username/password login still uses `localAuthProvider` so the existing business registration flow is not broken. That path should be migrated separately to a server-side credential verification flow before production.

## Important
Do not expose a Supabase service-role key in Vite. Do not disable RLS to make errors disappear.
