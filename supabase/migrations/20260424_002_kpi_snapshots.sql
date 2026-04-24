-- =============================================================================
-- Agency Group · Migration 20260424_002
-- KPI Snapshots table — daily performance metrics
-- =============================================================================

CREATE TABLE IF NOT EXISTS kpi_snapshots (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date       DATE        NOT NULL UNIQUE,   -- one row per day

  -- Lead / CRM metrics
  total_leads         INT         NOT NULL DEFAULT 0,
  new_leads_today     INT         NOT NULL DEFAULT 0,
  active_leads        INT         NOT NULL DEFAULT 0,
  vip_leads           INT         NOT NULL DEFAULT 0,
  leads_by_status     JSONB       NOT NULL DEFAULT '{}',

  -- Deal pipeline metrics
  total_deals         INT         NOT NULL DEFAULT 0,
  deals_by_stage      JSONB       NOT NULL DEFAULT '{}',
  pipeline_value      BIGINT      NOT NULL DEFAULT 0,   -- EUR
  avg_deal_value      BIGINT      NOT NULL DEFAULT 0,   -- EUR

  -- Property metrics
  total_properties    INT         NOT NULL DEFAULT 0,
  active_properties   INT         NOT NULL DEFAULT 0,
  exclusive_properties INT        NOT NULL DEFAULT 0,
  off_market_properties INT       NOT NULL DEFAULT 0,

  -- Matching metrics
  total_matches       INT         NOT NULL DEFAULT 0,
  matches_today       INT         NOT NULL DEFAULT 0,
  interested_matches  INT         NOT NULL DEFAULT 0,  -- status = interested/visit_scheduled
  avg_match_score     DECIMAL(5,2),

  -- Campaign metrics
  campaigns_sent      INT         NOT NULL DEFAULT 0,
  emails_delivered    INT         NOT NULL DEFAULT 0,

  -- Deal Pack metrics
  deal_packs_generated INT        NOT NULL DEFAULT 0,
  deal_packs_sent      INT        NOT NULL DEFAULT 0,
  deal_packs_viewed    INT        NOT NULL DEFAULT 0,

  -- Raw snapshot (for ad-hoc queries)
  raw_data            JSONB       NOT NULL DEFAULT '{}',

  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_date ON kpi_snapshots(snapshot_date DESC);

-- RLS — service_role only (read via internal API)
ALTER TABLE kpi_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "kpi_snapshots_service_role"
  ON kpi_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE kpi_snapshots IS
  'Daily KPI snapshot captured at 23:55 UTC by /api/cron/kpi-snapshot. '
  'One row per day (UNIQUE on snapshot_date). Used for dashboard trend charts.';
