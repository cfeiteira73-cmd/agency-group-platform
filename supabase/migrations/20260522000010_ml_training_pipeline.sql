-- =============================================================================
-- Agency Group — ML Training Pipeline Tables
-- Migration: 20260522000010_ml_training_pipeline.sql
--
-- Adds:
--   training_export_manifests — tracks exported training datasets in Supabase Storage
--   retrain_jobs              — queue of model retraining jobs
--   ab_experiment_assignments — per-entity A/B variant assignments
--
-- Extends ml_model_registry with lifecycle columns (weights_path, retired_at, etc.)
-- Extends ml_ab_experiments   with experiment config columns
--
-- RLS: service_role only for all ML tables
-- =============================================================================

-- ---------------------------------------------------------------------------
-- training_export_manifests
-- Tracks JSONL training datasets written to Supabase Storage bucket 'ml-training-data'.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS training_export_manifests (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  export_id      text        NOT NULL UNIQUE,
  tenant_id      uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  exported_at    timestamptz NOT NULL DEFAULT now(),
  records_total  integer     NOT NULL DEFAULT 0,
  entity_types   text[],
  from_date      timestamptz,
  to_date        timestamptz,
  storage_paths  text[]      NOT NULL DEFAULT '{}',
  bucket         text        NOT NULL DEFAULT 'ml-training-data',
  checksum       text,
  size_bytes     integer,
  status         text        NOT NULL DEFAULT 'complete'
                   CHECK (status IN ('uploading', 'complete', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_training_export_manifests_tenant_exported
  ON training_export_manifests (tenant_id, exported_at DESC);

ALTER TABLE training_export_manifests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename  = 'training_export_manifests'
      AND policyname = 'training_export_manifests_service_role'
  ) THEN
    CREATE POLICY training_export_manifests_service_role
      ON training_export_manifests
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- retrain_jobs
-- Queue of model retraining jobs — one per trigger event.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS retrain_jobs (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id               text        NOT NULL UNIQUE,
  tenant_id            uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  objective            text        NOT NULL,
  trigger_reason       text        NOT NULL
                         CHECK (trigger_reason IN (
                           'drift_detected', 'scheduled', 'manual', 'insufficient_data_resolved'
                         )),
  drift_psi            numeric,
  labeled_records      integer     NOT NULL DEFAULT 0,
  training_manifest_id uuid        REFERENCES training_export_manifests(id) ON DELETE SET NULL,
  status               text        NOT NULL DEFAULT 'queued'
                         CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  started_at           timestamptz,
  completed_at         timestamptz,
  result               jsonb       NOT NULL DEFAULT '{}',
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retrain_jobs_tenant_status
  ON retrain_jobs (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_retrain_jobs_tenant_objective
  ON retrain_jobs (tenant_id, objective, created_at DESC);

ALTER TABLE retrain_jobs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename  = 'retrain_jobs'
      AND policyname = 'retrain_jobs_service_role'
  ) THEN
    CREATE POLICY retrain_jobs_service_role
      ON retrain_jobs
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- ab_experiment_assignments
-- Per-entity A/B variant assignment with conversion tracking.
-- Primary key: (experiment_id, entity_id) — one assignment per entity per experiment.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ab_experiment_assignments (
  experiment_id  uuid        NOT NULL REFERENCES ml_ab_experiments(id) ON DELETE CASCADE,
  entity_id      text        NOT NULL,
  variant        text        NOT NULL CHECK (variant IN ('a', 'b')),
  assigned_at    timestamptz NOT NULL DEFAULT now(),
  converted      boolean     NOT NULL DEFAULT false,
  PRIMARY KEY (experiment_id, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_ab_experiment_assignments_experiment
  ON ab_experiment_assignments (experiment_id, variant);

CREATE INDEX IF NOT EXISTS idx_ab_experiment_assignments_entity
  ON ab_experiment_assignments (entity_id, experiment_id);

ALTER TABLE ab_experiment_assignments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename  = 'ab_experiment_assignments'
      AND policyname = 'ab_experiment_assignments_service_role'
  ) THEN
    CREATE POLICY ab_experiment_assignments_service_role
      ON ab_experiment_assignments
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Extend ml_model_registry with new columns (safe — idempotent ADD COLUMN IF NOT EXISTS)
-- ---------------------------------------------------------------------------

ALTER TABLE ml_model_registry
  ADD COLUMN IF NOT EXISTS weights_path         text,
  ADD COLUMN IF NOT EXISTS training_manifest_id uuid REFERENCES training_export_manifests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS trained_on_n         integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retired_at           timestamptz;

-- ---------------------------------------------------------------------------
-- Extend ml_ab_experiments with experiment config columns
-- ---------------------------------------------------------------------------

ALTER TABLE ml_ab_experiments
  ADD COLUMN IF NOT EXISTS assignment              text NOT NULL DEFAULT 'entity_hash'
                             CHECK (assignment IN ('random', 'entity_hash', 'tenant_hash')),
  ADD COLUMN IF NOT EXISTS min_samples_per_variant integer NOT NULL DEFAULT 200;

-- ---------------------------------------------------------------------------
-- Supabase Storage: ensure buckets exist (run after applying migration)
-- Buckets are created via the Supabase dashboard or storage API, not SQL.
-- This comment serves as a reminder:
--
--   Bucket: ml-training-data  (private, max file size: 52428800 — 50 MB)
--   Bucket: ml-models         (private, max file size: 104857600 — 100 MB)
-- ---------------------------------------------------------------------------
