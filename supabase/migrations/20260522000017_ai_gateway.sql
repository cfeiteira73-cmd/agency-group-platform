-- =============================================================================
-- Agency Group — AI Gateway Tables
-- Migration: 20260522000017_ai_gateway.sql
--
-- Creates:
--   ai_budgets   — per-tenant AI spending limits (daily + monthly + hard_block)
--   ai_usage_log — full audit trail of every AI call (costs, tokens, latency)
--
-- RLS: service_role only for both tables.
-- All INSERT/SELECT from application code must use supabaseAdmin (service role).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ai_budgets: per-tenant spending limits
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ai_budgets (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  daily_limit_usd     numeric     NOT NULL DEFAULT 50.00,
  monthly_limit_usd   numeric     NOT NULL DEFAULT 500.00,
  hard_block          boolean     NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ai_budgets_tenant_unique UNIQUE (tenant_id),
  CONSTRAINT ai_budgets_daily_limit_positive   CHECK (daily_limit_usd   >= 0),
  CONSTRAINT ai_budgets_monthly_limit_positive CHECK (monthly_limit_usd >= 0)
);

-- Auto-update updated_at on every write
CREATE OR REPLACE FUNCTION ai_budgets_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ai_budgets_updated_at ON ai_budgets;
CREATE TRIGGER ai_budgets_updated_at
  BEFORE UPDATE ON ai_budgets
  FOR EACH ROW
  EXECUTE FUNCTION ai_budgets_set_updated_at();

-- RLS: disable row-level security — service_role bypasses RLS.
-- Application never uses anon/user keys for these tables.
ALTER TABLE ai_budgets ENABLE ROW LEVEL SECURITY;

-- Only service_role can read/write ai_budgets (no policies = deny all non-service)
-- Service role bypasses RLS policies by default in Supabase.

-- ---------------------------------------------------------------------------
-- ai_usage_log: full audit trail of every AI call
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ai_usage_log (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  feature         text        NOT NULL,
  model           text        NOT NULL,
  input_tokens    integer     NOT NULL DEFAULT 0,
  output_tokens   integer     NOT NULL DEFAULT 0,
  total_cost_usd  numeric     NOT NULL DEFAULT 0,
  latency_ms      integer,
  success         boolean     NOT NULL DEFAULT true,
  error_message   text,
  correlation_id  text,
  called_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ai_usage_log_input_tokens_non_negative  CHECK (input_tokens  >= 0),
  CONSTRAINT ai_usage_log_output_tokens_non_negative CHECK (output_tokens >= 0),
  CONSTRAINT ai_usage_log_cost_non_negative          CHECK (total_cost_usd >= 0)
);

-- Primary access pattern: tenant + date range (budget sum queries)
CREATE INDEX IF NOT EXISTS idx_ai_usage_tenant_date
  ON ai_usage_log (tenant_id, called_at DESC);

-- Secondary: tenant + feature + date (feature breakdown dashboard)
CREATE INDEX IF NOT EXISTS idx_ai_usage_feature
  ON ai_usage_log (tenant_id, feature, called_at DESC);

-- Tertiary: correlation_id lookups for distributed tracing
CREATE INDEX IF NOT EXISTS idx_ai_usage_correlation
  ON ai_usage_log (correlation_id)
  WHERE correlation_id IS NOT NULL;

-- RLS: service_role only
ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------

COMMENT ON TABLE ai_budgets IS
  'Per-tenant AI spending limits. Defaults (no row): daily=$50 monthly=$500. '
  'hard_block=true blocks ALL AI calls regardless of spend.';

COMMENT ON TABLE ai_usage_log IS
  'Immutable audit trail for every AI gateway call. '
  'Used for cost attribution, budget enforcement, and usage dashboards.';

COMMENT ON COLUMN ai_usage_log.feature IS
  'Logical feature label, e.g. chat, avm, deal_analysis, property_scoring.';

COMMENT ON COLUMN ai_usage_log.correlation_id IS
  'Distributed tracing ID — matches correlation_id in application logs.';
