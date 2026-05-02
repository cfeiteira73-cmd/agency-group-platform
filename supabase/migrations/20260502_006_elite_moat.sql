-- =============================================================================
-- Agency Group — Elite Moat Layer
-- Migration: 20260502_006_elite_moat.sql
--
-- New tables:
--   model_versions            — scoring model version registry
--   calibration_simulations   — simulation sandbox runs
--   market_segment_trends     — multi-period (7d/30d/90d) market snapshots
--   cron_lock                 — distributed cron concurrency guard
--
-- New views:
--   v_model_version_history   — deployment timeline
--   v_market_trend_comparison — 7d vs 30d vs 90d per segment
--   v_cron_health             — cron execution health
--   v_sla_breach_summary      — current SLA breaches
--
-- All DDL is idempotent (IF NOT EXISTS / OR REPLACE)
-- Rollback: 20260502_006_rollback.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. model_versions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS model_versions (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  version_name    TEXT         NOT NULL,                        -- e.g. 'v2.3-yield-boost'
  scorer_version  TEXT         NOT NULL,                        -- 'v1' | 'v2' | custom
  description     TEXT,
  config          JSONB        NOT NULL DEFAULT '{}',           -- weight overrides, threshold changes
  status          TEXT         NOT NULL DEFAULT 'draft'         -- draft | staging | production | archived
                               CHECK (status IN ('draft','staging','production','archived')),
  backtest_score  NUMERIC(6,2),                                 -- aggregate quality metric from simulation
  promoted_at     TIMESTAMPTZ,
  promoted_by     TEXT,
  archived_at     TIMESTAMPTZ,
  archived_by     TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_by      TEXT
);

CREATE INDEX IF NOT EXISTS idx_model_versions_status   ON model_versions(status);
CREATE INDEX IF NOT EXISTS idx_model_versions_created  ON model_versions(created_at DESC);

ALTER TABLE model_versions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'model_versions' AND policyname = 'service_role_model_versions'
  ) THEN
    CREATE POLICY service_role_model_versions ON model_versions USING (auth.role() = 'service_role');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. calibration_simulations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calibration_simulations (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version_id UUID         REFERENCES model_versions(id) ON DELETE SET NULL,
  simulation_name  TEXT         NOT NULL,
  description      TEXT,
  property_count   INTEGER,
  property_ids     JSONB,                                       -- sampled property UUIDs
  score_results    JSONB,                                       -- { property_id: { v1_score, v2_score, delta } }
  metrics          JSONB,                                       -- { mae, rmse, grade_accuracy, distribution_delta }
  comparison       JSONB,                                       -- before/after grade distribution
  status           TEXT         NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','running','complete','failed')),
  error_message    TEXT,
  run_by           TEXT,
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cal_sim_version    ON calibration_simulations(model_version_id);
CREATE INDEX IF NOT EXISTS idx_cal_sim_status     ON calibration_simulations(status);
CREATE INDEX IF NOT EXISTS idx_cal_sim_created    ON calibration_simulations(created_at DESC);

ALTER TABLE calibration_simulations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'calibration_simulations' AND policyname = 'service_role_cal_sim'
  ) THEN
    CREATE POLICY service_role_cal_sim ON calibration_simulations USING (auth.role() = 'service_role');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. market_segment_trends
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS market_segment_trends (
  id                      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_key                TEXT         NOT NULL,
  property_type           TEXT         NOT NULL,
  price_band              TEXT         NOT NULL DEFAULT 'all'
                                       CHECK (price_band IN ('under_200k','200k_500k','500k_1m','1m_3m','over_3m','all')),
  period_label            TEXT         NOT NULL CHECK (period_label IN ('7d','30d','90d')),
  snapshot_date           DATE         NOT NULL DEFAULT CURRENT_DATE,

  -- Pricing
  avg_price_per_sqm       NUMERIC(10,2),
  median_price_per_sqm    NUMERIC(10,2),
  price_confidence_low    NUMERIC(10,2),
  price_confidence_high   NUMERIC(10,2),
  price_trend             TEXT         CHECK (price_trend IN ('rising','stable','falling','unknown')),

  -- Negotiation
  avg_negotiation_delta   NUMERIC(6,2),                        -- % above/below ask
  median_negotiation_delta NUMERIC(6,2),
  pct_sold_above_ask      NUMERIC(5,2),

  -- Sale-to-ask
  avg_sale_to_ask_ratio   NUMERIC(6,4),

  -- Liquidity
  avg_days_to_close       NUMERIC(6,1),
  median_days_to_close    NUMERIC(6,1),
  deal_count              INTEGER      NOT NULL DEFAULT 0,

  -- AVM accuracy
  avg_avm_error_pct       NUMERIC(6,2),
  avm_mae                 NUMERIC(10,2),

  -- Investor conversion
  investor_deal_pct       NUMERIC(5,2),
  agent_deal_pct          NUMERIC(5,2),

  -- Confidence
  confidence_score        NUMERIC(5,2) DEFAULT 0,              -- 0-100; based on sample size
  sample_size             INTEGER      DEFAULT 0,

  -- Regime shift
  regime_shift_detected   BOOLEAN      NOT NULL DEFAULT FALSE,
  regime_shift_metric     TEXT,                                 -- which metric triggered the flag
  regime_shift_magnitude  NUMERIC(6,2),

  computed_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  UNIQUE (zone_key, property_type, price_band, period_label, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_mst_zone_type_period ON market_segment_trends(zone_key, property_type, period_label);
CREATE INDEX IF NOT EXISTS idx_mst_snapshot_date    ON market_segment_trends(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_mst_regime_shift     ON market_segment_trends(regime_shift_detected) WHERE regime_shift_detected = TRUE;

ALTER TABLE market_segment_trends ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'market_segment_trends' AND policyname = 'service_role_mst'
  ) THEN
    CREATE POLICY service_role_mst ON market_segment_trends USING (auth.role() = 'service_role');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. cron_lock
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cron_lock (
  cron_name       TEXT         PRIMARY KEY,
  locked_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ  NOT NULL,
  instance_id     TEXT         NOT NULL,                       -- unique per invocation (UUID)
  last_released_at TIMESTAMPTZ
);

-- No RLS needed — only accessed by service role

-- ---------------------------------------------------------------------------
-- 5. Views
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW v_model_version_history AS
SELECT
  id,
  version_name,
  scorer_version,
  status,
  backtest_score,
  promoted_at,
  promoted_by,
  created_at,
  created_by,
  CASE WHEN status = 'production' THEN TRUE ELSE FALSE END AS is_current,
  description
FROM model_versions
ORDER BY created_at DESC;

-- Multi-period comparison per segment (latest snapshot per period)
CREATE OR REPLACE VIEW v_market_trend_comparison AS
SELECT
  a.zone_key,
  a.property_type,
  a.price_band,
  -- 7d
  a.avg_price_per_sqm      AS price_7d,
  a.avg_negotiation_delta  AS neg_delta_7d,
  a.deal_count             AS deals_7d,
  a.confidence_score       AS confidence_7d,
  a.regime_shift_detected  AS shift_7d,
  -- 30d
  b.avg_price_per_sqm      AS price_30d,
  b.avg_negotiation_delta  AS neg_delta_30d,
  b.deal_count             AS deals_30d,
  b.confidence_score       AS confidence_30d,
  b.regime_shift_detected  AS shift_30d,
  -- 90d
  c.avg_price_per_sqm      AS price_90d,
  c.avg_negotiation_delta  AS neg_delta_90d,
  c.deal_count             AS deals_90d,
  c.confidence_score       AS confidence_90d,
  c.regime_shift_detected  AS shift_90d,
  -- Derived trend signal
  CASE
    WHEN a.avg_price_per_sqm > b.avg_price_per_sqm AND b.avg_price_per_sqm > c.avg_price_per_sqm THEN 'accelerating'
    WHEN a.avg_price_per_sqm > c.avg_price_per_sqm THEN 'rising'
    WHEN a.avg_price_per_sqm < c.avg_price_per_sqm THEN 'falling'
    ELSE 'stable'
  END AS overall_price_trend,
  GREATEST(a.computed_at, b.computed_at, c.computed_at) AS last_computed_at
FROM (
  SELECT DISTINCT ON (zone_key, property_type, price_band)
    * FROM market_segment_trends WHERE period_label = '7d'
    ORDER BY zone_key, property_type, price_band, snapshot_date DESC
) a
JOIN (
  SELECT DISTINCT ON (zone_key, property_type, price_band)
    * FROM market_segment_trends WHERE period_label = '30d'
    ORDER BY zone_key, property_type, price_band, snapshot_date DESC
) b USING (zone_key, property_type, price_band)
JOIN (
  SELECT DISTINCT ON (zone_key, property_type, price_band)
    * FROM market_segment_trends WHERE period_label = '90d'
    ORDER BY zone_key, property_type, price_band, snapshot_date DESC
) c USING (zone_key, property_type, price_band);

-- Cron execution health
CREATE OR REPLACE VIEW v_cron_health AS
SELECT
  al.workflow_name                                         AS cron_name,
  COUNT(*)                                                 AS total_runs,
  SUM(CASE WHEN al.status = 'success' THEN 1 ELSE 0 END)  AS successful_runs,
  SUM(CASE WHEN al.status = 'error'   THEN 1 ELSE 0 END)  AS failed_runs,
  MAX(al.created_at)                                       AS last_run_at,
  MAX(CASE WHEN al.status = 'success' THEN al.created_at END) AS last_success_at,
  MAX(CASE WHEN al.status = 'error'   THEN al.created_at END) AS last_error_at,
  ROUND(
    100.0 * SUM(CASE WHEN al.status = 'success' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0),
    1
  )                                                        AS success_rate_pct,
  cl.locked_at                                             AS currently_locked_since,
  cl.expires_at                                            AS lock_expires_at
FROM automations_log al
LEFT JOIN cron_lock cl ON cl.cron_name = al.workflow_name AND cl.expires_at > NOW()
WHERE al.created_at > NOW() - INTERVAL '7 days'
GROUP BY al.workflow_name, cl.locked_at, cl.expires_at
ORDER BY last_run_at DESC NULLS LAST;

-- SLA breach summary
CREATE OR REPLACE VIEW v_sla_breach_summary AS
SELECT
  st.deal_id,
  st.stage,
  st.sla_deadline,
  st.breach_at,
  st.breach_severity,
  st.assigned_to,
  d.stage                          AS current_deal_stage,
  d.contact_name,
  EXTRACT(EPOCH FROM (NOW() - st.breach_at)) / 3600 AS hours_overdue,
  CASE
    WHEN EXTRACT(EPOCH FROM (NOW() - st.breach_at)) / 3600 > 48 THEN 'critical'
    WHEN EXTRACT(EPOCH FROM (NOW() - st.breach_at)) / 3600 > 24 THEN 'high'
    ELSE 'medium'
  END AS breach_urgency
FROM sla_tracking st
JOIN deals d ON d.id = st.deal_id
WHERE st.breach_at IS NOT NULL
  AND d.stage NOT IN ('won', 'lost', 'withdrawn')
ORDER BY hours_overdue DESC;

-- ---------------------------------------------------------------------------
-- Seed: initial production model version entry
-- ---------------------------------------------------------------------------
INSERT INTO model_versions (
  version_name, scorer_version, description, status, config, created_by
)
VALUES (
  'v2.0-production', 'v2',
  'OpportunityScoreV2 — 6 dimensions + 5 bonus factors + confidence penalty — production baseline',
  'production',
  '{"version": "v2", "weights": {"price_vs_zone": 0.25, "rental_yield": 0.20, "momentum": 0.20, "supply_demand": 0.15, "signal_bonus": 0.10, "quality_penalty": 0.10}}',
  'system/migration'
)
ON CONFLICT DO NOTHING;
