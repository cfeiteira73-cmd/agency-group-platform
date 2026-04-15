-- =============================================================================
-- Migration 037 — nurture_log
-- Tracks which nurture emails have been sent per contact per sequence day
-- Prevents duplicate sends from n8n wf-R hourly runs
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.nurture_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id    TEXT NOT NULL,
  sequence_day  INTEGER NOT NULL CHECK (sequence_day IN (1, 7, 30)),
  email         TEXT NOT NULL,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Deduplicate: one row per contact per sequence day
  CONSTRAINT nurture_log_contact_day_unique UNIQUE (contact_id, sequence_day)
);

-- Index for efficient lookups by contact
CREATE INDEX IF NOT EXISTS idx_nurture_log_contact_id ON public.nurture_log (contact_id);

-- Index for analytics by day/date
CREATE INDEX IF NOT EXISTS idx_nurture_log_sent_at ON public.nurture_log (sent_at);

-- RLS: disable for service role access (n8n wf-R and API use service_role key)
ALTER TABLE public.nurture_log DISABLE ROW LEVEL SECURITY;

-- Grant to authenticated + anon (API routes use service_role which bypasses RLS anyway)
GRANT SELECT, INSERT ON public.nurture_log TO authenticated;
GRANT SELECT, INSERT ON public.nurture_log TO anon;

COMMENT ON TABLE public.nurture_log IS
  'Tracks nurture emails sent per contact. sequence_day IN (1,7,30). Prevents duplicate sends from wf-R hourly cron.';
