-- Add tenant_id to priority_items (was missing — all other core tables already have it)
alter table priority_items
  add column if not exists tenant_id uuid references organizations(id) default '00000000-0000-0000-0000-000000000001';

-- Backfill existing rows
update priority_items set tenant_id = '00000000-0000-0000-0000-000000000001' where tenant_id is null;

-- Enforce NOT NULL
alter table priority_items alter column tenant_id set not null;

-- Index for tenant-scoped queries
create index if not exists idx_priority_items_tenant
  on priority_items(tenant_id, status, priority_score desc);
