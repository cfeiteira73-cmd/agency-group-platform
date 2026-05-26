-- 000088_double_entry_ledger.sql
-- Agency Group — Double-Entry Ledger + Capital Flow Control System
-- Wave 44 Agent 3
-- All EUR amounts stored as BIGINT integer cents (never float)

CREATE TABLE IF NOT EXISTS ledger_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  account_code TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE')),
  currency TEXT NOT NULL DEFAULT 'EUR',
  balance_cents BIGINT NOT NULL DEFAULT 0,
  is_escrow BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, account_code)
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  transaction_id TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('PENDING','POSTED','REVERSED','FAILED')) DEFAULT 'POSTED',
  debit_account_code TEXT NOT NULL,
  credit_account_code TEXT NOT NULL,
  amount_cents BIGINT NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  idempotency_key TEXT NOT NULL UNIQUE,
  posted_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS escrow_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_id TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  deal_id TEXT NOT NULL,
  investor_id TEXT NOT NULL,
  expected_amount_cents BIGINT NOT NULL,
  actual_amount_cents BIGINT,
  status TEXT NOT NULL CHECK (status IN ('PENDING_DEPOSIT','DEPOSITED','IN_ESCROW','RELEASED','REFUNDED','DISPUTED')) DEFAULT 'PENDING_DEPOSIT',
  bank_reference TEXT,
  bank_confirmed BOOLEAN NOT NULL DEFAULT false,
  deposited_at TIMESTAMPTZ,
  release_condition TEXT NOT NULL DEFAULT 'LAND_REGISTRY_CONFIRMED',
  released_at TIMESTAMPTZ,
  discrepancy_cents BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deal_id, investor_id)
);

CREATE TABLE IF NOT EXISTS bank_statement_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  statement_date DATE NOT NULL,
  value_date DATE NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  reference TEXT,
  amount_cents BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  bank_account TEXT NOT NULL DEFAULT '',
  matched_transaction_id TEXT,
  match_status TEXT NOT NULL CHECK (match_status IN ('UNMATCHED','AUTO_MATCHED','MANUAL_MATCHED','DISPUTED','RECONCILED')) DEFAULT 'UNMATCHED',
  match_confidence NUMERIC(3,2),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, statement_date, amount_cents, reference)
);

CREATE TABLE IF NOT EXISTS transaction_fee_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  transaction_id TEXT NOT NULL UNIQUE,
  agency_commission_cents BIGINT NOT NULL DEFAULT 0,
  imt_tax_cents BIGINT NOT NULL DEFAULT 0,
  stamp_duty_cents BIGINT NOT NULL DEFAULT 0,
  notary_fee_cents BIGINT NOT NULL DEFAULT 0,
  land_registry_cents BIGINT NOT NULL DEFAULT 0,
  psp_fee_cents BIGINT NOT NULL DEFAULT 0,
  total_buyer_costs_cents BIGINT NOT NULL DEFAULT 0,
  total_seller_revenue_cents BIGINT NOT NULL DEFAULT 0,
  net_to_platform_cents BIGINT NOT NULL DEFAULT 0,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS capital_velocity_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  capital_in_cents BIGINT NOT NULL DEFAULT 0,
  capital_deployed_cents BIGINT NOT NULL DEFAULT 0,
  capital_settled_cents BIGINT NOT NULL DEFAULT 0,
  capital_in_escrow_cents BIGINT NOT NULL DEFAULT 0,
  velocity_ratio NUMERIC(5,4) NOT NULL DEFAULT 0,
  avg_hold_days NUMERIC(6,2) NOT NULL DEFAULT 0,
  deals_in_period INTEGER NOT NULL DEFAULT 0,
  commission_earned_cents BIGINT NOT NULL DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_journal_entries_transaction
  ON journal_entries(transaction_id, posted_at DESC);

CREATE INDEX IF NOT EXISTS idx_journal_entries_tenant
  ON journal_entries(tenant_id, posted_at DESC);

CREATE INDEX IF NOT EXISTS idx_journal_entries_account_codes
  ON journal_entries(tenant_id, debit_account_code, credit_account_code);

CREATE INDEX IF NOT EXISTS idx_escrow_positions_deal
  ON escrow_positions(deal_id, status);

CREATE INDEX IF NOT EXISTS idx_escrow_positions_tenant
  ON escrow_positions(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_bank_lines_tenant
  ON bank_statement_lines(tenant_id, statement_date DESC);

CREATE INDEX IF NOT EXISTS idx_bank_lines_unmatched
  ON bank_statement_lines(tenant_id, match_status)
  WHERE match_status = 'UNMATCHED';

CREATE INDEX IF NOT EXISTS idx_velocity_snapshots_tenant
  ON capital_velocity_snapshots(tenant_id, computed_at DESC);

CREATE INDEX IF NOT EXISTS idx_ledger_accounts_tenant
  ON ledger_accounts(tenant_id, account_code);

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE ledger_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_statement_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_fee_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE capital_velocity_snapshots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ledger_accounts'
    AND policyname = 'service_role_ledger_accounts'
  ) THEN
    CREATE POLICY "service_role_ledger_accounts"
      ON ledger_accounts FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'journal_entries'
    AND policyname = 'service_role_journal_entries'
  ) THEN
    CREATE POLICY "service_role_journal_entries"
      ON journal_entries FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'escrow_positions'
    AND policyname = 'service_role_escrow'
  ) THEN
    CREATE POLICY "service_role_escrow"
      ON escrow_positions FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'bank_statement_lines'
    AND policyname = 'service_role_bank_lines'
  ) THEN
    CREATE POLICY "service_role_bank_lines"
      ON bank_statement_lines FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'transaction_fee_records'
    AND policyname = 'service_role_fee_records'
  ) THEN
    CREATE POLICY "service_role_fee_records"
      ON transaction_fee_records FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'capital_velocity_snapshots'
    AND policyname = 'service_role_velocity'
  ) THEN
    CREATE POLICY "service_role_velocity"
      ON capital_velocity_snapshots FOR ALL USING (true);
  END IF;
END $$;
