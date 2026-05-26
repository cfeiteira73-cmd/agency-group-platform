-- =============================================================================
-- Agency Group — Wave 42: Opportunity Detection Tables
-- supabase/migrations/000074_opportunities.sql
--
-- Creates:
--   detected_opportunities  — canonical opportunity store
--   detection_cycle_logs    — audit log of detection runs
--   opportunity_feeds       — persisted feed snapshots
-- =============================================================================

-- ---------------------------------------------------------------------------
-- detected_opportunities
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS detected_opportunities (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id           text UNIQUE NOT NULL,
  tenant_id                text NOT NULL,
  asset_id                 text NOT NULL,
  opportunity_type         text NOT NULL,
  status                   text NOT NULL DEFAULT 'ACTIVE',

  -- Core scores (0–100)
  opportunity_score        numeric(5, 2),
  undervaluation_score     numeric(5, 2),
  liquidity_score          numeric(5, 2),
  urgency_score            numeric(5, 2),
  risk_score               numeric(5, 2),

  -- Financial (EUR cents, bigint — never float for money)
  asking_price_eur_cents   bigint,
  fair_value_eur_cents     bigint,
  potential_gain_eur_cents bigint,
  commission_eur_cents     bigint,
  roi_pct                  numeric(8, 4),

  -- Context
  market                   text,
  city                     text,
  property_type            text,

  -- Timestamps
  detected_at              timestamptz NOT NULL DEFAULT now(),
  expires_at               timestamptz,
  captured_at              timestamptz,

  -- Tenant isolation constraint
  UNIQUE (tenant_id, asset_id)
);

-- Row Level Security
ALTER TABLE detected_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "tenant_isolation_detected_opportunities"
  ON detected_opportunities
  USING (tenant_id = current_setting('app.tenant_id', true));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_detected_opp_tenant_status_score
  ON detected_opportunities (tenant_id, status, opportunity_score DESC);

CREATE INDEX IF NOT EXISTS idx_detected_opp_tenant_market_city
  ON detected_opportunities (tenant_id, market, city);

CREATE INDEX IF NOT EXISTS idx_detected_opp_tenant_type
  ON detected_opportunities (tenant_id, opportunity_type);

CREATE INDEX IF NOT EXISTS idx_detected_opp_tenant_detected_at
  ON detected_opportunities (tenant_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_detected_opp_asset_id
  ON detected_opportunities (asset_id);

-- ---------------------------------------------------------------------------
-- detection_cycle_logs
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS detection_cycle_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    text,
  detected     int,
  expired      int,
  total_active int,
  run_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE detection_cycle_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "tenant_isolation_detection_cycle_logs"
  ON detection_cycle_logs
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_detection_cycle_logs_tenant_run_at
  ON detection_cycle_logs (tenant_id, run_at DESC);

-- ---------------------------------------------------------------------------
-- opportunity_feeds
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS opportunity_feeds (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id                text UNIQUE,
  tenant_id              text,
  total_opportunities    int,
  items                  jsonb NOT NULL DEFAULT '[]',
  market_summary         jsonb NOT NULL DEFAULT '{}',
  avg_opportunity_score  numeric(5, 2),
  top_opportunity_type   text,
  generated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE opportunity_feeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "tenant_isolation_opportunity_feeds"
  ON opportunity_feeds
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_opportunity_feeds_tenant_generated_at
  ON opportunity_feeds (tenant_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_opportunity_feeds_feed_id
  ON opportunity_feeds (feed_id);
