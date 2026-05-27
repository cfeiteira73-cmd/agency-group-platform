-- Agency Group — Settlement Core Store
-- Migration: 000117_settlement_core.sql
-- Wave 49 Phase 2

CREATE TABLE IF NOT EXISTS settlement_core_reports (
  report_id                     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                     UUID         NOT NULL,
  assessed_at                   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  financial_truth_score         NUMERIC(5,2) NOT NULL DEFAULT 0,
  financial_truth_grade         TEXT         NOT NULL DEFAULT 'NO_DATA',
  total_transactions            INTEGER      NOT NULL DEFAULT 0,
  bank_confirmed_count          INTEGER      NOT NULL DEFAULT 0,
  reconciliation_accuracy_pct   NUMERIC(5,2) NOT NULL DEFAULT 0,
  mismatch_count                INTEGER      NOT NULL DEFAULT 0,
  critical_mismatch_count       INTEGER      NOT NULL DEFAULT 0,
  orphan_capital_critical       BOOLEAN      NOT NULL DEFAULT false,
  duplicate_settlements_detected INTEGER     NOT NULL DEFAULT 0,
  settlement_chain_hash         TEXT         NOT NULL DEFAULT '',
  issues                        TEXT[]       NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_settlement_core_tenant ON settlement_core_reports(tenant_id, assessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_settlement_core_grade ON settlement_core_reports(tenant_id, financial_truth_grade, assessed_at DESC);
ALTER TABLE settlement_core_reports ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='settlement_core_reports' AND policyname='service_role_full_access') THEN
    EXECUTE $pol$ CREATE POLICY service_role_full_access ON settlement_core_reports FOR ALL TO service_role USING (true) WITH CHECK (true) $pol$;
  END IF;
END $$;
