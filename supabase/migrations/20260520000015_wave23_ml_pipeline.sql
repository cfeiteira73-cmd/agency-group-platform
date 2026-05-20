-- =============================================================================
-- Agency Group — Wave 23: ML Pipeline Tables
-- Migration: 20260520000015_wave23_ml_pipeline.sql
--
-- Creates: ml_feature_snapshots, ml_model_registry, ml_predictions, ml_ab_experiments
-- RLS: service_role only (ML data is service-only)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ml_feature_snapshots
-- Stores computed feature vectors for any entity at a point in time.
-- Used to build training datasets when ground-truth labels arrive.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ml_feature_snapshots (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type      text NOT NULL CHECK (entity_type IN ('property', 'investor', 'deal', 'match')),
  entity_id        text NOT NULL,
  features         jsonb NOT NULL DEFAULT '{}',
  label_outcome    text,
  label_value      numeric,
  feature_version  text NOT NULL DEFAULT 'v1',
  computed_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ml_feature_snapshots_tenant_type_time
  ON ml_feature_snapshots (tenant_id, entity_type, computed_at DESC);

CREATE INDEX IF NOT EXISTS idx_ml_feature_snapshots_entity
  ON ml_feature_snapshots (entity_type, entity_id);

-- RLS
ALTER TABLE ml_feature_snapshots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ml_feature_snapshots'
      AND policyname = 'ml_feature_snapshots_service_role'
  ) THEN
    CREATE POLICY ml_feature_snapshots_service_role
      ON ml_feature_snapshots
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- ml_model_registry
-- Catalogue of all models (heuristic or trained) with status lifecycle.
-- Status: shadow → a_b_test → active → retired
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ml_model_registry (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  model_name       text NOT NULL,
  model_type       text NOT NULL CHECK (model_type IN ('heuristic', 'xgboost', 'lightgbm', 'neural', 'ensemble')),
  objective        text NOT NULL,
  version          text NOT NULL,
  status           text NOT NULL DEFAULT 'shadow'
                     CHECK (status IN ('shadow', 'active', 'retired', 'a_b_test')),
  feature_version  text NOT NULL DEFAULT 'v1',
  metrics          jsonb NOT NULL DEFAULT '{}',
  weights          jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  activated_at     timestamptz,
  UNIQUE (tenant_id, model_name, version)
);

CREATE INDEX IF NOT EXISTS idx_ml_model_registry_tenant_objective_status
  ON ml_model_registry (tenant_id, objective, status);

-- RLS
ALTER TABLE ml_model_registry ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ml_model_registry'
      AND policyname = 'ml_model_registry_service_role'
  ) THEN
    CREATE POLICY ml_model_registry_service_role
      ON ml_model_registry
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- ml_predictions
-- Stores every prediction made, with the model used and features at inference.
-- Enables outcome tracking (join with commission_events on entity_id).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ml_predictions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  model_id         uuid REFERENCES ml_model_registry(id) ON DELETE SET NULL,
  entity_type      text NOT NULL,
  entity_id        text NOT NULL,
  prediction_type  text NOT NULL,
  score            numeric NOT NULL,
  confidence       numeric,
  features_used    jsonb NOT NULL DEFAULT '{}',
  predicted_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ml_predictions_tenant_type_time
  ON ml_predictions (tenant_id, prediction_type, predicted_at DESC);

CREATE INDEX IF NOT EXISTS idx_ml_predictions_entity_time
  ON ml_predictions (entity_type, entity_id, predicted_at DESC);

-- RLS
ALTER TABLE ml_predictions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ml_predictions'
      AND policyname = 'ml_predictions_service_role'
  ) THEN
    CREATE POLICY ml_predictions_service_role
      ON ml_predictions
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- ml_ab_experiments
-- A/B experiment metadata for model comparison.
-- traffic_split_pct: % of traffic routed to model_b (default 50/50).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ml_ab_experiments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  experiment_name  text NOT NULL,
  model_a_id       uuid REFERENCES ml_model_registry(id) ON DELETE SET NULL,
  model_b_id       uuid REFERENCES ml_model_registry(id) ON DELETE SET NULL,
  traffic_split_pct numeric NOT NULL DEFAULT 50,
  status           text NOT NULL DEFAULT 'running'
                     CHECK (status IN ('running', 'completed', 'aborted')),
  winner           text CHECK (winner IN ('a', 'b', 'tie', 'inconclusive')),
  started_at       timestamptz NOT NULL DEFAULT now(),
  completed_at     timestamptz,
  results          jsonb NOT NULL DEFAULT '{}'
);

-- RLS
ALTER TABLE ml_ab_experiments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ml_ab_experiments'
      AND policyname = 'ml_ab_experiments_service_role'
  ) THEN
    CREATE POLICY ml_ab_experiments_service_role
      ON ml_ab_experiments
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
