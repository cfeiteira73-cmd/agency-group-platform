-- Wave 52 Phase 2 — Institutional Dashboard Truth
-- table: dashboard_truth_reports

CREATE TABLE IF NOT EXISTS dashboard_truth_reports (
  id                    bigserial PRIMARY KEY,
  report_id             uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL,
  truth_grade           text NOT NULL DEFAULT 'CRITICAL_FAILURE',
  overall_score         numeric(5,2) NOT NULL DEFAULT 0,
  total_panels          integer NOT NULL DEFAULT 0,
  full_coverage_pct     numeric(5,2) NOT NULL DEFAULT 0,
  stale_count           integer NOT NULL DEFAULT 0,
  critical_stale_count  integer NOT NULL DEFAULT 0,
  blockers              jsonb NOT NULL DEFAULT '[]',
  truth_hash            text NOT NULL,
  report_json           jsonb NOT NULL DEFAULT '{}',
  generated_at          timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE dashboard_truth_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'dashboard_truth_reports' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON dashboard_truth_reports
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_dash_truth_tenant  ON dashboard_truth_reports (tenant_id);
CREATE INDEX IF NOT EXISTS idx_dash_truth_grade   ON dashboard_truth_reports (truth_grade);
CREATE INDEX IF NOT EXISTS idx_dash_truth_score   ON dashboard_truth_reports (overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_dash_truth_date    ON dashboard_truth_reports (generated_at DESC);
