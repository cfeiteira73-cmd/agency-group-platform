-- Agency Group — ML Economic Engine Tables
-- Migration: 000056_ml_economic.sql
-- Creates: execution_outcomes, learned_patterns, allocation_recommendations, liquidity_predictions
-- All tables: tenant-isolated via RLS, indexed for query performance.

-- ─── execution_outcomes ──────────────────────────────────────────────────────
-- Stores real capital execution results used for ML reward learning.

CREATE TABLE IF NOT EXISTS execution_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outcome_id text NOT NULL UNIQUE,
  tenant_id uuid NOT NULL,
  settlement_id text,
  asset_id text NOT NULL,
  investor_id text NOT NULL,
  zone text,
  asset_class text,
  agreed_price_eur_cents bigint NOT NULL,
  final_price_eur_cents bigint NOT NULL,
  commission_eur_cents bigint NOT NULL DEFAULT 0,
  days_to_close integer,
  competing_bids integer DEFAULT 0,
  liquidity_score_at_close numeric(5,2) DEFAULT 0,
  reward_score numeric(8,2) DEFAULT 0,
  features jsonb DEFAULT '{}',
  recorded_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_execution_outcomes_tenant
  ON execution_outcomes(tenant_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_execution_outcomes_zone
  ON execution_outcomes(tenant_id, zone, recorded_at DESC);

ALTER TABLE execution_outcomes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'execution_outcomes'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON execution_outcomes
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- ─── learned_patterns ────────────────────────────────────────────────────────
-- Stores ML patterns extracted from execution history.

CREATE TABLE IF NOT EXISTS learned_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id text NOT NULL UNIQUE,
  tenant_id uuid NOT NULL,
  pattern_type text NOT NULL,
  conditions jsonb DEFAULT '{}',
  avg_reward numeric(8,2) DEFAULT 0,
  sample_count integer DEFAULT 0,
  confidence numeric(5,4) DEFAULT 0,
  last_updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learned_patterns_tenant
  ON learned_patterns(tenant_id, pattern_type);

ALTER TABLE learned_patterns ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'learned_patterns'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON learned_patterns
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- ─── allocation_recommendations ──────────────────────────────────────────────
-- Stores ML capital allocation advice per investor × asset.

CREATE TABLE IF NOT EXISTS allocation_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id text NOT NULL UNIQUE,
  tenant_id uuid NOT NULL,
  investor_id text NOT NULL,
  asset_id text NOT NULL,
  recommended_bid_eur_cents bigint,
  max_bid_eur_cents bigint,
  predicted_roi_pct numeric(8,4),
  predicted_days_to_close integer,
  bid_acceptance_probability numeric(5,4),
  confidence text DEFAULT 'LOW',
  rationale jsonb DEFAULT '[]',
  risk_warnings jsonb DEFAULT '[]',
  generated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_allocation_recs_investor
  ON allocation_recommendations(tenant_id, investor_id, generated_at DESC);

ALTER TABLE allocation_recommendations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'allocation_recommendations'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON allocation_recommendations
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- ─── liquidity_predictions ────────────────────────────────────────────────────
-- Stores per-asset liquidity predictions (sale probability + price forecast).

CREATE TABLE IF NOT EXISTS liquidity_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id text NOT NULL UNIQUE,
  tenant_id uuid NOT NULL,
  asset_id text NOT NULL,
  zone text,
  listed_price_eur_cents bigint,
  predicted_sale_probability_30d numeric(5,4),
  predicted_sale_probability_90d numeric(5,4),
  predicted_final_price_eur_cents bigint,
  predicted_days_to_close numeric(8,2),
  prediction_confidence text DEFAULT 'LOW',
  key_factors jsonb DEFAULT '[]',
  generated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_liquidity_predictions_asset
  ON liquidity_predictions(tenant_id, asset_id, generated_at DESC);

ALTER TABLE liquidity_predictions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'liquidity_predictions'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON liquidity_predictions
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;
