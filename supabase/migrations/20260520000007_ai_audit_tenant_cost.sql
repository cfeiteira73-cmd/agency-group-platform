-- =============================================================================
-- Wave 19: Add per-tenant cost tracking to ai_audit_log
-- Enables multi-tenant AI budget monitoring and cost attribution per call.
-- Safe: IF NOT EXISTS guards — idempotent on re-run.
-- =============================================================================

alter table ai_audit_log
  add column if not exists tenant_id text,
  add column if not exists cost_usd  numeric(10,6);

-- Index for per-tenant cost queries (e.g. "total cost for tenant X this month")
create index if not exists idx_ai_audit_tenant
  on ai_audit_log(tenant_id, created_at desc);

-- Index for cost analysis (find most expensive calls)
create index if not exists idx_ai_audit_cost
  on ai_audit_log(cost_usd desc)
  where cost_usd is not null;

comment on column ai_audit_log.tenant_id is 'Tenant identifier — set by withAI() from caller context';
comment on column ai_audit_log.cost_usd  is 'USD cost of this call: (input_tokens/1000 * input_rate) + (output_tokens/1000 * output_rate)';
