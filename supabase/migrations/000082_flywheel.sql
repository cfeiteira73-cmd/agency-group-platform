-- =============================================================================
-- Agency Group — Flywheel & Supply Dominance Tables
-- Migration: 000082_flywheel.sql
--
-- Tables:
--   supply_dominance_snapshots  — per-market, per-period dominance metrics
--   first_mover_signals         — listings captured before public portals
--   flywheel_metrics            — full feedback flywheel stage health
--   counterfactual_losses       — missed deals + capital left on table
--
-- All tables: IF NOT EXISTS, RLS, tenant_isolation, indexes
-- =============================================================================

-- ─── 1. supply_dominance_snapshots ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS supply_dominance_snapshots (
  id                               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id                      text        UNIQUE NOT NULL,
  tenant_id                        text        NOT NULL,
  market                           text        NOT NULL,
  period                           text        NOT NULL,  -- 'YYYY-MM'
  system_listing_count             int         NOT NULL DEFAULT 0,
  estimated_total_market_listings  int         NOT NULL DEFAULT 0,
  market_coverage_pct              numeric(6,3) NOT NULL DEFAULT 0,
  sources_active                   int         NOT NULL DEFAULT 0,
  exclusive_listings_count         int         NOT NULL DEFAULT 0,
  first_point_listing_count        int         NOT NULL DEFAULT 0,
  dependent_brokers                int         NOT NULL DEFAULT 0,
  broker_repeat_rate               numeric(4,3) NOT NULL DEFAULT 0,
  dominance_level                  text        NOT NULL DEFAULT 'MARGINAL',
  dominance_score                  numeric(5,2) NOT NULL DEFAULT 0,
  computed_at                      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (market, period, tenant_id)
);

ALTER TABLE supply_dominance_snapshots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'supply_dominance_snapshots'
      AND policyname = 'tenant_isolation_supply_dominance_snapshots'
  ) THEN
    CREATE POLICY tenant_isolation_supply_dominance_snapshots
      ON supply_dominance_snapshots
      USING (tenant_id = current_setting('app.tenant_id', true));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sds_tenant_market_period
  ON supply_dominance_snapshots (tenant_id, market, period DESC);

CREATE INDEX IF NOT EXISTS idx_sds_tenant_computed_at
  ON supply_dominance_snapshots (tenant_id, computed_at DESC);

-- ─── 2. first_mover_signals ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS first_mover_signals (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id                text        UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  tenant_id                text        NOT NULL,
  asset_id                 text        NOT NULL,
  source                   text        NOT NULL,
  days_ahead_of_market     int         NOT NULL DEFAULT 0,
  is_exclusive             boolean     NOT NULL DEFAULT false,
  first_seen_at            timestamptz NOT NULL DEFAULT now(),
  market                   text        NOT NULL,
  city                     text        NOT NULL,
  asking_price_eur_cents   bigint      NOT NULL DEFAULT 0
);

ALTER TABLE first_mover_signals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'first_mover_signals'
      AND policyname = 'tenant_isolation_first_mover_signals'
  ) THEN
    CREATE POLICY tenant_isolation_first_mover_signals
      ON first_mover_signals
      USING (tenant_id = current_setting('app.tenant_id', true));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_fms_tenant_first_seen
  ON first_mover_signals (tenant_id, first_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_fms_tenant_asset
  ON first_mover_signals (tenant_id, asset_id);

CREATE INDEX IF NOT EXISTS idx_fms_is_exclusive
  ON first_mover_signals (tenant_id, is_exclusive, first_seen_at DESC);

-- ─── 3. flywheel_metrics ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS flywheel_metrics (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  flywheel_id           text        UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  tenant_id             text        NOT NULL,

  -- Stage health (0–100 each)
  supply_score          numeric(5,2) NOT NULL DEFAULT 0,
  scoring_score         numeric(5,2) NOT NULL DEFAULT 0,
  capital_match_score   numeric(5,2) NOT NULL DEFAULT 0,
  execution_score       numeric(5,2) NOT NULL DEFAULT 0,
  outcome_score         numeric(5,2) NOT NULL DEFAULT 0,
  learning_score        numeric(5,2) NOT NULL DEFAULT 0,
  optimization_score    numeric(5,2) NOT NULL DEFAULT 0,

  -- Velocity
  overall_velocity      numeric(5,2) NOT NULL DEFAULT 0,
  velocity_trend        text        NOT NULL DEFAULT 'STABLE',
  bottleneck_stage      text,

  -- Moat
  moat_strength         numeric(5,2) NOT NULL DEFAULT 0,

  computed_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE flywheel_metrics ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'flywheel_metrics'
      AND policyname = 'tenant_isolation_flywheel_metrics'
  ) THEN
    CREATE POLICY tenant_isolation_flywheel_metrics
      ON flywheel_metrics
      USING (tenant_id = current_setting('app.tenant_id', true));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_fm_tenant_computed_at
  ON flywheel_metrics (tenant_id, computed_at DESC);

CREATE INDEX IF NOT EXISTS idx_fm_flywheel_id
  ON flywheel_metrics (flywheel_id);

-- ─── 4. counterfactual_losses ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS counterfactual_losses (
  id                                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  loss_id                                 text        UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  tenant_id                               text        NOT NULL,
  period                                  text        NOT NULL,  -- 'YYYY-MM'
  opportunities_expired_without_bid       int         NOT NULL DEFAULT 0,
  estimated_missed_capital_eur_cents      bigint      NOT NULL DEFAULT 0,
  estimated_missed_commission_eur_cents   bigint      NOT NULL DEFAULT 0,
  unmatched_investors_capital_eur_cents   bigint      NOT NULL DEFAULT 0,
  high_scored_deals_that_failed           int         NOT NULL DEFAULT 0,
  low_scored_deals_that_closed            int         NOT NULL DEFAULT 0,
  false_positive_rate                     numeric(4,3) NOT NULL DEFAULT 0,
  false_negative_rate                     numeric(4,3) NOT NULL DEFAULT 0,
  improvement_recommendations             jsonb       NOT NULL DEFAULT '[]',
  computed_at                             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE counterfactual_losses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'counterfactual_losses'
      AND policyname = 'tenant_isolation_counterfactual_losses'
  ) THEN
    CREATE POLICY tenant_isolation_counterfactual_losses
      ON counterfactual_losses
      USING (tenant_id = current_setting('app.tenant_id', true));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cl_tenant_period
  ON counterfactual_losses (tenant_id, period DESC);

CREATE INDEX IF NOT EXISTS idx_cl_tenant_computed_at
  ON counterfactual_losses (tenant_id, computed_at DESC);

CREATE INDEX IF NOT EXISTS idx_cl_loss_id
  ON counterfactual_losses (loss_id);
