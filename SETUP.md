# ImbaLink — Google sign-in patch

Unzip over your project root. The folders already match, so files land in place.

```
your-project/
├── vite.config.js                      REPLACE
├── backend/
│   └── google-auth.sql                 NEW — run in Supabase SQL Editor
└── src/
    ├── App.jsx                         REPLACE (2 lines changed)
    ├── auth/
    │   ├── AuthContext.jsx             REPLACE
    │   └── supabaseAuthProvider.js     REPLACE
    ├── components/common/
    │   └── UserOnboarding.jsx          REPLACE
    └── services/
        ├── database.js                 REPLACE
        └── supabase.js                 REPLACE
```

`src/auth/localAuthProvider.js` is untouched — business accounts still use it.

---

## STEP 0 — Settle which Supabase project is the real one

You have two. The dashboard tab was on `uwpidwzcvjnvywvodqbo`; the app's
`.env.local` points at `tnuthjyunfbcboigmfwo`. If these don't match, nothing
below will work no matter how carefully it's configured.

Open both in the dashboard, check Table Editor, and pick the one that has your
`properties` and `users` tables with data in them. Everything below uses
`<REF>` for that project's ref.

---

## STEP 1 — Database

Supabase Dashboard → SQL Editor → paste `backend/google-auth.sql` → Run.

Adds `email`, `avatar_url`, `onboarded_at` to `users`, makes the phone columns
nullable, installs the trigger that auto-creates a profile row on signup, and
backfills any auth users already created.

Safe to run more than once.

---

## STEP 2 — Google Cloud Console

APIs & Services → Credentials → Create OAuth client ID → **Web application**.

Under **Authorized redirect URIs** (NOT "Authorized JavaScript origins"):

```
https://<REF>.supabase.co/auth/v1/callback
```

This is Supabase's address, not your app's. Google sends the user to Supabase,
and Supabase forwards them to you. Getting this wrong is the cause of
`Error 400: redirect_uri_mismatch`.

No trailing slash. https, not http. Save, then wait a minute for Google to
propagate the change.

Copy the Client ID and Client Secret.

---

## STEP 3 — Supabase Auth settings

Authentication → **Sign In / Providers** → Google → enable → paste the Client ID
and Client Secret from step 2.

Authentication → **URL Configuration**:
- Site URL: your production URL (or `http://localhost:5173` while developing)
- Additional Redirect URLs: add `http://localhost:5173`

Do NOT touch Authentication → OAuth Server. That feature turns your project into
a login provider for other people's apps. It is not part of this.

---

## STEP 4 — Environment

`.env.local` goes in the project root, next to `package.json`. Two lines:

```
VITE_SUPABASE_URL=https://<REF>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key from Project Settings → API>
```

On Windows, create it from the terminal so Notepad can't silently save it as
`.env.local.txt`:

```
printf 'VITE_SUPABASE_URL=https://<REF>.supabase.co\nVITE_SUPABASE_ANON_KEY=<key>\n' > .env.local
```

Vite reads env files once, at startup, from the directory it was launched in.
After any change: stop the server with Ctrl+C and start it again. Refreshing
the browser does nothing.

---

## STEP 5 — Run

```
npm install
npm run dev
```

Expected: sign-in screen with one "Continue with Google" button → Google account
chooser → back to the app → for a new account, a short profile step (general vs
student, name prefilled, optional phone) → the app.

---

## Optional dev flags

Skip sign-in entirely while working on something else:

```
VITE_AUTH_BYPASS=true
VITE_AUTH_BYPASS_ROLE=student          # or general
VITE_AUTH_BYPASS_NEEDS_PROFILE=true    # land on the profile step
```

Remove these before any real build. They fabricate a session and never contact
Supabase.

---

## Notes

- Business accounts (landlord, agent, company, contractor) still sign in with
  username and password via `localAuthProvider`, reachable from the "Pro, agent
  or landlord account" button. Moving those to Supabase is a separate job.
- Phone is now optional and collected in the profile step, not used as a login
  credential.
- `onboarded_at` is what decides whether the profile step shows. `account_type`
  can't do it — it has a NOT NULL DEFAULT of 'general', so a fresh row looks
  identical to a deliberate choice.
- If the app hangs on the splash screen, that is the `properties` query failing,
  not auth. Everything now loads from Supabase with no local fallback.
