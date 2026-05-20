-- Wave 15: Create system_alerts table
-- Applied via Supabase MCP on 2026-05-20 (Wave 15 Absolute System Truth)
-- Used by: lib/ops/alertEngine.ts, lib/observability/alertRouter.ts, lib/observability/anomalyMonitoring.ts

CREATE TABLE IF NOT EXISTS public.system_alerts (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id         TEXT        GENERATED ALWAYS AS (id::text) STORED,
  alert_type       TEXT        NOT NULL,
  severity         TEXT        NOT NULL CHECK (severity IN ('P0','P1','P2','P3','INFO')),
  title            TEXT        NOT NULL,
  message          TEXT        NOT NULL,
  org_id           UUID        REFERENCES public.organizations(id) ON DELETE SET NULL,
  context          JSONB       NOT NULL DEFAULT '{}',
  metadata         JSONB       NOT NULL DEFAULT '{}',
  dedup_key        TEXT,
  status           TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
  acknowledged     BOOLEAN     NOT NULL DEFAULT false,
  acknowledged_by  TEXT,
  acknowledged_at  TIMESTAMPTZ,
  resolved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_alerts_status    ON public.system_alerts (status);
CREATE INDEX IF NOT EXISTS idx_system_alerts_severity  ON public.system_alerts (severity);
CREATE INDEX IF NOT EXISTS idx_system_alerts_org_id    ON public.system_alerts (org_id);
CREATE INDEX IF NOT EXISTS idx_system_alerts_dedup_key ON public.system_alerts (dedup_key) WHERE dedup_key IS NOT NULL;

ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;

-- Org members can read their org's alerts
CREATE POLICY "org_members_select" ON public.system_alerts
  FOR SELECT
  USING (
    org_id IS NULL
    OR org_id IN (
      SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
    )
  );

-- Service role only for writes (alertEngine uses supabaseAdmin)
CREATE POLICY "service_insert" ON public.system_alerts
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "service_update" ON public.system_alerts
  FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "service_delete" ON public.system_alerts
  FOR DELETE
  USING (auth.role() = 'service_role');
