-- Agency Group — Financial Rails Infrastructure
-- Migration: 000097_financial_rails.sql

-- PSP payment transactions
CREATE TABLE IF NOT EXISTS payment_rail_transactions (
  payment_id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID         NOT NULL,
  idempotency_key         TEXT         NOT NULL,
  provider                TEXT         NOT NULL,  -- 'STRIPE' | 'ADYEN'
  provider_payment_id     TEXT         NOT NULL,
  status                  TEXT         NOT NULL,
  amount_cents            BIGINT       NOT NULL,
  currency                TEXT         NOT NULL DEFAULT 'EUR',
  deal_id                 UUID,
  payment_type            TEXT         NOT NULL,
  metadata                JSONB,
  webhook_received_at     TIMESTAMPTZ,
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (idempotency_key, provider)
);

-- SEPA transfer log
CREATE TABLE IF NOT EXISTS sepa_transfer_log (
  transfer_id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID         NOT NULL,
  idempotency_key         TEXT         NOT NULL UNIQUE,
  provider                TEXT         NOT NULL DEFAULT 'GOCARDLESS',
  provider_payment_id     TEXT         NOT NULL,
  status                  TEXT         NOT NULL,
  amount_cents            BIGINT       NOT NULL,
  creditor_iban           TEXT,
  remittance_info         TEXT,
  deal_id                 UUID,
  payment_type            TEXT         NOT NULL,
  estimated_arrival       DATE,
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- SWIFT transfer log
CREATE TABLE IF NOT EXISTS swift_transfer_log (
  transfer_id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID         NOT NULL,
  idempotency_key         TEXT         NOT NULL UNIQUE,
  provider                TEXT         NOT NULL DEFAULT 'CURRENCYCLOUD',
  provider_payment_id     TEXT         NOT NULL,
  status                  TEXT         NOT NULL,
  amount_cents            BIGINT       NOT NULL,
  currency                TEXT         NOT NULL,
  deal_id                 UUID,
  payment_reason          TEXT         NOT NULL,
  estimated_arrival       DATE,
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Payment idempotency records
CREATE TABLE IF NOT EXISTS payment_idempotency_records (
  key                     TEXT         NOT NULL,
  operation_type          TEXT         NOT NULL,
  tenant_id               UUID         NOT NULL,
  amount_cents            BIGINT       NOT NULL,
  status                  TEXT         NOT NULL DEFAULT 'PROCESSING',
  result_snapshot         TEXT,
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  completed_at            TIMESTAMPTZ,
  PRIMARY KEY (key, operation_type, tenant_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payment_rail_tenant_deal ON payment_rail_transactions(tenant_id, deal_id);
CREATE INDEX IF NOT EXISTS idx_sepa_log_tenant ON sepa_transfer_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_swift_log_tenant ON swift_transfer_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_idempotency_key ON payment_idempotency_records(key, operation_type);

-- RLS
ALTER TABLE payment_rail_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sepa_transfer_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE swift_transfer_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_idempotency_records ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payment_rail_transactions' AND policyname = 'service_role_prt') THEN
    CREATE POLICY service_role_prt ON payment_rail_transactions FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sepa_transfer_log' AND policyname = 'service_role_sepa') THEN
    CREATE POLICY service_role_sepa ON sepa_transfer_log FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'swift_transfer_log' AND policyname = 'service_role_swift') THEN
    CREATE POLICY service_role_swift ON swift_transfer_log FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payment_idempotency_records' AND policyname = 'service_role_idempotency') THEN
    CREATE POLICY service_role_idempotency ON payment_idempotency_records FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
