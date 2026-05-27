-- Wave 51 Phase 7 — ML/Data Truth Hardening
-- table: ml_truth_reports

CREATE TABLE IF NOT EXISTS ml_truth_reports (
  id                    bigserial PRIMARY KEY,
  report_id             uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL,
  ml_status             text NOT NULL DEFAULT 'ML_NOT_CONFIGURED',
  ml_truth_score        numeric(5,2) NOT NULL DEFAULT 0,
  models_stable         integer NOT NULL DEFAULT 0,
  models_drifted        integer NOT NULL DEFAULT 0,
  feature_coverage_pct  numeric(5,2) NOT NULL DEFAULT 0,
  lineage_verified      boolean NOT NULL DEFAULT false,
  blocker_count         integer NOT NULL DEFAULT 0,
  ml_hash               text NOT NULL,
  report_json           jsonb NOT NULL DEFAULT '{}',
  generated_at          timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ml_truth_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ml_truth_reports' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON ml_truth_reports
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ml_truth_tenant ON ml_truth_reports (tenant_id);
CREATE INDEX IF NOT EXISTS idx_ml_truth_status ON ml_truth_reports (ml_status);
CREATE INDEX IF NOT EXISTS idx_ml_truth_date   ON ml_truth_reports (generated_at DESC);
