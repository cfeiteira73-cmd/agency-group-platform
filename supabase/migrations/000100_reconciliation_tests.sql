-- Agency Group — Reconciliation Test Runs
-- Migration: 000100_reconciliation_tests.sql

CREATE TABLE IF NOT EXISTS reconciliation_test_runs (
  run_id                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                    UUID         NOT NULL,
  executed_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  total_transactions           INTEGER      NOT NULL,
  transactions_passed          INTEGER      NOT NULL,
  transactions_failed          INTEGER      NOT NULL,
  all_passed                   BOOLEAN      NOT NULL,
  total_volume_cents           BIGINT       NOT NULL DEFAULT 0,
  total_commission_cents       BIGINT       NOT NULL DEFAULT 0,
  max_deviation_cents          BIGINT       NOT NULL DEFAULT 0,
  split_validation_failures    INTEGER      NOT NULL DEFAULT 0,
  double_entry_violations      INTEGER      NOT NULL DEFAULT 0,
  inconsistencies_above_1_euro INTEGER      NOT NULL DEFAULT 0,
  overall_status               TEXT         NOT NULL,
  sample_failures              JSONB        NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_recon_tests_tenant
  ON reconciliation_test_runs(tenant_id, executed_at DESC);

ALTER TABLE reconciliation_test_runs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'reconciliation_test_runs'
      AND policyname = 'service_role_full_access'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY service_role_full_access ON reconciliation_test_runs
        FOR ALL TO service_role USING (true) WITH CHECK (true)
    $pol$;
  END IF;
END $$;
