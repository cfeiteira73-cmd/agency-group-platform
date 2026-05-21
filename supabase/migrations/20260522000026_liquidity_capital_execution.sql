-- =============================================================================
-- Migration: 20260522000026_liquidity_capital_execution.sql
-- Liquidity Engine + Capital Execution Layer tables
-- Wave 32 Agent 2
-- =============================================================================

CREATE TABLE IF NOT EXISTS liquidity_snapshots (
  id                      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id               uuid NOT NULL,
  property_id             uuid NOT NULL,
  grade                   char(1) NOT NULL CHECK (grade IN ('S','A','B','C','D')),
  score                   numeric(5,2) NOT NULL,
  time_to_execution_days  integer NOT NULL,
  probability_of_close    numeric(5,4) NOT NULL,
  capital_absorption_rate numeric(15,2) NOT NULL,
  components              jsonb NOT NULL DEFAULT '{}',
  computed_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS escrow_entries (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       uuid NOT NULL,
  transaction_id  uuid NOT NULL,
  property_id     uuid NOT NULL,
  investor_id     uuid NOT NULL,
  amount_eur      numeric(15,2) NOT NULL CHECK (amount_eur > 0),
  provider        text NOT NULL DEFAULT 'manual' CHECK (provider IN ('manual','stripe_escrow','bank_transfer')),
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','funded','locked','released','refunded','disputed')),
  reference_code  text NOT NULL,
  funded_at       timestamptz,
  locked_at       timestamptz,
  released_at     timestamptz,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, transaction_id)
);

CREATE TABLE IF NOT EXISTS capital_transactions (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id            uuid NOT NULL,
  property_id          uuid NOT NULL,
  investor_id          uuid NOT NULL,
  amount_eur           numeric(15,2) NOT NULL CHECK (amount_eur > 0),
  status               text NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated','escrow_created','settlement_tracking','completed','failed','cancelled')),
  escrow_id            uuid,
  settlement_id        uuid,
  liquidity_grade      char(1),
  probability_of_close numeric(5,4),
  initiated_at         timestamptz NOT NULL DEFAULT now(),
  completed_at         timestamptz,
  failure_reason       text,
  metadata             jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS settlement_records (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id           uuid NOT NULL,
  transaction_id      uuid NOT NULL,
  property_id         uuid NOT NULL,
  investor_id         uuid NOT NULL,
  stage               text NOT NULL DEFAULT 'investor_committed',
  amount_eur          numeric(15,2) NOT NULL,
  stage_history       jsonb NOT NULL DEFAULT '[]',
  target_close_date   date,
  actual_close_date   date,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, transaction_id)
);

CREATE TABLE IF NOT EXISTS signature_requests (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id        uuid NOT NULL,
  transaction_id   uuid NOT NULL,
  document_type    text NOT NULL CHECK (document_type IN ('cpcv','promissory_contract','deed','power_of_attorney','other')),
  status           text NOT NULL DEFAULT 'pending',
  buyer_signed_at  timestamptz,
  seller_signed_at timestamptz,
  fully_signed_at  timestamptz,
  expires_at       timestamptz NOT NULL,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_liquidity_snapshots_property
  ON liquidity_snapshots (tenant_id, property_id, computed_at DESC);

CREATE INDEX IF NOT EXISTS idx_capital_transactions_property
  ON capital_transactions (tenant_id, property_id);

CREATE INDEX IF NOT EXISTS idx_capital_transactions_investor
  ON capital_transactions (tenant_id, investor_id);

CREATE INDEX IF NOT EXISTS idx_settlement_records_transaction
  ON settlement_records (tenant_id, transaction_id);

CREATE INDEX IF NOT EXISTS idx_signature_requests_transaction
  ON signature_requests (tenant_id, transaction_id);

-- Row Level Security
ALTER TABLE liquidity_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE capital_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE signature_requests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'liquidity_snapshots' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON liquidity_snapshots
      TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'escrow_entries' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON escrow_entries
      TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'capital_transactions' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON capital_transactions
      TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'settlement_records' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON settlement_records
      TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'signature_requests' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON signature_requests
      TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
