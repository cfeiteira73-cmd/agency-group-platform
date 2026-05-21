-- Agency Group — Capital Accounts Schema
-- Wave 39: Investor Capital Ledger + Settlement State Machine + Capital Intake
-- Migration: 000052_capital_accounts.sql

-- ─── investor_ledger_entries: immutable double-entry ledger ───────────────────

CREATE TABLE IF NOT EXISTS investor_ledger_entries (
  id                         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id                   text        NOT NULL UNIQUE,
  tenant_id                  uuid        NOT NULL,
  investor_id                text        NOT NULL,
  entry_type                 text        NOT NULL,
  amount_eur_cents           bigint      NOT NULL,
  running_available_cents    bigint      NOT NULL DEFAULT 0,
  running_committed_cents    bigint      NOT NULL DEFAULT 0,
  running_executed_cents     bigint      NOT NULL DEFAULT 0,
  reference_id               text,
  reference_type             text,
  description                text,
  idempotency_key            text        NOT NULL UNIQUE,
  created_at                 timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ledger_investor
  ON investor_ledger_entries(tenant_id, investor_id, created_at DESC);

ALTER TABLE investor_ledger_entries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'investor_ledger_entries'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON investor_ledger_entries
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- ─── settlements: core settlement records ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS settlements (
  id                         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id              text        NOT NULL UNIQUE,
  tenant_id                  uuid        NOT NULL,
  asset_id                   text        NOT NULL,
  buyer_investor_id          text        NOT NULL,
  seller_id                  text        NOT NULL,
  agreed_price_eur_cents     bigint      NOT NULL,
  commission_eur_cents       bigint      NOT NULL DEFAULT 0,
  current_state              text        NOT NULL DEFAULT 'INTENT',
  metadata                   jsonb       DEFAULT '{}',
  created_at                 timestamptz DEFAULT now(),
  updated_at                 timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_settlements_tenant
  ON settlements(tenant_id, current_state, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_settlements_investor
  ON settlements(tenant_id, buyer_investor_id);

ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'settlements'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON settlements
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- ─── settlement_transitions: immutable audit trail ────────────────────────────

CREATE TABLE IF NOT EXISTS settlement_transitions (
  id                         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  transition_id              text        NOT NULL UNIQUE,
  settlement_id              text        NOT NULL,
  from_state                 text        NOT NULL,
  to_state                   text        NOT NULL,
  transition                 text        NOT NULL,
  actor                      text        NOT NULL,
  notes                      text,
  sha256_chain_hash          text        NOT NULL,
  timestamp                  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_settlement_transitions
  ON settlement_transitions(settlement_id, timestamp ASC);

ALTER TABLE settlement_transitions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'settlement_transitions'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON settlement_transitions
      USING (
        EXISTS (
          SELECT 1 FROM settlements s
          WHERE s.settlement_id = settlement_transitions.settlement_id
            AND s.tenant_id::text = current_setting('app.tenant_id', true)
        )
      );
  END IF;
END $$;

-- ─── capital_intake_requests: payment ingestion records ──────────────────────

CREATE TABLE IF NOT EXISTS capital_intake_requests (
  id                         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_id                  text        NOT NULL UNIQUE,
  tenant_id                  uuid        NOT NULL,
  investor_id                text        NOT NULL,
  amount_eur_cents           bigint      NOT NULL,
  provider                   text        NOT NULL,
  reference                  text,
  idempotency_key            text        NOT NULL UNIQUE,
  status                     text        NOT NULL DEFAULT 'PENDING_CONFIRMATION',
  ledger_entry_id            text,
  confirmed_by               text,
  confirmed_at               timestamptz,
  metadata                   jsonb       DEFAULT '{}',
  created_at                 timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_capital_intake_tenant
  ON capital_intake_requests(tenant_id, status, created_at DESC);

ALTER TABLE capital_intake_requests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'capital_intake_requests'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON capital_intake_requests
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;
