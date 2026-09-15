-- ImbaLink live feed / Supabase Realtime
-- Run this once in the Supabase SQL Editor after the base schema.
-- Realtime is used only while the web app is open; the client does not poll.

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.properties;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.property_images;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;

-- Realtime respects the table's RLS policies. The existing SELECT policies
-- therefore remain the source of truth for which listings a signed-in user
-- is allowed to receive.
