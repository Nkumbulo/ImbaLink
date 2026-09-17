# ImbaLink desktop administration integration

The desktop administration platform is available at:

- `/admin/login` — staff Google sign-in
- `/admin` — desktop dashboard
- `/admin/users`
- `/admin/properties`
- `/admin/students`
- `/admin/contractors`
- `/admin/reports`
- `/admin/verifications`
- `/admin/operations`
- `/admin/analytics`
- `/admin/settings` — administrator role only

The existing in-app `AdminPage` has not been removed or replaced. It remains available through the normal ImbaLink application.

## Authentication

The desktop login uses the existing Supabase Auth session and Google provider. Access is granted only when the Supabase JWT `app_metadata.role` is `admin`, `moderator`, or `staff`. The backend migrations already present in this project use the same server-side role check (`is_staff_caller()`).

For a deployed site, add the exact deployed URL ending in `/admin/login` to the Supabase Auth URL configuration / Google OAuth redirect allow-list.

## Hosting

`public/_redirects` is included so direct navigation to `/admin`, `/admin/login`, and the admin sub-pages resolves to the Vite SPA on Netlify.
