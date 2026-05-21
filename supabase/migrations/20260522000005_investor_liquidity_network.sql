-- =============================================================================
-- Migration: 20260522000004_investor_liquidity_network
-- Phase 4: Investor Liquidity Infrastructure
--   competition_results, liquidity_scores, network_externality_metrics
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. competition_results — stored multi-investor competition analyses
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS competition_results (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid        NOT NULL REFERENCES organizations(id),
  property_id  text        NOT NULL,
  result       jsonb       NOT NULL,
  ranked_count integer     NOT NULL DEFAULT 0,
  strategy     text,
  computed_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_competition_property
  ON competition_results(tenant_id, property_id, computed_at DESC);

ALTER TABLE competition_results ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'competition_results'
      AND policyname = 'competition_results_service_role'
  ) THEN
    CREATE POLICY competition_results_service_role ON competition_results
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. liquidity_scores — per-asset liquidity grades (upserted on compute)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS liquidity_scores (
  id                           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                    uuid        NOT NULL REFERENCES organizations(id),
  asset_id                     text        NOT NULL,
  liquidity_score              numeric     NOT NULL,
  grade                        text        NOT NULL
                               CHECK (grade IN ('S','A','B','C','D')),
  capital_match_score          numeric,
  demand_pressure_score        numeric,
  conversion_probability_score numeric,
  urgency_index_score          numeric,
  active_investors_count       integer,
  estimated_days_to_match      integer,
  computed_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_liquidity_scores_tenant_grade
  ON liquidity_scores(tenant_id, grade, liquidity_score DESC);

CREATE INDEX IF NOT EXISTS idx_liquidity_scores_asset
  ON liquidity_scores(tenant_id, asset_id);

ALTER TABLE liquidity_scores ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'liquidity_scores'
      AND policyname = 'liquidity_scores_service_role'
  ) THEN
    CREATE POLICY liquidity_scores_service_role ON liquidity_scores
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. network_externality_metrics — per-investor network contribution
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS network_externality_metrics (
  id                           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                    uuid        NOT NULL REFERENCES organizations(id),
  investor_id                  uuid        NOT NULL REFERENCES investors(id),
  metrics                      jsonb       NOT NULL DEFAULT '{}',
  externality_tier             text        NOT NULL DEFAULT 'standard'
                               CHECK (externality_tier IN ('anchor','amplifier','standard','dormant')),
  network_multiplier           numeric     NOT NULL DEFAULT 1.0,
  liquidity_contribution_score numeric     NOT NULL DEFAULT 0,
  computed_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, investor_id)
);

CREATE INDEX IF NOT EXISTS idx_network_ext_tenant_tier
  ON network_externality_metrics(tenant_id, externality_tier);

CREATE INDEX IF NOT EXISTS idx_network_ext_investor
  ON network_externality_metrics(tenant_id, investor_id);

ALTER TABLE network_externality_metrics ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'network_externality_metrics'
      AND policyname = 'network_externality_metrics_service_role'
  ) THEN
    CREATE POLICY network_externality_metrics_service_role ON network_externality_metrics
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
