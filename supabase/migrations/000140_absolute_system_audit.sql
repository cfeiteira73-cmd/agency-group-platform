-- Wave 52 Phase 1 — Absolute System Audit
-- table: absolute_system_audits

CREATE TABLE IF NOT EXISTS absolute_system_audits (
  id                    bigserial PRIMARY KEY,
  audit_id              uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL,
  audit_grade           text NOT NULL DEFAULT 'AUDIT_BLOCKED',
  overall_score         numeric(5,2) NOT NULL DEFAULT 0,
  dimensions_checked    integer NOT NULL DEFAULT 0,
  dimensions_passed     integer NOT NULL DEFAULT 0,
  dimensions_failed     integer NOT NULL DEFAULT 0,
  critical_findings     integer NOT NULL DEFAULT 0,
  high_findings         integer NOT NULL DEFAULT 0,
  total_findings        integer NOT NULL DEFAULT 0,
  blockers              jsonb NOT NULL DEFAULT '[]',
  warnings              jsonb NOT NULL DEFAULT '[]',
  reality_coverage_pct  numeric(5,2) NOT NULL DEFAULT 0,
  system_truth_score    numeric(5,2) NOT NULL DEFAULT 0,
  w51_system_score      numeric(5,2) NOT NULL DEFAULT 0,
  audit_hash            text NOT NULL,
  report_json           jsonb NOT NULL DEFAULT '{}',
  generated_at          timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE absolute_system_audits ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'absolute_system_audits' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON absolute_system_audits
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_abs_audit_tenant  ON absolute_system_audits (tenant_id);
CREATE INDEX IF NOT EXISTS idx_abs_audit_grade   ON absolute_system_audits (audit_grade);
CREATE INDEX IF NOT EXISTS idx_abs_audit_score   ON absolute_system_audits (overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_abs_audit_date    ON absolute_system_audits (generated_at DESC);
