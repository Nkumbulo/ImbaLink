-- ImbaLink landlord identity verification
-- Run after backend/schema.sql and backend/002-app-alignment.sql.
--
-- ID images are stored in a PRIVATE Supabase Storage bucket. The database
-- stores only the private object path, never a public URL.

CREATE TABLE IF NOT EXISTS public.landlord_verifications (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  phone               TEXT NOT NULL,
  id_image_path       TEXT NOT NULL,
  verification_status verification_status NOT NULL DEFAULT 'pending',
  submitted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by         TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at         TIMESTAMPTZ,
  review_note         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_landlord_verifications_status
  ON public.landlord_verifications (verification_status, submitted_at DESC);

ALTER TABLE public.landlord_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS landlord_verifications_select_own ON public.landlord_verifications;
CREATE POLICY landlord_verifications_select_own
  ON public.landlord_verifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS landlord_verifications_insert_own ON public.landlord_verifications;
CREATE POLICY landlord_verifications_insert_own
  ON public.landlord_verifications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS landlord_verifications_update_own ON public.landlord_verifications;
CREATE POLICY landlord_verifications_update_own
  ON public.landlord_verifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- Private bucket for identity documents. Do NOT make this bucket public.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'identity-documents',
  'identity-documents',
  false,
  5242880,
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp'];

DROP POLICY IF EXISTS identity_documents_insert_own ON storage.objects;
CREATE POLICY identity_documents_insert_own
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'identity-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS identity_documents_select_own ON storage.objects;
CREATE POLICY identity_documents_select_own
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'identity-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS identity_documents_update_own ON storage.objects;
CREATE POLICY identity_documents_update_own
  ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'identity-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'identity-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS identity_documents_delete_own ON storage.objects;
CREATE POLICY identity_documents_delete_own
  ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'identity-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
