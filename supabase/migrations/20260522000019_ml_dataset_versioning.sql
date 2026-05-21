-- Agency Group — ML Dataset Versioning
-- Migration: 20260522000019_ml_dataset_versioning.sql
--
-- Two new tables:
--   dataset_versions     — versioned training datasets with lineage
--   dataset_model_links  — M:M between datasets and models
--
-- RLS: service_role only for both tables (ML pipeline writes only)

-- ─── dataset_versions ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dataset_versions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid        NOT NULL REFERENCES organizations(id),
  dataset_name        text        NOT NULL,
  version             text        NOT NULL,
  entity_types        text[]      NOT NULL DEFAULT '{}',
  feature_version     text        NOT NULL DEFAULT 'v1',
  record_count        integer     NOT NULL DEFAULT 0,
  label_distribution  jsonb       NOT NULL DEFAULT '{}',
  checksum            text        NOT NULL,
  storage_path        text        NOT NULL,
  from_date           date,
  to_date             date,
  trained_model_ids   text[]      NOT NULL DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, dataset_name, version)
);

CREATE INDEX IF NOT EXISTS idx_dataset_versions_tenant
  ON dataset_versions(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dataset_versions_name
  ON dataset_versions(tenant_id, dataset_name);

-- ─── dataset_model_links ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dataset_model_links (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid        NOT NULL REFERENCES organizations(id),
  dataset_id             uuid        NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
  model_id               uuid        REFERENCES ml_model_registry(id) ON DELETE SET NULL,
  training_started_at    timestamptz,
  training_completed_at  timestamptz,
  metrics_achieved       jsonb       NOT NULL DEFAULT '{}',
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dataset_model_links
  ON dataset_model_links(tenant_id, dataset_id);

CREATE INDEX IF NOT EXISTS idx_model_dataset_links
  ON dataset_model_links(tenant_id, model_id);

-- ─── RLS — service_role only ──────────────────────────────────────────────────

ALTER TABLE dataset_versions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE dataset_model_links ENABLE ROW LEVEL SECURITY;

-- dataset_versions: service_role bypass (no additional policy needed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'dataset_versions'
      AND policyname = 'service_role_all_dataset_versions'
  ) THEN
    CREATE POLICY service_role_all_dataset_versions
      ON dataset_versions
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- dataset_model_links: service_role bypass
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'dataset_model_links'
      AND policyname = 'service_role_all_dataset_model_links'
  ) THEN
    CREATE POLICY service_role_all_dataset_model_links
      ON dataset_model_links
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
