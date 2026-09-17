# ImbaLink image egress optimization

This build is optimized for image-heavy traffic such as 5,000 daily users.

## What changed

- Listing photos are limited to 8 per property (existing behavior).
- New listing photos are resized in the browser to a maximum 1280px long edge and JPEG quality 0.72 before upload.
- New listing photos are stored in the Supabase Storage `property-images` bucket instead of as base64/data URLs in the database.
- Property feeds and grids fetch only photo position 0. The other photos are not transferred until a user opens a listing.
- Property detail fetches the complete gallery only when the listing is opened.
- The detail gallery loads the visible photo first and loads the next photos only as the user navigates/swipes to them.
- Search/grid cards already use lazy image loading; desktop cards do not preload adjacent gallery slides.
- One-year browser/cache-control is applied to uploaded listing images so repeat requests can be served from cache.

## Supabase setup

Run `backend/004-property-image-storage.sql` in the Supabase SQL editor after the existing schema/migrations. It creates the public `property-images` bucket and the owner upload/update/delete policies.

Existing database rows containing data URLs are not automatically migrated by this patch. New listings will use Storage URLs. Old listings can continue to display as-is until they are migrated.
