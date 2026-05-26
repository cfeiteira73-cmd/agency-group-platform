-- Agency Group — Live Institutional Chaos Engine Store
-- Migration: 000114_live_chaos.sql
-- Wave 48 GAP 5 — Chaos windows, live chaos reports

CREATE TABLE IF NOT EXISTS chaos_windows (
  window_id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID         NOT NULL,
  blast_radius      TEXT         NOT NULL DEFAULT 'SAFE_DRY_RUN',
  started_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  ended_at          TIMESTAMPTZ,
  experiments_run   INTEGER      NOT NULL DEFAULT 0,
  experiments_passed INTEGER     NOT NULL DEFAULT 0,
  rto_met           BOOLEAN      NOT NULL DEFAULT false,
  rpo_met           BOOLEAN      NOT NULL DEFAULT false,
  rollback_validated BOOLEAN     NOT NULL DEFAULT false,
  status            TEXT         NOT NULL DEFAULT 'COMPLETED'
);

CREATE INDEX IF NOT EXISTS idx_chaos_windows_tenant
  ON chaos_windows(tenant_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_chaos_windows_blast
  ON chaos_windows(tenant_id, blast_radius, started_at DESC);

ALTER TABLE chaos_windows ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'chaos_windows'
      AND policyname = 'service_role_full_access'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY service_role_full_access ON chaos_windows
        FOR ALL TO service_role USING (true) WITH CHECK (true)
    $pol$;
  END IF;
END $$;

-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS live_chaos_reports (
  report_id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID         NOT NULL,
  assessed_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  chaos_readiness_status  TEXT         NOT NULL DEFAULT 'NOT_TESTED',
  experiments_run         INTEGER      NOT NULL DEFAULT 0,
  experiments_passed      INTEGER      NOT NULL DEFAULT 0,
  rto_met                 BOOLEAN      NOT NULL DEFAULT false,
  rpo_met                 BOOLEAN      NOT NULL DEFAULT false,
  blast_radius_used       TEXT         NOT NULL DEFAULT 'SAFE_DRY_RUN',
  rollback_validated      BOOLEAN      NOT NULL DEFAULT false,
  chaos_enabled           BOOLEAN      NOT NULL DEFAULT false,
  experiments             JSONB        NOT NULL DEFAULT '[]'::jsonb,
  rto_results             JSONB        NOT NULL DEFAULT '[]'::jsonb,
  rpo_results             JSONB        NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_live_chaos_tenant
  ON live_chaos_reports(tenant_id, assessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_live_chaos_status
  ON live_chaos_reports(tenant_id, chaos_readiness_status, assessed_at DESC);

ALTER TABLE live_chaos_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'live_chaos_reports'
      AND policyname = 'service_role_full_access'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY service_role_full_access ON live_chaos_reports
        FOR ALL TO service_role USING (true) WITH CHECK (true)
    $pol$;
  END IF;
END $$;
