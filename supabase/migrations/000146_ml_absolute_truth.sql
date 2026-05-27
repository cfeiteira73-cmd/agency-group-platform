-- Wave 52 Phase 7 — Absolute ML Data Truth
-- table: absolute_ml_reports

CREATE TABLE IF NOT EXISTS absolute_ml_reports (
  id                        bigserial PRIMARY KEY,
  report_id                 uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id                 uuid NOT NULL,
  ml_truth_grade            text NOT NULL DEFAULT 'ML_TRUTH_BLOCKED',
  overall_score             numeric(5,2) NOT NULL DEFAULT 0,
  models_evaluated          integer NOT NULL DEFAULT 0,
  models_certified          integer NOT NULL DEFAULT 0,
  drift_significant_count   integer NOT NULL DEFAULT 0,
  leakage_detected_count    integer NOT NULL DEFAULT 0,
  overfit_detected_count    integer NOT NULL DEFAULT 0,
  blockers                  jsonb NOT NULL DEFAULT '[]',
  ml_truth_hash             text NOT NULL,
  report_json               jsonb NOT NULL DEFAULT '{}',
  generated_at              timestamptz NOT NULL DEFAULT now(),
  created_at                timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE absolute_ml_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'absolute_ml_reports' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON absolute_ml_reports
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_abs_ml_tenant  ON absolute_ml_reports (tenant_id);
CREATE INDEX IF NOT EXISTS idx_abs_ml_grade   ON absolute_ml_reports (ml_truth_grade);
CREATE INDEX IF NOT EXISTS idx_abs_ml_score   ON absolute_ml_reports (overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_abs_ml_date    ON absolute_ml_reports (generated_at DESC);
