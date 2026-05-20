-- Agency Group — event_history table
-- Persists all published events for replay, audit, and causal tracing.
-- Part of the SH-ROS (Self-Healing Revenue Operating System) data layer.

create table if not exists event_history (
  id             uuid        primary key default gen_random_uuid(),
  event_id       text        not null unique,
  correlation_id text        not null,
  tenant_id      text        not null default 'agency-group',
  event_type     text        not null,
  idempotency_key text,
  payload        jsonb,
  source_system  text,
  version        int         not null default 1,
  published_at   timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

create index if not exists idx_event_history_correlation on event_history(correlation_id);
create index if not exists idx_event_history_tenant      on event_history(tenant_id, published_at desc);
create index if not exists idx_event_history_type        on event_history(event_type, published_at desc);
create index if not exists idx_event_history_published   on event_history(published_at desc);

-- RLS: enable but keep permissive for now (service role has full access)
alter table event_history enable row level security;

create policy "service_role_full_access_event_history"
  on event_history for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "authenticated_read_event_history"
  on event_history for select
  to authenticated
  using (true);
