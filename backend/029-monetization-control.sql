-- ImbaLink monetization control / Pro entitlement foundation
-- Monetization is OFF by default. No payment provider is connected here.
-- When an admin enables it, premium actions require BOTH an active Pro
-- registration and a verified account.

CREATE TABLE IF NOT EXISTS public.monetization_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT false,
  updated_by text REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.monetization_settings (id, enabled)
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.pro_registrations
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

ALTER TABLE public.pro_registrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pro_registrations_select_own ON public.pro_registrations;
CREATE POLICY pro_registrations_select_own ON public.pro_registrations
  FOR SELECT TO authenticated USING (user_id = auth.uid()::text);
DROP POLICY IF EXISTS pro_registrations_insert_own ON public.pro_registrations;
CREATE POLICY pro_registrations_insert_own ON public.pro_registrations
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()::text);
DROP POLICY IF EXISTS pro_registrations_update_own ON public.pro_registrations;
CREATE POLICY pro_registrations_update_own ON public.pro_registrations
  FOR UPDATE TO authenticated USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);

ALTER TABLE public.monetization_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS monetization_settings_read ON public.monetization_settings;
CREATE POLICY monetization_settings_read ON public.monetization_settings
  FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.get_monetization_config()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'enabled', COALESCE((SELECT enabled FROM public.monetization_settings WHERE id = 1), false)
  )
$$;
REVOKE ALL ON FUNCTION public.get_monetization_config() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_monetization_config() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_pro_access()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id text := auth.uid()::text;
  v_enabled boolean := false;
  v_is_pro boolean := false;
  v_is_verified boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('enabled', false, 'is_pro', false, 'is_verified', false, 'can_access', false);
  END IF;

  SELECT COALESCE(enabled, false) INTO v_enabled
  FROM public.monetization_settings WHERE id = 1;

  SELECT EXISTS (
    SELECT 1 FROM public.pro_registrations pr
    WHERE pr.user_id = v_user_id
      AND COALESCE(pr.status, 'active') = 'active'
      AND (pr.starts_at IS NULL OR pr.starts_at <= now())
      AND (pr.expires_at IS NULL OR pr.expires_at > now())
  ) INTO v_is_pro;

  -- Verification is account-type aware. A verified student, landlord,
  -- agent/company/contractor qualifies; a general account does not.
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = v_user_id
      AND (
        (u.account_type = 'student' AND EXISTS (
          SELECT 1 FROM public.student_profiles sp
          WHERE sp.user_id = u.id AND sp.verification_status = 'verified'
        ))
        OR
        (u.account_type = 'landlord' AND EXISTS (
          SELECT 1 FROM public.landlord_verifications lv
          WHERE lv.user_id = u.id AND lv.verification_status = 'verified'
        ))
        OR
        (u.account_type IN ('agent','company') AND EXISTS (
          SELECT 1 FROM public.registrations r
          WHERE r.user_id = u.id AND r.kind = u.account_type AND r.verification_status = 'verified'
        ))
        OR
        (u.account_type = 'contractor' AND EXISTS (
          SELECT 1 FROM public.contractors c
          WHERE c.user_id = u.id AND c.verification = 'verified'
        ))
      )
  ) INTO v_is_verified;

  RETURN jsonb_build_object(
    'enabled', v_enabled,
    'is_pro', v_is_pro,
    'is_verified', v_is_verified,
    'can_access', (NOT v_enabled) OR (v_is_pro AND v_is_verified)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_my_pro_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_pro_access() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_monetization_enabled(p_enabled boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_user_id text := auth.uid()::text;
BEGIN
  IF COALESCE(auth.jwt()->'app_metadata'->>'role','') <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can change monetization settings';
  END IF;

  INSERT INTO public.monetization_settings (id, enabled, updated_by, updated_at)
  VALUES (1, p_enabled, v_user_id, now())
  ON CONFLICT (id) DO UPDATE SET enabled = EXCLUDED.enabled, updated_by = EXCLUDED.updated_by, updated_at = now();

  RETURN jsonb_build_object('enabled', p_enabled, 'updated_by', v_user_id, 'updated_at', now());
END;
$$;
REVOKE ALL ON FUNCTION public.set_monetization_enabled(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_monetization_enabled(boolean) TO authenticated;

-- Realtime synchronization for the admin switch and user entitlements.
ALTER TABLE public.monetization_settings REPLICA IDENTITY FULL;
ALTER TABLE public.pro_registrations REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.monetization_settings; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.pro_registrations; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

NOTIFY pgrst, 'reload schema';

-- Once monetization is ON, customer-created listings are a Pro action.
-- Existing listings remain editable by their owners. Admin/service-role
-- imports are unaffected because auth.uid() is absent there.
CREATE OR REPLACE FUNCTION public.require_pro_for_new_listing()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_access jsonb;
BEGIN
  IF NEW.owner_user_id IS NULL THEN RETURN NEW; END IF;
  IF COALESCE((SELECT enabled FROM public.monetization_settings WHERE id = 1), false) = false THEN
    RETURN NEW;
  END IF;
  IF COALESCE(auth.jwt()->'app_metadata'->>'role','') = 'admin' THEN RETURN NEW; END IF;
  v_access := public.get_my_pro_access();
  IF COALESCE((v_access->>'can_access')::boolean, false) = false THEN
    RAISE EXCEPTION 'A verified Pro membership is required to publish listings while monetization is enabled';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS require_pro_for_new_listing ON public.properties;
CREATE TRIGGER require_pro_for_new_listing
BEFORE INSERT ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.require_pro_for_new_listing();
