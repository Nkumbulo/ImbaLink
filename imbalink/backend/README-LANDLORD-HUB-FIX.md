# Landlord Hub fixes

Run `012-landlord-identity-verification.sql` in Supabase SQL Editor after the existing schema/alignment migrations.

The migration creates a private `identity-documents` Storage bucket and `landlord_verifications` table. ID image paths are stored in the table; the actual documents remain private.

The listing insert no longer writes `avatar_url` to `properties`. Landlord avatars continue to come from the public user profile view.
