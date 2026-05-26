-- Agency Group — Financial Finality Store
-- Migration: 000105_financial_finality.sql
-- Wave 47 GAP 2 — Financial Finality Engine persistence

-- Finality records (settlement state machine)
CREATE TABLE IF NOT EXISTS finality_records (
  finality_id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID         NOT NULL,
  transaction_ref         TEXT         NOT NULL,
  payment_rail            TEXT         NOT NULL DEFAULT 'INTERNAL',
  amount_cents            BIGINT       NOT NULL DEFAULT 0,
  currency                TEXT         NOT NULL DEFAULT 'EUR',
  current_state           TEXT         NOT NULL DEFAULT 'PENDING',
  state_history           JSONB        NOT NULL DEFAULT '[]'::jsonb,
  bank_confirmation_ref   TEXT,
  bank_confirmed_at       TIMESTAMPTZ,
  is_real_money           BOOLEAN      NOT NULL DEFAULT false,
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- is_real_money must only be true when bank_confirmed_at is set
ALTER TABLE finality_records
  DROP CONSTRAINT IF EXISTS finality_real_money_requires_bank_confirmation;
ALTER TABLE finality_records
  ADD CONSTRAINT finality_real_money_requires_bank_confirmation
    CHECK (is_real_money = false OR bank_confirmed_at IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS idx_finality_tenant_ref
  ON finality_records(tenant_id, transaction_ref);

CREATE INDEX IF NOT EXISTS idx_finality_tenant_state
  ON finality_records(tenant_id, current_state);

CREATE INDEX IF NOT EXISTS idx_finality_bank_confirmed
  ON finality_records(tenant_id, bank_confirmed_at)
  WHERE bank_confirmed_at IS NOT NULL;

-- Audit packages (immutable SHA-256 chain packages for external auditors)
CREATE TABLE IF NOT EXISTS audit_packages (
  package_id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID         NOT NULL,
  generated_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  period_start                TIMESTAMPTZ  NOT NULL,
  period_end                  TIMESTAMPTZ  NOT NULL,
  total_transactions          INTEGER      NOT NULL DEFAULT 0,
  total_volume_eur_cents      TEXT         NOT NULL DEFAULT '0',
  bank_confirmed_count        INTEGER      NOT NULL DEFAULT 0,
  reconciliation_accuracy_pct NUMERIC(6,2) NOT NULL DEFAULT 0,
  sha256_chain_root           TEXT         NOT NULL,
  auditor_note                TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_packages_tenant
  ON audit_packages(tenant_id, generated_at DESC);

-- RLS
ALTER TABLE finality_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_packages   ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'finality_records'
      AND policyname = 'service_role_full_access'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY service_role_full_access ON finality_records
        FOR ALL TO service_role USING (true) WITH CHECK (true)
    $pol$;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audit_packages'
      AND policyname = 'service_role_full_access'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY service_role_full_access ON audit_packages
        FOR ALL TO service_role USING (true) WITH CHECK (true)
    $pol$;
  END IF;
END $$;
