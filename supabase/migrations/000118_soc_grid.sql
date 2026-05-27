-- Agency Group — SOC Grid Store
-- Migration: 000118_soc_grid.sql
-- Wave 49 Phase 3

CREATE TABLE IF NOT EXISTS soc_grid_reports (
  report_id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                  UUID         NOT NULL,
  assessed_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  soc_grid_status            TEXT         NOT NULL DEFAULT 'NOT_CONFIGURED',
  soc_grid_score             NUMERIC(5,2) NOT NULL DEFAULT 0,
  siem_platforms_configured  INTEGER      NOT NULL DEFAULT 0,
  unresolved_sev1            INTEGER      NOT NULL DEFAULT 0,
  secrets_overdue            INTEGER      NOT NULL DEFAULT 0,
  escalation_chains_active   BOOLEAN      NOT NULL DEFAULT false,
  certification_hash         TEXT         NOT NULL DEFAULT '',
  issues                     TEXT[]       NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_soc_grid_tenant ON soc_grid_reports(tenant_id, assessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_soc_grid_status ON soc_grid_reports(tenant_id, soc_grid_status, assessed_at DESC);
ALTER TABLE soc_grid_reports ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='soc_grid_reports' AND policyname='service_role_full_access') THEN
    EXECUTE $pol$ CREATE POLICY service_role_full_access ON soc_grid_reports FOR ALL TO service_role USING (true) WITH CHECK (true) $pol$;
  END IF;
END $$;

-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS secret_rotation_log (
  rotation_id  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID         NOT NULL,
  secret_name  TEXT         NOT NULL,
  rotated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  rotated_by   TEXT,
  notes        TEXT
);
CREATE INDEX IF NOT EXISTS idx_secret_rotation_tenant_name ON secret_rotation_log(tenant_id, secret_name, rotated_at DESC);
ALTER TABLE secret_rotation_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='secret_rotation_log' AND policyname='service_role_full_access') THEN
    EXECUTE $pol$ CREATE POLICY service_role_full_access ON secret_rotation_log FOR ALL TO service_role USING (true) WITH CHECK (true) $pol$;
  END IF;
END $$;
