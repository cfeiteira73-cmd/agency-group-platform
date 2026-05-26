-- =============================================================================
-- Agency Group — Wave 42: ML Opportunity Intelligence Tables
-- supabase/migrations/000078_ml_opportunity.sql
--
-- Creates:
--   ml_optimization_cycles           — tracks ML weight/threshold optimization runs
--   scoring_weight_history           — persists evolving scoring weight vectors
--   market_intelligence_snapshots_v2 — per-market supply/opportunity/capital metrics
--   global_intelligence_reports      — cross-market aggregated intelligence
--
-- All EUR amounts in bigint (cents) — never float for money.
-- All tables: IF NOT EXISTS, RLS enabled, tenant isolation policy, indexes.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ml_optimization_cycles
-- Tracks each ML optimization cycle: signals analyzed, accuracy, adjustments.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ml_optimization_cycles (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id               text        UNIQUE NOT NULL,
  tenant_id              text        NOT NULL,
  signals_analyzed       int         DEFAULT 0,
  truth_labels_used      int         DEFAULT 0,
  optimizations_applied  jsonb       DEFAULT '[]',
  accuracy_before        numeric(4,3) DEFAULT 0,
  accuracy_after         numeric(4,3) DEFAULT 0,
  weight_adjustments     jsonb       DEFAULT '{}',
  threshold_adjustments  jsonb       DEFAULT '{}',
  ran_at                 timestamptz DEFAULT now()
);

ALTER TABLE ml_optimization_cycles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_ml_optimization_cycles ON ml_optimization_cycles;
CREATE POLICY tenant_isolation_ml_optimization_cycles
  ON ml_optimization_cycles
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_ml_optimization_cycles_tenant_ran_at
  ON ml_optimization_cycles (tenant_id, ran_at DESC);

CREATE INDEX IF NOT EXISTS idx_ml_optimization_cycles_cycle_id
  ON ml_optimization_cycles (cycle_id);

-- ---------------------------------------------------------------------------
-- scoring_weight_history
-- Persists the evolving scoring weight vector after each optimization cycle.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS scoring_weight_history (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          text        NOT NULL,
  undervaluation     numeric(4,3) DEFAULT 0.30,
  liquidity          numeric(4,3) DEFAULT 0.25,
  investor_demand    numeric(4,3) DEFAULT 0.20,
  risk_adjusted_roi  numeric(4,3) DEFAULT 0.15,
  source_confidence  numeric(4,3) DEFAULT 0.10,
  adjusted_at        timestamptz DEFAULT now(),
  trigger            text
);

ALTER TABLE scoring_weight_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_scoring_weight_history ON scoring_weight_history;
CREATE POLICY tenant_isolation_scoring_weight_history
  ON scoring_weight_history
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_scoring_weight_history_tenant_adjusted_at
  ON scoring_weight_history (tenant_id, adjusted_at DESC);

-- ---------------------------------------------------------------------------
-- market_intelligence_snapshots_v2
-- Per-market supply + opportunity + capital metrics snapshot.
-- Uses _v2 suffix to avoid conflict with market_intelligence_snapshots (000062).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS market_intelligence_snapshots_v2 (
  id                            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id                   text        UNIQUE NOT NULL,
  tenant_id                     text        NOT NULL,
  market                        text        NOT NULL,

  -- Supply metrics
  total_active_listings         int         DEFAULT 0,
  new_listings_7d               int         DEFAULT 0,
  delisted_7d                   int         DEFAULT 0,
  avg_asking_price_eur_cents    bigint      DEFAULT 0,
  avg_price_per_sqm_eur_cents   bigint      DEFAULT 0,
  avg_days_on_market            int         DEFAULT 0,

  -- Opportunity metrics
  total_opportunities           int         DEFAULT 0,
  high_score_opportunities      int         DEFAULT 0,
  distressed_pct                numeric(4,3) DEFAULT 0,
  avg_opportunity_score         numeric(5,2) DEFAULT 0,

  -- Capital metrics
  active_investors              int         DEFAULT 0,
  available_capital_eur_cents   bigint      DEFAULT 0,

  -- Pricing accuracy
  system_vs_market_gap_pct      numeric(8,4),

  -- Trends
  price_trend                   text        DEFAULT 'STABLE',
  opportunity_trend             text        DEFAULT 'STABLE',

  generated_at                  timestamptz DEFAULT now()
);

ALTER TABLE market_intelligence_snapshots_v2 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_market_intelligence_snapshots_v2 ON market_intelligence_snapshots_v2;
CREATE POLICY tenant_isolation_market_intelligence_snapshots_v2
  ON market_intelligence_snapshots_v2
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_market_intelligence_snapshots_v2_tenant_market_generated
  ON market_intelligence_snapshots_v2 (tenant_id, market, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_intelligence_snapshots_v2_tenant_generated
  ON market_intelligence_snapshots_v2 (tenant_id, generated_at DESC);

-- ---------------------------------------------------------------------------
-- global_intelligence_reports
-- Cross-market aggregated intelligence report (Bloomberg terminal view).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS global_intelligence_reports (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id                 text        UNIQUE NOT NULL,
  tenant_id                 text        NOT NULL,
  markets_analyzed          int         DEFAULT 0,
  total_supply              int         DEFAULT 0,
  total_opportunities       int         DEFAULT 0,
  total_capital_eur_cents   bigint      DEFAULT 0,
  best_market               text,
  top_opportunity_city      text,
  avg_opportunity_score     numeric(5,2) DEFAULT 0,
  market_snapshots          jsonb       DEFAULT '[]',
  generated_at              timestamptz DEFAULT now()
);

ALTER TABLE global_intelligence_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_global_intelligence_reports ON global_intelligence_reports;
CREATE POLICY tenant_isolation_global_intelligence_reports
  ON global_intelligence_reports
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_global_intelligence_reports_tenant_generated
  ON global_intelligence_reports (tenant_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_global_intelligence_reports_report_id
  ON global_intelligence_reports (report_id);
