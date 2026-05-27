-- Wave 52 Phase 5 — Absolute Security Hardening
-- table: absolute_security_reports

CREATE TABLE IF NOT EXISTS absolute_security_reports (
  id                    bigserial PRIMARY KEY,
  report_id             uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL,
  security_grade        text NOT NULL DEFAULT 'SECURITY_CRITICAL',
  overall_score         numeric(5,2) NOT NULL DEFAULT 0,
  owasp_passed          integer NOT NULL DEFAULT 0,
  owasp_total           integer NOT NULL DEFAULT 0,
  red_team_mitigated    integer NOT NULL DEFAULT 0,
  red_team_total        integer NOT NULL DEFAULT 0,
  forensic_chain_valid  boolean NOT NULL DEFAULT false,
  open_sev1_count       integer NOT NULL DEFAULT 0,
  blockers              jsonb NOT NULL DEFAULT '[]',
  security_hash         text NOT NULL,
  report_json           jsonb NOT NULL DEFAULT '{}',
  generated_at          timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE absolute_security_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'absolute_security_reports' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON absolute_security_reports
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_abs_sec_tenant  ON absolute_security_reports (tenant_id);
CREATE INDEX IF NOT EXISTS idx_abs_sec_grade   ON absolute_security_reports (security_grade);
CREATE INDEX IF NOT EXISTS idx_abs_sec_score   ON absolute_security_reports (overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_abs_sec_date    ON absolute_security_reports (generated_at DESC);
