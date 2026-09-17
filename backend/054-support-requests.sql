-- ImbaLink support inbox: app-wide bug, safety and support reports.
CREATE TABLE IF NOT EXISTS public.support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'problem' CHECK (kind IN ('problem','safety','support','feedback')),
  category text NOT NULL DEFAULT 'other',
  message text NOT NULL CHECK (length(btrim(message)) >= 10 AND length(message) <= 5000),
  contact text NULL,
  page_context text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','resolved','dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_requests_status_created ON public.support_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_requests_user ON public.support_requests(user_id, created_at DESC);
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS support_requests_insert ON public.support_requests;
CREATE POLICY support_requests_insert ON public.support_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
DROP POLICY IF EXISTS support_requests_read_own ON public.support_requests;
CREATE POLICY support_requests_read_own ON public.support_requests FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS support_requests_staff ON public.support_requests;
CREATE POLICY support_requests_staff ON public.support_requests FOR ALL TO authenticated USING (public.is_staff_caller()) WITH CHECK (public.is_staff_caller());
GRANT SELECT, INSERT ON public.support_requests TO authenticated;
