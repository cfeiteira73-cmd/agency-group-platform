-- Agency Group — Wave 41: Capital Execution Pipeline
-- supabase/migrations/000066_capital_execution.sql

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. capital_execution_pipelines
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS capital_execution_pipelines (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id       text        UNIQUE NOT NULL,
  tenant_id         text        NOT NULL,
  deal_id           text        NOT NULL,
  investor_id       text        NOT NULL,
  amount_eur_cents  bigint      NOT NULL CHECK (amount_eur_cents > 0),
  current_stage     text        NOT NULL DEFAULT 'INVESTOR_BANK',
  overall_status    text        NOT NULL DEFAULT 'IN_PROGRESS',
  stages            jsonb       NOT NULL DEFAULT '[]',
  idempotency_key   text        UNIQUE NOT NULL,
  sha256_chain      text        NOT NULL,
  started_at        timestamptz NOT NULL DEFAULT now(),
  completed_at      timestamptz,
  rolled_back_at    timestamptz,
  rollback_reason   text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_capital_execution_pipelines_tenant
  ON capital_execution_pipelines(tenant_id, overall_status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_capital_execution_pipelines_deal
  ON capital_execution_pipelines(deal_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_capital_execution_pipelines_investor
  ON capital_execution_pipelines(investor_id, tenant_id);

ALTER TABLE capital_execution_pipelines ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'capital_execution_pipelines'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON capital_execution_pipelines
      USING (tenant_id = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. capital_execution_events
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS capital_execution_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    text        UNIQUE NOT NULL,
  tenant_id   text        NOT NULL,
  pipeline_id text        NOT NULL,
  event_type  text        NOT NULL,
  payload     jsonb       NOT NULL DEFAULT '{}',
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_capital_execution_events_pipeline
  ON capital_execution_events(pipeline_id, tenant_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_capital_execution_events_tenant_type
  ON capital_execution_events(tenant_id, event_type, occurred_at DESC);

ALTER TABLE capital_execution_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'capital_execution_events'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON capital_execution_events
      USING (tenant_id = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. psp_payment_intents
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS psp_payment_intents (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id        text        UNIQUE NOT NULL,
  tenant_id        text        NOT NULL,
  provider         text        NOT NULL,
  amount_eur_cents bigint      NOT NULL CHECK (amount_eur_cents > 0),
  currency         text        NOT NULL DEFAULT 'EUR',
  status           text        NOT NULL DEFAULT 'CREATED',
  external_ref     text        NOT NULL,
  metadata         jsonb       NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_psp_payment_intents_tenant
  ON psp_payment_intents(tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_psp_payment_intents_external_ref
  ON psp_payment_intents(external_ref);

ALTER TABLE psp_payment_intents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'psp_payment_intents'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON psp_payment_intents
      USING (tenant_id = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. psp_reconciliation_runs
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS psp_reconciliation_runs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id        text        UNIQUE NOT NULL,
  tenant_id     text        NOT NULL,
  reconciled    int         NOT NULL DEFAULT 0,
  discrepancies int         NOT NULL DEFAULT 0,
  run_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_psp_reconciliation_runs_tenant
  ON psp_reconciliation_runs(tenant_id, run_at DESC);

ALTER TABLE psp_reconciliation_runs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'psp_reconciliation_runs'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON psp_reconciliation_runs
      USING (tenant_id = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. bank_reconciliation_runs
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bank_reconciliation_runs (
  id                         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id                     text        UNIQUE NOT NULL,
  tenant_id                  text        NOT NULL,
  period_start               timestamptz NOT NULL,
  period_end                 timestamptz NOT NULL,
  total_entries              int         NOT NULL DEFAULT 0,
  matched                    int         NOT NULL DEFAULT 0,
  discrepancies              int         NOT NULL DEFAULT 0,
  missing_bank               int         NOT NULL DEFAULT 0,
  missing_ledger             int         NOT NULL DEFAULT 0,
  total_discrepancy_eur_cents bigint     NOT NULL DEFAULT 0,
  status                     text        NOT NULL DEFAULT 'COMPLETED',
  run_at                     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_reconciliation_runs_tenant
  ON bank_reconciliation_runs(tenant_id, run_at DESC);

ALTER TABLE bank_reconciliation_runs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'bank_reconciliation_runs'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON bank_reconciliation_runs
      USING (tenant_id = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. bank_reconciliation_entries
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bank_reconciliation_entries (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id                text        UNIQUE NOT NULL,
  tenant_id               text        NOT NULL,
  run_id                  text        NOT NULL,
  ledger_entry_id         text        NOT NULL,
  bank_statement_ref      text,
  psp_ref                 text,
  amount_eur_cents        bigint      NOT NULL DEFAULT 0,
  ledger_amount_eur_cents bigint      NOT NULL DEFAULT 0,
  discrepancy_eur_cents   bigint      NOT NULL DEFAULT 0,
  status                  text        NOT NULL DEFAULT 'PENDING',
  reconciled_at           timestamptz
);

CREATE INDEX IF NOT EXISTS idx_bank_reconciliation_entries_run
  ON bank_reconciliation_entries(run_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_bank_reconciliation_entries_status
  ON bank_reconciliation_entries(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_bank_reconciliation_entries_ledger
  ON bank_reconciliation_entries(ledger_entry_id);

ALTER TABLE bank_reconciliation_entries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'bank_reconciliation_entries'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON bank_reconciliation_entries
      USING (tenant_id = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. bank_statement_imports
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bank_statement_imports (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        text        NOT NULL,
  ref              text        NOT NULL,
  amount_eur_cents bigint      NOT NULL,
  statement_date   timestamptz NOT NULL,
  description      text        NOT NULL DEFAULT '',
  imported_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, ref)
);

CREATE INDEX IF NOT EXISTS idx_bank_statement_imports_tenant_date
  ON bank_statement_imports(tenant_id, statement_date DESC);

CREATE INDEX IF NOT EXISTS idx_bank_statement_imports_ref
  ON bank_statement_imports(tenant_id, ref);

ALTER TABLE bank_statement_imports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'bank_statement_imports'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON bank_statement_imports
      USING (tenant_id = current_setting('app.tenant_id', true));
  END IF;
END $$;
