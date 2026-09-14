-- ImbaLink Phase 6.3 — notify both parties on every viewing-request
-- transition, not just one side.
-- Run after 049-viewing-request-notification-sync.sql.
--
-- GAP THIS FIXES: notify_viewing_request_status_change() (049) only ever
-- inserted ONE notification row per transition — for whichever party did
-- NOT trigger it:
--   accepted/declined/completed -> only the tenant (NEW.user_id) was
--     notified. The landlord, who just took the action, got no
--     confirmation that it went through.
--   cancelled -> only the landlord (owner) was notified. The tenant who
--     cancelled got no confirmation either.
-- That was 019's original, explicit design ("viewing accepted/declined/
-- completed (tenant)") — this migration deliberately widens it: every
-- transition now notifies BOTH participants, each with copy written from
-- their own side (an acknowledgement for whoever acted, a plain
-- notice for whoever didn't).
--
-- Who the "actor" is for each status is inferred from the transition
-- itself, not a stored column, because respond_to_viewing_request() (016/
-- 047/049/050) already enforces this exact split server-side: only the
-- property owner may set accepted/declined/completed, only the requester
-- may set cancelled. No new column is needed to know which side acted.

BEGIN;

CREATE OR REPLACE FUNCTION public.notify_viewing_request_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_owner_id text;
  v_property_label text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;

  SELECT title, owner_user_id::text INTO v_title, v_owner_id
  FROM public.properties WHERE id::text = NEW.property_id::text;
  v_property_label := COALESCE(v_title, 'A listing');

  CASE NEW.status
    WHEN 'accepted' THEN
      -- Landlord accepted -> tenant gets the good news, landlord gets a
      -- confirmation their decision was saved.
      PERFORM public.create_notification(
        NEW.user_id, 'viewing_status', 'Viewing request accepted',
        v_property_label || ' — the landlord accepted your viewing request.',
        'property', NEW.property_id::text
      );
      IF v_owner_id IS NOT NULL THEN
        PERFORM public.create_notification(
          v_owner_id, 'viewing_status', 'Viewing request accepted',
          'You accepted the viewing request for ' || v_property_label || '.',
          'property', NEW.property_id::text
        );
      END IF;

    WHEN 'declined' THEN
      -- Landlord declined -> tenant is told plainly, landlord gets a
      -- confirmation their decision went through.
      PERFORM public.create_notification(
        NEW.user_id, 'viewing_status', 'Viewing request declined',
        v_property_label || ' — the landlord declined your viewing request.',
        'property', NEW.property_id::text
      );
      IF v_owner_id IS NOT NULL THEN
        PERFORM public.create_notification(
          v_owner_id, 'viewing_status', 'Viewing request declined',
          'You declined the viewing request for ' || v_property_label || '.',
          'property', NEW.property_id::text
        );
      END IF;

    WHEN 'cancelled' THEN
      -- Tenant cancelled -> landlord is told plainly, tenant gets a
      -- confirmation their cancellation went through.
      IF v_owner_id IS NOT NULL THEN
        PERFORM public.create_notification(
          v_owner_id, 'viewing_status', 'Viewing request cancelled',
          v_property_label || ' — the tenant cancelled their viewing request.',
          'property', NEW.property_id::text
        );
      END IF;
      PERFORM public.create_notification(
        NEW.user_id, 'viewing_status', 'Viewing request cancelled',
        'You cancelled your viewing request for ' || v_property_label || '.',
        'property', NEW.property_id::text
      );

    WHEN 'completed' THEN
      -- Landlord marked it completed -> tenant is told, landlord gets a
      -- confirmation.
      PERFORM public.create_notification(
        NEW.user_id, 'viewing_status', 'Viewing marked completed',
        v_property_label || ' — your viewing has been marked as completed.',
        'property', NEW.property_id::text
      );
      IF v_owner_id IS NOT NULL THEN
        PERFORM public.create_notification(
          v_owner_id, 'viewing_status', 'Viewing marked completed',
          'You marked the viewing for ' || v_property_label || ' as completed.',
          'property', NEW.property_id::text
        );
      END IF;

    ELSE
      RETURN NEW;
  END CASE;

  RETURN NEW;
END;
$$;

-- Trigger trg_notify_viewing_status_change (019-notifications.sql) already
-- points at this function by name — CREATE OR REPLACE above is enough,
-- no need to touch the trigger itself.

COMMIT;
