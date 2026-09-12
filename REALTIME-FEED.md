# ImbaLink — instant feed updates

The web app now uses Supabase Realtime instead of polling for new property
listings.

## What happens

1. A landlord creates a row in `properties`.
2. Supabase Realtime broadcasts the INSERT to open ImbaLink tabs.
3. The active feed inserts the listing at the top immediately when it matches
   the user's current city/search/filter.
4. `property_images` INSERT events add the first image as soon as it is stored.
5. UPDATE and DELETE events update/remove the listing without a manual refresh.

## Supabase setup

Run `backend/005-realtime-feed.sql` once in the Supabase SQL Editor.

The app intentionally does **not** use a timer such as `setInterval()` to
poll the properties table. This avoids making thousands of unnecessary
requests when users are simply browsing.

## Important

Supabase Realtime still follows Row Level Security. Make sure the `properties`
and `property_images` SELECT policies allow the users who should receive the
feed events to read those rows.
