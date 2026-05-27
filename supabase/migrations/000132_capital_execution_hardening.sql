-- Wave 51 Phase 3 — Capital Execution Hardening
-- table: capital_execution_reports

CREATE TABLE IF NOT EXISTS capital_execution_reports (
  id                      bigserial PRIMARY KEY,
  report_id               uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id               uuid NOT NULL,
  certification_status    text NOT NULL DEFAULT 'NO_CAPITAL_DATA',
  capital_score           numeric(5,2) NOT NULL DEFAULT 0,
  reconciliation_pct      numeric(5,2) NOT NULL DEFAULT 0,
  idempotency_pct         numeric(5,2) NOT NULL DEFAULT 0,
  orphans_critical        integer NOT NULL DEFAULT 0,
  blocker_count           integer NOT NULL DEFAULT 0,
  capital_hash            text NOT NULL,
  report_json             jsonb NOT NULL DEFAULT '{}',
  generated_at            timestamptz NOT NULL DEFAULT now(),
  created_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE capital_execution_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'capital_execution_reports' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON capital_execution_reports
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_capital_execution_tenant ON capital_execution_reports (tenant_id);
CREATE INDEX IF NOT EXISTS idx_capital_execution_status ON capital_execution_reports (certification_status);
CREATE INDEX IF NOT EXISTS idx_capital_execution_date   ON capital_execution_reports (generated_at DESC);
