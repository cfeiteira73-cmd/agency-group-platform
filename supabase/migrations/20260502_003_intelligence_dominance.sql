-- =============================================================================
-- Agency Group — Intelligence Dominance Layer Migration
-- 20260502_003_intelligence_dominance.sql
--
-- Implements:
--   Phase 1: Closed-loop learning tables (scoring_feedback extensions,
--            calibration_recommendations)
--   Phase 2: Agent performance tracking (agent_performance_metrics)
--   Phase 3: Distribution economics audit trail (distribution_events)
--   Phase 4: Investor intelligence layer (investor_intelligence)
--   Phase 5: Proprietary data moat (market_microstructure)
--
-- IDEMPOTENT: all DDL uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
-- ROLLBACK: see 20260502_003_rollback.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Phase 1a — Extend scoring_feedback_events with outcome fields
-- ---------------------------------------------------------------------------

ALTER TABLE scoring_feedback_events
  ADD COLUMN IF NOT EXISTS avm_value_at_time      NUMERIC(12,2),   -- AVM value when property was scored
  ADD COLUMN IF NOT EXISTS asking_price           NUMERIC(12,2),   -- listing price at time of close
  ADD COLUMN IF NOT EXISTS close_status           TEXT,            -- 'won','lost','stale','withdrawn'
  ADD COLUMN IF NOT EXISTS buyer_type             TEXT,            -- 'investor','owner_occupier','developer'
  ADD COLUMN IF NOT EXISTS negotiation_delta_pct  NUMERIC(7,3);    -- (sale_price - ask_price) / ask_price * 100

-- Index for drift analysis (lookups by date + outcome)
CREATE INDEX IF NOT EXISTS idx_sfe_close_status_date
  ON scoring_feedback_events (close_status, surfaced_at DESC)
  WHERE close_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sfe_agent_email
  ON scoring_feedback_events (agent_email)
  WHERE agent_email IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Phase 1b — Calibration recommendations persistence
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS calibration_recommendations (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Analysis metadata
  generated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period_analyzed_start TIMESTAMPTZ,
  period_analyzed_end   TIMESTAMPTZ,
  total_events_analyzed INTEGER     DEFAULT 0,
  -- Findings
  drift_signals         JSONB       NOT NULL DEFAULT '[]',   -- [{dimension, level, evidence}]
  recommendations       JSONB       NOT NULL DEFAULT '[]',   -- [{priority, dimension, observation, suggestion}]
  grade_performance     JSONB       DEFAULT NULL,            -- snapshot of v_scoring_performance
  data_quality          JSONB       DEFAULT NULL,            -- {has_enough_data, min_events, grades}
  -- Review lifecycle
  status                TEXT        NOT NULL DEFAULT 'pending',  -- 'pending','reviewed','applied','rejected'
  reviewed_by           TEXT,
  reviewed_at           TIMESTAMPTZ,
  applied_at            TIMESTAMPTZ,
  review_notes          TEXT,
  -- Timestamps
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cal_rec_status
  ON calibration_recommendations (status, generated_at DESC);

-- ---------------------------------------------------------------------------
-- Phase 2 — Agent performance metrics table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS agent_performance_metrics (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_email               TEXT        NOT NULL,
  -- Period
  period_start              DATE        NOT NULL,
  period_end                DATE        NOT NULL,
  period_label              TEXT,                              -- '30d', '90d', '365d'
  -- Activity
  total_deals_assigned      INTEGER     NOT NULL DEFAULT 0,
  total_deals_closed        INTEGER     NOT NULL DEFAULT 0,
  total_deals_lost          INTEGER     NOT NULL DEFAULT 0,
  total_deals_stale         INTEGER     NOT NULL DEFAULT 0,
  -- Core metrics
  close_rate                NUMERIC(5,4),                      -- closed / assigned (0-1)
  avg_days_to_close         NUMERIC(6,1),
  avg_negotiation_delta_pct NUMERIC(7,3),                      -- avg (sale - ask) / ask * 100
  avg_deal_size             NUMERIC(12,2),
  total_revenue             NUMERIC(14,2),
  -- Dimension scores (summing to execution_score)
  close_rate_score          NUMERIC(5,2) DEFAULT 0,            -- 0-30
  speed_score               NUMERIC(5,2) DEFAULT 0,            -- 0-20
  negotiation_score         NUMERIC(5,2) DEFAULT 0,            -- 0-25
  deal_size_score           NUMERIC(5,2) DEFAULT 0,            -- 0-15
  specialization_score      NUMERIC(5,2) DEFAULT 0,            -- 0-10
  -- Composite execution score
  agent_execution_score     NUMERIC(5,2) DEFAULT 0,            -- 0-100
  -- Specialization
  top_property_types        TEXT[]       DEFAULT '{}',
  top_zones                 TEXT[]       DEFAULT '{}',
  -- Timestamps
  computed_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One record per agent per period
  CONSTRAINT uq_agent_period UNIQUE (agent_email, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_apm_agent_email
  ON agent_performance_metrics (agent_email, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_apm_execution_score
  ON agent_performance_metrics (agent_execution_score DESC, computed_at DESC);

-- ---------------------------------------------------------------------------
-- Phase 3 — Distribution events audit trail
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS distribution_events (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Property context
  property_id           TEXT        NOT NULL,
  opportunity_score     INTEGER,
  opportunity_grade     TEXT,
  distribution_tier     TEXT        NOT NULL,                  -- 'A+','A','B','skip'
  -- Decision
  max_recipients        INTEGER     DEFAULT 0,
  recommended_agents    JSONB       NOT NULL DEFAULT '[]',     -- [{id, email, score, reason}]
  recommended_investors JSONB       NOT NULL DEFAULT '[]',     -- [{id, email, score, reason}]
  routing_rationale     TEXT,
  -- Execution
  actual_targets        JSONB       DEFAULT NULL,              -- populated after actual send
  event_status          TEXT        NOT NULL DEFAULT 'recommended',  -- 'recommended','executed','skipped'
  distributed_by        TEXT,                                  -- agent/system email
  distributed_at        TIMESTAMPTZ,
  -- Timestamps
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_de_property_id
  ON distribution_events (property_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_de_tier_status
  ON distribution_events (distribution_tier, event_status, created_at DESC);

-- FK to properties (soft — TEXT type allows referencing without strict FK)
CREATE INDEX IF NOT EXISTS idx_de_created_at
  ON distribution_events (created_at DESC);

-- ---------------------------------------------------------------------------
-- Phase 4 — Investor intelligence table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS investor_intelligence (
  investor_id               TEXT        PRIMARY KEY,           -- contacts.id
  -- Engagement counts
  total_surfaced            INTEGER     NOT NULL DEFAULT 0,
  total_opened              INTEGER     NOT NULL DEFAULT 0,
  total_replied             INTEGER     NOT NULL DEFAULT 0,
  total_meetings            INTEGER     NOT NULL DEFAULT 0,
  total_offers              INTEGER     NOT NULL DEFAULT 0,
  total_deals               INTEGER     NOT NULL DEFAULT 0,
  -- Computed rates (0-1)
  open_rate                 NUMERIC(5,4),
  reply_rate                NUMERIC(5,4),
  meeting_rate              NUMERIC(5,4),
  conversion_rate           NUMERIC(5,4),
  -- Inferred preferences (from behavior, not stated)
  preferred_asset_types     TEXT[]       DEFAULT '{}',
  preferred_zones           TEXT[]       DEFAULT '{}',
  preferred_price_min       NUMERIC(12,2),
  preferred_price_max       NUMERIC(12,2),
  inferred_yield_target     NUMERIC(5,2),                      -- % yield this investor tends to act on
  inferred_risk_tolerance   NUMERIC(4,3),                      -- 0-1 (0=low, 1=high)
  budget_adherence          NUMERIC(5,4),                      -- ratio of offers within stated budget
  -- Computed scores
  engagement_score          NUMERIC(5,2) DEFAULT 0,            -- 0-100
  fit_confidence            NUMERIC(4,3) DEFAULT 0.50,         -- 0-1 confidence in preferences
  -- Timestamps
  last_computed_at          TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_intel_engagement
  ON investor_intelligence (engagement_score DESC);

-- ---------------------------------------------------------------------------
-- Phase 5 — Market microstructure (proprietary data moat)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS market_microstructure (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Segmentation
  zone_key                    TEXT        NOT NULL,
  property_type               TEXT,                            -- NULL = all types
  period_label                TEXT        NOT NULL,            -- 'rolling-90d','2026-Q1', etc.
  -- Deal volume
  deal_count                  INTEGER     NOT NULL DEFAULT 0,
  -- Price intelligence
  avg_sale_price              NUMERIC(12,2),
  median_sale_price           NUMERIC(12,2),
  avg_ask_price               NUMERIC(12,2),
  sale_to_ask_ratio           NUMERIC(5,4),                    -- avg(realized/ask)
  -- Negotiation intelligence
  avg_negotiation_delta_pct   NUMERIC(7,3),                    -- avg (sale-ask)/ask * 100
  negotiation_delta_std_dev   NUMERIC(7,3),                    -- std dev of delta
  pct_sold_above_ask          NUMERIC(5,2),                    -- % deals above asking
  -- Time intelligence
  median_days_to_close        NUMERIC(6,1),
  avg_days_to_close           NUMERIC(6,1),
  -- AVM calibration data
  avm_mean_error_pct          NUMERIC(7,3),                    -- mean (sale-avm)/avm * 100
  avm_mae_pct                 NUMERIC(7,3),                    -- mean absolute error
  -- Demand signals
  avg_opportunity_score       NUMERIC(5,2),
  buyer_type_breakdown        JSONB        DEFAULT '{}',       -- {investor: n, owner: n, developer: n}
  -- Timestamps
  computed_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_microstructure_segment UNIQUE (zone_key, property_type, period_label)
);

CREATE INDEX IF NOT EXISTS idx_ms_zone_period
  ON market_microstructure (zone_key, period_label, computed_at DESC);

-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------

-- Latest agent performance (most recent period per agent)
CREATE OR REPLACE VIEW v_agent_performance_latest AS
SELECT DISTINCT ON (agent_email)
  *
FROM agent_performance_metrics
ORDER BY agent_email, computed_at DESC;

-- Market microstructure — rolling 90-day window (most recent)
CREATE OR REPLACE VIEW v_market_intelligence_current AS
SELECT DISTINCT ON (zone_key, property_type)
  zone_key,
  property_type,
  deal_count,
  sale_to_ask_ratio,
  avg_negotiation_delta_pct,
  median_days_to_close,
  avm_mae_pct,
  buyer_type_breakdown,
  computed_at
FROM market_microstructure
WHERE period_label = 'rolling-90d'
ORDER BY zone_key, property_type, computed_at DESC;

-- ---------------------------------------------------------------------------
-- Updated RPC: record_scoring_feedback with new outcome fields
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION record_scoring_feedback(
  p_property_id       TEXT,
  p_score             INTEGER,
  p_grade             TEXT,
  p_breakdown         JSONB,
  p_contact_id        TEXT,
  p_deal_pack_id      UUID,
  p_agent_email       TEXT,
  p_avm_value         NUMERIC    DEFAULT NULL,
  p_asking_price      NUMERIC    DEFAULT NULL,
  p_close_status      TEXT       DEFAULT NULL,
  p_buyer_type        TEXT       DEFAULT NULL,
  p_realized_price    NUMERIC    DEFAULT NULL,
  p_realized_dom      INTEGER    DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id UUID;
  v_neg_delta NUMERIC;
BEGIN
  -- Compute negotiation delta if we have both prices
  IF p_realized_price IS NOT NULL AND p_asking_price IS NOT NULL AND p_asking_price > 0 THEN
    v_neg_delta := (p_realized_price - p_asking_price) / p_asking_price * 100;
  END IF;

  INSERT INTO scoring_feedback_events (
    property_id, opportunity_score, opportunity_grade,
    score_breakdown, was_surfaced_to, deal_pack_id, agent_email,
    avm_value_at_time, asking_price, close_status, buyer_type,
    realized_sale_price, realized_dom, negotiation_delta_pct,
    deal_won
  )
  VALUES (
    p_property_id, p_score, p_grade,
    p_breakdown, p_contact_id, p_deal_pack_id, p_agent_email,
    p_avm_value, p_asking_price, p_close_status, p_buyer_type,
    p_realized_price, p_realized_dom, v_neg_delta,
    (p_close_status = 'won')
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS policies for new tables
-- ---------------------------------------------------------------------------

ALTER TABLE calibration_recommendations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_performance_metrics     ENABLE ROW LEVEL SECURITY;
ALTER TABLE distribution_events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_intelligence         ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_microstructure         ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='calibration_recommendations' AND policyname='service_role_cal_rec_all'
  ) THEN
    EXECUTE 'CREATE POLICY service_role_cal_rec_all ON calibration_recommendations FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='agent_performance_metrics' AND policyname='service_role_apm_all'
  ) THEN
    EXECUTE 'CREATE POLICY service_role_apm_all ON agent_performance_metrics FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='distribution_events' AND policyname='service_role_de_all'
  ) THEN
    EXECUTE 'CREATE POLICY service_role_de_all ON distribution_events FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='investor_intelligence' AND policyname='service_role_ii_all'
  ) THEN
    EXECUTE 'CREATE POLICY service_role_ii_all ON investor_intelligence FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='market_microstructure' AND policyname='service_role_ms_all'
  ) THEN
    EXECUTE 'CREATE POLICY service_role_ms_all ON market_microstructure FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Completion marker
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  RAISE NOTICE '20260502_003_intelligence_dominance.sql applied successfully';
END $$;
