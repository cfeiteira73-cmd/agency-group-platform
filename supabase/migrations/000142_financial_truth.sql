-- Wave 52 Phase 3 — Financial Truth Certification
-- table: financial_truth_certifications

CREATE TABLE IF NOT EXISTS financial_truth_certifications (
  id                          bigserial PRIMARY KEY,
  report_id                   uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id                   uuid NOT NULL,
  truth_grade                 text NOT NULL DEFAULT 'FINANCIAL_TRUTH_FAILED',
  overall_score               numeric(5,2) NOT NULL DEFAULT 0,
  synthetic_tx_count          integer NOT NULL DEFAULT 0,
  reconciliation_pct          numeric(7,4) NOT NULL DEFAULT 0,
  reconciliation_certified    boolean NOT NULL DEFAULT false,
  balance_rate_pct            numeric(7,4) NOT NULL DEFAULT 0,
  idempotency_pct             numeric(7,4) NOT NULL DEFAULT 0,
  mismatch_detection_pct      numeric(7,4) NOT NULL DEFAULT 0,
  fee_accuracy_pct            numeric(5,2) NOT NULL DEFAULT 0,
  blockers                    jsonb NOT NULL DEFAULT '[]',
  certification_hash          text NOT NULL,
  report_json                 jsonb NOT NULL DEFAULT '{}',
  generated_at                timestamptz NOT NULL DEFAULT now(),
  created_at                  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE financial_truth_certifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'financial_truth_certifications' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON financial_truth_certifications
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_fin_truth_tenant    ON financial_truth_certifications (tenant_id);
CREATE INDEX IF NOT EXISTS idx_fin_truth_grade     ON financial_truth_certifications (truth_grade);
CREATE INDEX IF NOT EXISTS idx_fin_truth_recon     ON financial_truth_certifications (reconciliation_certified);
CREATE INDEX IF NOT EXISTS idx_fin_truth_date      ON financial_truth_certifications (generated_at DESC);
