-- =============================================================================
-- Agency Group — Worker System Migration
-- 20260522000020_worker_system.sql
--
-- Creates worker_health table for durable per-worker metrics.
-- RLS: service_role only (background workers always use supabaseAdmin).
-- =============================================================================

-- worker_health: one row per (tenant_id, worker_name), upserted by each worker
CREATE TABLE IF NOT EXISTS worker_health (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES organizations(id),
  worker_name     text        NOT NULL,
  status          text        NOT NULL DEFAULT 'idle'
                              CHECK (status IN ('running', 'idle', 'error', 'stopped')),
  jobs_processed  integer     NOT NULL DEFAULT 0,
  jobs_failed     integer     NOT NULL DEFAULT 0,
  jobs_retried    integer     NOT NULL DEFAULT 0,
  last_job_at     timestamptz,
  last_error      text,
  started_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, worker_name)
);

CREATE INDEX IF NOT EXISTS idx_worker_health_tenant
  ON worker_health (tenant_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_worker_health_status
  ON worker_health (status, updated_at DESC);

-- ─── Row-Level Security ───────────────────────────────────────────────────────

ALTER TABLE worker_health ENABLE ROW LEVEL SECURITY;

-- Only service_role can read / write worker health rows.
-- No user-facing policies — this is an internal ops table.
CREATE POLICY "service_role_all_worker_health"
  ON worker_health
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── updated_at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_worker_health_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_worker_health_updated_at ON worker_health;
CREATE TRIGGER trg_worker_health_updated_at
  BEFORE UPDATE ON worker_health
  FOR EACH ROW
  EXECUTE FUNCTION set_worker_health_updated_at();
