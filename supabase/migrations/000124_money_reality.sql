-- Wave 50 Phase 2: Live Money Reality Engine
-- money_reality_reports

CREATE TABLE IF NOT EXISTS money_reality_reports (
  id                              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id                       UUID        NOT NULL UNIQUE,
  tenant_id                       UUID        NOT NULL,
  assessed_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
  money_reality_grade             TEXT        NOT NULL DEFAULT 'NO_REAL_MONEY_DATA',
  money_reality_score             SMALLINT    NOT NULL DEFAULT 0,
  reconciliation_accuracy_pct     NUMERIC(6,3) NOT NULL DEFAULT 0,
  reconciliation_target_met       BOOLEAN     NOT NULL DEFAULT FALSE,
  simulated_marked_real_violations SMALLINT   NOT NULL DEFAULT 0,
  orphan_capital_blocker          BOOLEAN     NOT NULL DEFAULT FALSE,
  duplicate_payment_count         SMALLINT    NOT NULL DEFAULT 0,
  ledger_balance_status           TEXT        NOT NULL DEFAULT 'UNINITIALIZED',
  ledger_hash                     TEXT        NOT NULL,
  blockers                        JSONB       NOT NULL DEFAULT '[]',
  issues                          JSONB       NOT NULL DEFAULT '[]',
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE money_reality_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'money_reality_reports'
      AND policyname = 'service_role_all_money_reality_reports'
  ) THEN
    CREATE POLICY service_role_all_money_reality_reports
      ON money_reality_reports FOR ALL
      TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_money_reality_tenant
  ON money_reality_reports (tenant_id, assessed_at DESC);
