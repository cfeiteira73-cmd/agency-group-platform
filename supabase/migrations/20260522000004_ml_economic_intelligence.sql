-- =============================================================================
-- Agency Group — ML Economic Intelligence Tables
-- Migration: 20260522000003_ml_economic_intelligence.sql
--
-- Creates: calibration_models, counterfactual_scenarios, inference_cache
-- Adds:    is_latest column on ml_feature_snapshots
-- RLS:     service_role only (ML data is service-only)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Add is_latest column to ml_feature_snapshots if not exists
-- ---------------------------------------------------------------------------

ALTER TABLE ml_feature_snapshots
  ADD COLUMN IF NOT EXISTS is_latest boolean NOT NULL DEFAULT true;

ALTER TABLE ml_feature_snapshots
  ADD COLUMN IF NOT EXISTS ttl_expires_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_ml_feature_snapshots_latest
  ON ml_feature_snapshots (tenant_id, entity_type, entity_id, is_latest)
  WHERE is_latest = true;

-- ---------------------------------------------------------------------------
-- calibration_models
-- Platt scaling parameters per (tenant, entity_type, objective).
-- One active row per combination — upserted on each refit.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS calibration_models (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type       text        NOT NULL,
  objective         text        NOT NULL,
  platt_a           numeric     NOT NULL DEFAULT 1.0,
  platt_b           numeric     NOT NULL DEFAULT 0.0,
  reliability_bins  jsonb       NOT NULL DEFAULT '[]',
  calibration_error numeric,
  trained_on_n      integer     NOT NULL DEFAULT 0,
  trained_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, entity_type, objective)
);

CREATE INDEX IF NOT EXISTS idx_calibration_models_tenant
  ON calibration_models (tenant_id, entity_type, objective);

-- RLS
ALTER TABLE calibration_models ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE tablename  = 'calibration_models'
       AND policyname = 'calibration_models_service_role'
  ) THEN
    CREATE POLICY calibration_models_service_role
      ON calibration_models
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- counterfactual_scenarios
-- Stored counterfactual analyses per deal/property/investor.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS counterfactual_scenarios (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type           text        NOT NULL CHECK (entity_type IN ('deal', 'property', 'investor')),
  entity_id             text        NOT NULL,
  scenario              jsonb       NOT NULL,
  opportunity_cost_eur  numeric,
  computed_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_counterfactual_scenarios_tenant_entity
  ON counterfactual_scenarios (tenant_id, entity_type, entity_id, computed_at DESC);

CREATE INDEX IF NOT EXISTS idx_counterfactual_scenarios_tenant_time
  ON counterfactual_scenarios (tenant_id, computed_at DESC);

-- RLS
ALTER TABLE counterfactual_scenarios ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE tablename  = 'counterfactual_scenarios'
       AND policyname = 'counterfactual_scenarios_service_role'
  ) THEN
    CREATE POLICY counterfactual_scenarios_service_role
      ON counterfactual_scenarios
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- inference_cache
-- DB-backed fallback for in-process inference cache.
-- Primary cache is in-process (MemoryCache); this is the persistence layer.
-- Expired rows are cleaned up by a periodic cron or pg_cron.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS inference_cache (
  cache_key   text        PRIMARY KEY,
  tenant_id   uuid        REFERENCES organizations(id) ON DELETE CASCADE,
  result      jsonb       NOT NULL,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inference_cache_expires
  ON inference_cache (expires_at);

CREATE INDEX IF NOT EXISTS idx_inference_cache_tenant
  ON inference_cache (tenant_id);

-- RLS
ALTER TABLE inference_cache ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE tablename  = 'inference_cache'
       AND policyname = 'inference_cache_service_role'
  ) THEN
    CREATE POLICY inference_cache_service_role
      ON inference_cache
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Auto-expire: delete stale inference_cache rows daily via pg_cron (optional)
-- Only registered if pg_cron extension is available.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    PERFORM cron.schedule(
      'purge_inference_cache',
      '0 4 * * *',
      $$DELETE FROM inference_cache WHERE expires_at < now()$$
    );
  END IF;
END $$;
