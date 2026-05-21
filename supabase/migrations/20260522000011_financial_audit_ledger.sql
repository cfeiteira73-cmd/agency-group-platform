-- =============================================================================
-- Agency Group — Immutable Financial Audit Ledger + Pipeline Traces
-- Migration: 20260522000011_financial_audit_ledger.sql
--
-- financial_ledger: append-only audit trail with SHA-256 hash chain.
-- pipeline_traces:  cached capital pipeline trace per deal.
--
-- CRITICAL IMMUTABILITY GUARANTEES:
--   - No UPDATE policy defined — only INSERT via service_role
--   - No DELETE policy defined
--   - sequence_number is UNIQUE per tenant (prevents reordering attacks)
--   - entry_hash chain enables tamper detection without external PKI
--
-- AMI: 22506 | SH-ROS Financial Audit Infrastructure
-- =============================================================================

-- ─── financial_ledger ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS financial_ledger (
  entry_id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 uuid        NOT NULL REFERENCES organizations(id),
  sequence_number           bigint      NOT NULL,

  entry_type                text        NOT NULL,

  -- Entity references (nullable — not all events relate to all entities)
  deal_id                   text,
  property_id               text,
  investor_id               text,
  lead_id                   text,
  agent_id                  text,

  -- Financial data (all nullable — populated based on entry_type)
  gross_value_eur           numeric,
  commission_rate_pct       numeric,
  commission_gross_eur      numeric,
  vat_eur                   numeric,
  commission_net_eur        numeric,
  agent_split_eur           numeric,
  agency_split_eur          numeric,

  -- Revenue recognition
  recognition_pct           numeric,          -- 50 for CPCV, 50 for Escritura
  cumulative_recognized_pct numeric,          -- 0→50→100 across lifecycle

  -- Chain linkage
  previous_entry_id         uuid        REFERENCES financial_ledger(entry_id),

  -- Audit metadata (immutable after INSERT)
  correlation_id            text,
  recorded_by               text        NOT NULL DEFAULT 'system',
  recorded_at               timestamptz NOT NULL DEFAULT now(),
  notes                     text,

  -- Tamper-evident hash chain
  -- entry_hash = SHA-256(previous_hash || JSON.stringify(entry_data, sorted_keys))
  entry_hash                text        NOT NULL,
  previous_hash             text        NOT NULL DEFAULT '0000000000000000000000000000000000000000000000000000000000000000',

  -- Immutability constraint: one sequence_number per tenant
  CONSTRAINT financial_ledger_tenant_seq_unique UNIQUE (tenant_id, sequence_number)
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

-- Primary traversal: tenant → ordered sequence (integrity verification, reconciliation)
CREATE INDEX IF NOT EXISTS idx_ledger_tenant_seq
  ON financial_ledger(tenant_id, sequence_number);

-- Deal-scoped audit trail (most common access pattern)
CREATE INDEX IF NOT EXISTS idx_ledger_deal
  ON financial_ledger(deal_id, recorded_at DESC)
  WHERE deal_id IS NOT NULL;

-- Type + date range (reconciliation reports, analytics)
CREATE INDEX IF NOT EXISTS idx_ledger_type_date
  ON financial_ledger(tenant_id, entry_type, recorded_at DESC);

-- Agent commission aggregation
CREATE INDEX IF NOT EXISTS idx_ledger_agent_date
  ON financial_ledger(agent_id, recorded_at DESC)
  WHERE agent_id IS NOT NULL;

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE financial_ledger ENABLE ROW LEVEL SECURITY;

-- service_role: full access (INSERT only in practice — no UPDATE/DELETE policies)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'financial_ledger'
    AND   policyname = 'service_role_ledger_all'
  ) THEN
    CREATE POLICY service_role_ledger_all
      ON financial_ledger
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- authenticated users: SELECT their own tenant's ledger (read-only audit access)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'financial_ledger'
    AND   policyname = 'tenant_ledger_select'
  ) THEN
    CREATE POLICY tenant_ledger_select
      ON financial_ledger
      FOR SELECT
      TO authenticated
      USING (
        tenant_id IN (
          SELECT org_id FROM organization_members WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- INTENTIONALLY NO UPDATE POLICY — immutable by design
-- INTENTIONALLY NO DELETE POLICY — immutable by design
-- Any attempt to UPDATE/DELETE via authenticated role will be rejected by RLS

-- ─── pipeline_traces ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pipeline_traces (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid        NOT NULL REFERENCES organizations(id),
  deal_id      text        NOT NULL,
  trace        jsonb       NOT NULL,
  computed_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT pipeline_traces_tenant_deal_unique UNIQUE (tenant_id, deal_id)
);

-- Index for quick lookup by tenant + deal
CREATE INDEX IF NOT EXISTS idx_pipeline_traces_tenant_deal
  ON pipeline_traces(tenant_id, deal_id);

-- Index for freshness queries (stale trace detection)
CREATE INDEX IF NOT EXISTS idx_pipeline_traces_computed_at
  ON pipeline_traces(tenant_id, computed_at DESC);

-- ─── RLS for pipeline_traces ──────────────────────────────────────────────────

ALTER TABLE pipeline_traces ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pipeline_traces'
    AND   policyname = 'service_role_pipeline_traces_all'
  ) THEN
    CREATE POLICY service_role_pipeline_traces_all
      ON pipeline_traces
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pipeline_traces'
    AND   policyname = 'tenant_pipeline_traces_select'
  ) THEN
    CREATE POLICY tenant_pipeline_traces_select
      ON pipeline_traces
      FOR SELECT
      TO authenticated
      USING (
        tenant_id IN (
          SELECT org_id FROM organization_members WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ─── Comments ─────────────────────────────────────────────────────────────────

COMMENT ON TABLE financial_ledger IS
  'Immutable append-only financial audit trail. Hash chain provides tamper evidence. '
  'Never UPDATE or DELETE rows. INSERT only via service_role. '
  'Sequence numbers are monotonically increasing per tenant. '
  'SHA-256 chain: entry_hash = SHA256(previous_hash || sorted_JSON(entry_data)).';

COMMENT ON COLUMN financial_ledger.entry_hash IS
  'SHA-256(previous_hash || JSON.stringify(entry_data, sorted_keys)). '
  'Recomputable from entry fields. Mismatch = tampering detected.';

COMMENT ON COLUMN financial_ledger.previous_hash IS
  'entry_hash of the previous entry for this tenant. '
  'Genesis entry uses 000...000 (64 zeros).';

COMMENT ON COLUMN financial_ledger.sequence_number IS
  'Monotonically increasing per tenant. Enforced by UNIQUE(tenant_id, sequence_number). '
  'Concurrent inserts must retry on conflict code 23505.';

COMMENT ON TABLE pipeline_traces IS
  'Cached CapitalPipelineTrace per deal. Rebuilt on demand by buildPipelineTrace(). '
  'Stale if computed_at is older than the last financial_ledger entry for the deal.';
