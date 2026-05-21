-- Agency Group — Wave 39 Execution Engine + Escrow Orchestration
-- 000054_execution.sql
-- Tables: escrow_accounts, execution_plans, legal_documents, cpcv_workflows, legal_events, legal_trigger_events

-- ─── escrow_accounts ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS escrow_accounts (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_id        text        NOT NULL UNIQUE,
  tenant_id        uuid        NOT NULL,
  settlement_id    text        NOT NULL,
  investor_id      text        NOT NULL,
  amount_eur_cents bigint      NOT NULL,
  fee_eur_cents    bigint      NOT NULL DEFAULT 0,
  state            text        NOT NULL DEFAULT 'PENDING',
  conditions       jsonb       DEFAULT '[]',
  funded_at        timestamptz,
  locked_at        timestamptz,
  released_at      timestamptz,
  release_type     text,
  conditions_met   boolean     DEFAULT false,
  audit_hash       text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_escrow_settlement
  ON escrow_accounts(tenant_id, settlement_id);

CREATE INDEX IF NOT EXISTS idx_escrow_investor
  ON escrow_accounts(tenant_id, investor_id, state);

ALTER TABLE escrow_accounts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'escrow_accounts'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON escrow_accounts
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- ─── execution_plans ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS execution_plans (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id          text        NOT NULL UNIQUE,
  tenant_id        uuid        NOT NULL,
  settlement_id    text        NOT NULL,
  asset_id         text        NOT NULL,
  investor_id      text        NOT NULL,
  bid_id           text        NOT NULL,
  amount_eur_cents bigint      NOT NULL,
  steps            jsonb       DEFAULT '[]',
  current_step     integer     DEFAULT 0,
  status           text        NOT NULL DEFAULT 'PLANNING',
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_execution_plans_tenant
  ON execution_plans(tenant_id, status, updated_at DESC);

ALTER TABLE execution_plans ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'execution_plans'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON execution_plans
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- ─── legal_documents ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS legal_documents (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id           text        NOT NULL UNIQUE,
  tenant_id        uuid        NOT NULL,
  settlement_id    text        NOT NULL,
  doc_type         text        NOT NULL,
  status           text        NOT NULL DEFAULT 'DOCUMENT_GENERATED',
  parties          jsonb       DEFAULT '[]',
  document_hash    text,
  signed_by        jsonb       DEFAULT '[]',
  notary_reference text,
  registered_at    timestamptz,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_docs_settlement
  ON legal_documents(tenant_id, settlement_id);

ALTER TABLE legal_documents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'legal_documents'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON legal_documents
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- ─── cpcv_workflows ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cpcv_workflows (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id          text        NOT NULL UNIQUE,
  tenant_id            uuid        NOT NULL,
  settlement_id        text        NOT NULL UNIQUE,
  cpcv_doc_id          text,
  deed_doc_id          text,
  cpcv_signed_at       timestamptz,
  deed_signed_at       timestamptz,
  notary_confirmed_at  timestamptz,
  registered_at        timestamptz,
  current_stage        text        NOT NULL DEFAULT 'INITIATED',
  blocking_reason      text,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cpcv_workflows_tenant
  ON cpcv_workflows(tenant_id, current_stage);

ALTER TABLE cpcv_workflows ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'cpcv_workflows'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON cpcv_workflows
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- ─── legal_events ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS legal_events (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid        NOT NULL,
  doc_id           text        NOT NULL,
  settlement_id    text        NOT NULL,
  event_type       text        NOT NULL,
  signed_by        text,
  notary_reference text,
  recorded_at      timestamptz DEFAULT now(),
  metadata         jsonb       DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_legal_events_settlement
  ON legal_events(tenant_id, settlement_id, recorded_at DESC);

ALTER TABLE legal_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'legal_events'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON legal_events
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- ─── legal_trigger_events ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS legal_trigger_events (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL,
  settlement_id text        NOT NULL,
  event_type    text        NOT NULL,
  triggered_at  timestamptz DEFAULT now(),
  metadata      jsonb       DEFAULT '{}'
);

ALTER TABLE legal_trigger_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'legal_trigger_events'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON legal_trigger_events
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;
