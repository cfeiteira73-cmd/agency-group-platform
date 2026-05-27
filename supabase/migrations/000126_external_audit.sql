-- Wave 50 Phase 4: External Institutional Audit Engine
-- external_audit_reports

CREATE TABLE IF NOT EXISTS external_audit_reports (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id               UUID        NOT NULL UNIQUE,
  tenant_id               UUID        NOT NULL,
  assessed_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  external_audit_status   TEXT        NOT NULL DEFAULT 'NOT_READY',
  external_audit_score    SMALLINT    NOT NULL DEFAULT 0,
  soc2_score              SMALLINT    NOT NULL DEFAULT 0,
  iso27001_score          SMALLINT    NOT NULL DEFAULT 0,
  open_critical_vulns     SMALLINT    NOT NULL DEFAULT 0,
  pentest_blocker         BOOLEAN     NOT NULL DEFAULT FALSE,
  total_evidence_items    SMALLINT    NOT NULL DEFAULT 0,
  chain_of_custody_hash   TEXT        NOT NULL,
  big4_ready              BOOLEAN     NOT NULL DEFAULT FALSE,
  blockers                JSONB       NOT NULL DEFAULT '[]',
  issues                  JSONB       NOT NULL DEFAULT '[]',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE external_audit_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'external_audit_reports'
      AND policyname = 'service_role_all_external_audit_reports'
  ) THEN
    CREATE POLICY service_role_all_external_audit_reports
      ON external_audit_reports FOR ALL
      TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_external_audit_tenant
  ON external_audit_reports (tenant_id, assessed_at DESC);
