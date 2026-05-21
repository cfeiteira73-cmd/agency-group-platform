-- =============================================================================
-- Migration: 20260522000009_ingestion_pipeline_complete
-- Purpose: Ingestion pipeline audit trail + idempotency + canonical indexes
-- Agency Group SH-ROS — Canonical Property Ingestion Infrastructure
-- =============================================================================

-- ── ingestion_runs: audit trail of each pipeline execution ────────────────────
CREATE TABLE IF NOT EXISTS ingestion_runs (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid        NOT NULL REFERENCES organizations(id),
  source               text        NOT NULL,
  run_type             text        NOT NULL CHECK (run_type IN ('delta', 'full', 'manual')),
  started_at           timestamptz NOT NULL DEFAULT now(),
  completed_at         timestamptz,
  fetched              integer     NOT NULL DEFAULT 0,
  enqueued             integer     NOT NULL DEFAULT 0,
  canonical_created    integer     NOT NULL DEFAULT 0,
  canonical_merged     integer     NOT NULL DEFAULT 0,
  fraud_flagged        integer     NOT NULL DEFAULT 0,
  errors               integer     NOT NULL DEFAULT 0,
  last_source_timestamp timestamptz,
  status               text        NOT NULL DEFAULT 'running'
                       CHECK (status IN ('running', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_ingestion_runs_tenant_status
  ON ingestion_runs(tenant_id, status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_ingestion_runs_last_timestamp
  ON ingestion_runs(tenant_id, run_type, completed_at DESC)
  WHERE status = 'completed';

ALTER TABLE ingestion_runs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ingestion_runs' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON ingestion_runs
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── ingestion_idempotency: prevents duplicate source records ──────────────────
-- Key format: source:source_id (e.g. 'casafari:abc123')
-- Checked before enqueue; written atomically with enqueue.
-- Note: canonical_id is nullable — set after processing resolves the canonical.
CREATE TABLE IF NOT EXISTS ingestion_idempotency (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES organizations(id),
  idempotency_key text        NOT NULL,
  canonical_id    uuid,
  processed_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_ingestion_idempotency_key
  ON ingestion_idempotency(tenant_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_ingestion_idempotency_processed
  ON ingestion_idempotency(tenant_id, processed_at DESC);

ALTER TABLE ingestion_idempotency ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ingestion_idempotency' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON ingestion_idempotency
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── canonical_properties: GIN index on source_ids for active listings ─────────
-- The migration 20260522000003 already created idx_ingestion_idempotency_key
-- on canonical_properties. Adding a filtered version for active-only lookups.
CREATE INDEX IF NOT EXISTS idx_canonical_properties_source_ids_active
  ON canonical_properties USING GIN(source_ids)
  WHERE listing_status = 'active';

-- ── ingestion_idempotency: canonical_id FK after canonical_properties exists ──
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ingestion_idempotency_canonical_id_fkey'
      AND table_name = 'ingestion_idempotency'
  ) THEN
    -- Only add FK if canonical_properties table exists (safe guard)
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'canonical_properties'
    ) THEN
      ALTER TABLE ingestion_idempotency
        ADD CONSTRAINT ingestion_idempotency_canonical_id_fkey
        FOREIGN KEY (canonical_id)
        REFERENCES canonical_properties(canonical_id)
        ON DELETE SET NULL
        DEFERRABLE INITIALLY DEFERRED;
    END IF;
  END IF;
END $$;

-- ── TTL cleanup: purge idempotency records older than 90 days ─────────────────
-- (Prevents unbounded growth — 90-day window is sufficient for dedup purposes)
-- This is a manual operation; call periodically or via a cron.
-- The function is created here for operational use.
CREATE OR REPLACE FUNCTION purge_ingestion_idempotency_ttl()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM ingestion_idempotency
  WHERE processed_at < now() - INTERVAL '90 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
