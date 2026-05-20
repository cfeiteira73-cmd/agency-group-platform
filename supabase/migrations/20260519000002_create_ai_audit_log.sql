create table if not exists ai_audit_log (
  id              uuid primary key default gen_random_uuid(),
  correlation_id  text        not null,
  model           text        not null,
  circuit_name    text        not null,
  input_tokens    int,
  output_tokens   int,
  latency_ms      int         not null,
  success         boolean     not null,
  fallback_used   boolean     not null,
  error_type      text,
  revenue_context text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_ai_audit_log_correlation on ai_audit_log(correlation_id);
create index if not exists idx_ai_audit_log_created    on ai_audit_log(created_at desc);
create index if not exists idx_ai_audit_log_model      on ai_audit_log(model, created_at desc);
alter table ai_audit_log enable row level security;
create policy "service_role_full_access_ai_audit" on ai_audit_log for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "authenticated_read_ai_audit" on ai_audit_log for select to authenticated using (true);
