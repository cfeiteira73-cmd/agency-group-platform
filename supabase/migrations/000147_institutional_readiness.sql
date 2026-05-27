-- Wave 52 Phase 8 — Institutional Readiness Certifier
-- table: institutional_readiness_reports

CREATE TABLE IF NOT EXISTS institutional_readiness_reports (
  id                    bigserial PRIMARY KEY,
  report_id             uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL,
  readiness_grade       text NOT NULL DEFAULT 'COMPLIANCE_BLOCKED',
  overall_score         numeric(5,2) NOT NULL DEFAULT 0,
  frameworks_compliant  integer NOT NULL DEFAULT 0,
  frameworks_total      integer NOT NULL DEFAULT 0,
  big4_ready            boolean NOT NULL DEFAULT false,
  total_evidence_items  integer NOT NULL DEFAULT 0,
  blockers              jsonb NOT NULL DEFAULT '[]',
  readiness_hash        text NOT NULL,
  cert_valid_until      timestamptz,
  report_json           jsonb NOT NULL DEFAULT '{}',
  generated_at          timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE institutional_readiness_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'institutional_readiness_reports' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON institutional_readiness_reports
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_inst_ready_tenant  ON institutional_readiness_reports (tenant_id);
CREATE INDEX IF NOT EXISTS idx_inst_ready_grade   ON institutional_readiness_reports (readiness_grade);
CREATE INDEX IF NOT EXISTS idx_inst_ready_big4    ON institutional_readiness_reports (big4_ready);
CREATE INDEX IF NOT EXISTS idx_inst_ready_date    ON institutional_readiness_reports (generated_at DESC);
