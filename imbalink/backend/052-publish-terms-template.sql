-- Publish the approved Terms & Conditions.
-- Replace the content below with the contents of IMBALINK-TERMS-AND-CONDITIONS.md
-- after legal review, and replace the date/version as appropriate.

update public.legal_documents
set
  title = 'ImbaLink Terms & Conditions',
  version = '1.0',
  effective_date = current_date,
  content = $$PASTE_APPROVED_IMBALINK_TERMS_HERE$$,
  is_published = true,
  updated_at = now()
where slug = 'terms-of-service';
