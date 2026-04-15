-- =============================================================================
-- Migration 040 — property_alert_sent: dedup table for wf-Q property alerts
-- 2026-04-15
--
-- Context: n8n audit found wf-Q (Property Alert Matching) has no dedup —
-- every time a property is added, ALL matching subscribers receive an email
-- without checking if they already received an alert for that property.
-- This creates duplicate email spam for re-imported / re-published properties.
--
-- Pattern mirrors nurture_log (migration 037): UNIQUE (email, property_id)
-- before sending, wf-Q calls /api/automation/alert-check-sent to check + record
--
-- RUN IN: Supabase Dashboard → SQL Editor
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.property_alert_sent (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT        NOT NULL,
  property_id TEXT        NOT NULL,   -- property id or reference (from wf-Q payload)
  zona        TEXT,                   -- property zone at time of alert
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Deduplicate: one alert per email per property
  CONSTRAINT property_alert_sent_unique UNIQUE (email, property_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_property_alert_email
  ON public.property_alert_sent (email);

CREATE INDEX IF NOT EXISTS idx_property_alert_property_id
  ON public.property_alert_sent (property_id);

CREATE INDEX IF NOT EXISTS idx_property_alert_sent_at
  ON public.property_alert_sent (sent_at DESC);

-- RLS: disabled (service_role access only, same as nurture_log)
-- No anon access needed — all writes come from n8n via /api/automation/* routes

-- Grants
GRANT SELECT, INSERT ON public.property_alert_sent TO service_role;
-- Note: authenticated + anon roles do NOT get access — server-only table
