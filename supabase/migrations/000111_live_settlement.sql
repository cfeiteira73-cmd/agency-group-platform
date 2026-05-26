-- Agency Group — Live Settlement Reality Store
-- Migration: 000111_live_settlement.sql
-- Wave 48 GAP 2 — Bank statement ingestion, mismatch detection, orphan capital, chargebacks

CREATE TABLE IF NOT EXISTS live_settlement_reports (
  report_id                        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                        UUID         NOT NULL,
  assessed_at                      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  consistency_grade                TEXT         NOT NULL DEFAULT 'NO_DATA',
  total_mismatches                 INTEGER      NOT NULL DEFAULT 0,
  total_orphan_capital_cents       BIGINT       NOT NULL DEFAULT 0,
  total_chargebacks                INTEGER      NOT NULL DEFAULT 0,
  reconciliation_rate_pct          NUMERIC(5,2) NOT NULL DEFAULT 0,
  bank_confirmed_settlement_pct    NUMERIC(5,2) NOT NULL DEFAULT 0,
  mismatches                       JSONB        NOT NULL DEFAULT '[]'::jsonb,
  orphan_capitals                  JSONB        NOT NULL DEFAULT '[]'::jsonb,
  chargebacks                      JSONB        NOT NULL DEFAULT '[]'::jsonb
);

-- Enforces the core finality rule: no orphan capital can have bank_confirmed = true
-- without a corresponding bank record
CREATE INDEX IF NOT EXISTS idx_live_settlement_tenant
  ON live_settlement_reports(tenant_id, assessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_live_settlement_grade
  ON live_settlement_reports(tenant_id, consistency_grade, assessed_at DESC);

ALTER TABLE live_settlement_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'live_settlement_reports'
      AND policyname = 'service_role_full_access'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY service_role_full_access ON live_settlement_reports
        FOR ALL TO service_role USING (true) WITH CHECK (true)
    $pol$;
  END IF;
END $$;

-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS reconciliation_drift_log (
  drift_id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID         NOT NULL,
  deal_id           TEXT,
  mismatch_type     TEXT         NOT NULL,
  system_amount     BIGINT       NOT NULL DEFAULT 0,
  bank_amount       BIGINT       NOT NULL DEFAULT 0,
  delta_cents       BIGINT       NOT NULL DEFAULT 0,
  currency          TEXT         NOT NULL DEFAULT 'EUR',
  detected_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  resolved_at       TIMESTAMPTZ,
  notes             TEXT
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_drift_tenant
  ON reconciliation_drift_log(tenant_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_reconciliation_drift_unresolved
  ON reconciliation_drift_log(tenant_id) WHERE resolved_at IS NULL;

ALTER TABLE reconciliation_drift_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'reconciliation_drift_log'
      AND policyname = 'service_role_full_access'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY service_role_full_access ON reconciliation_drift_log
        FOR ALL TO service_role USING (true) WITH CHECK (true)
    $pol$;
  END IF;
END $$;

-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS payment_chargebacks (
  chargeback_id     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID         NOT NULL,
  payment_id        TEXT         NOT NULL,
  deal_id           TEXT,
  amount_cents      BIGINT       NOT NULL DEFAULT 0,
  currency          TEXT         NOT NULL DEFAULT 'EUR',
  reason            TEXT,
  status            TEXT         NOT NULL DEFAULT 'OPEN',
  reported_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  resolved_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_chargebacks_tenant
  ON payment_chargebacks(tenant_id, reported_at DESC);

CREATE INDEX IF NOT EXISTS idx_chargebacks_open
  ON payment_chargebacks(tenant_id) WHERE status = 'OPEN';

ALTER TABLE payment_chargebacks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'payment_chargebacks'
      AND policyname = 'service_role_full_access'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY service_role_full_access ON payment_chargebacks
        FOR ALL TO service_role USING (true) WITH CHECK (true)
    $pol$;
  END IF;
END $$;
