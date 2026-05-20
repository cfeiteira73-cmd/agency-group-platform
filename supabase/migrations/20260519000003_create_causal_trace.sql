create table if not exists causal_trace (
  id             uuid        primary key default gen_random_uuid(),
  correlation_id text        not null,
  tenant_id      text        not null default 'agency-group',
  step_type      text        not null,
  entity_type    text,
  entity_id      text,
  agent_id       text,
  model          text,
  action         text,
  revenue_delta  numeric,
  latency_ms     int,
  success        boolean     not null default true,
  error_message  text,
  metadata       jsonb,
  created_at     timestamptz not null default now()
);
create index if not exists idx_causal_trace_correlation on causal_trace(correlation_id);
create index if not exists idx_causal_trace_entity      on causal_trace(entity_id, entity_type);
create index if not exists idx_causal_trace_tenant      on causal_trace(tenant_id, created_at desc);
create index if not exists idx_causal_trace_revenue     on causal_trace(tenant_id, created_at desc) where revenue_delta is not null;
alter table causal_trace enable row level security;
create policy "service_role_full_access_causal_trace" on causal_trace for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "authenticated_read_causal_trace" on causal_trace for select to authenticated using (true);
