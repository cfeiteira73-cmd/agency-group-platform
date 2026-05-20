-- =============================================================================
-- Migration: 20260520000008_ingestion_infrastructure
-- Purpose: Ingestion raw storage, monitoring, dedup index, tenant_id enforcement
-- =============================================================================

-- 1. Per-run ingestion monitoring log
create table if not exists ingestion_log (
  id           uuid primary key default gen_random_uuid(),
  run_id       text not null,
  provider     text not null,
  fetched      int  default 0,
  new_listings int  default 0,
  updated      int  default 0,
  duplicates   int  default 0,
  errors       jsonb,
  started_at   timestamptz not null,
  duration_ms  int,
  unique (run_id, provider)
);

create index if not exists idx_ingestion_log_started
  on ingestion_log(started_at desc);

-- 2. Raw provider payload store (enables replay without re-fetching)
create table if not exists properties_raw (
  id                  uuid primary key default gen_random_uuid(),
  provider            text not null,
  provider_listing_id text not null,
  raw_payload         jsonb not null,
  ingested_at         timestamptz default now(),
  unique (provider, provider_listing_id)
);

create index if not exists idx_properties_raw_provider
  on properties_raw(provider, ingested_at desc);

-- 3. Backfill tenant_id NULLs with canonical org UUID before enforcing NOT NULL
-- Only tables confirmed to have tenant_id column (verified via information_schema)
-- UUID type: contacts, deals, properties, deal_packs, matches
-- Text type: learning_events
update contacts       set tenant_id = '00000000-0000-0000-0000-000000000001' where tenant_id is null;
update deals          set tenant_id = '00000000-0000-0000-0000-000000000001' where tenant_id is null;
update properties     set tenant_id = '00000000-0000-0000-0000-000000000001' where tenant_id is null;
update deal_packs     set tenant_id = '00000000-0000-0000-0000-000000000001' where tenant_id is null;
update matches        set tenant_id = '00000000-0000-0000-0000-000000000001' where tenant_id is null;
update learning_events set tenant_id = '00000000-0000-0000-0000-000000000001' where tenant_id is null;

-- 5. Enforce NOT NULL on tenant_id (after backfill, this is safe)
-- Using DO blocks to handle case where column doesn't exist yet
-- 4. Enforce NOT NULL constraint on tenant_id
alter table contacts       alter column tenant_id set not null;
alter table deals          alter column tenant_id set not null;
alter table properties     alter column tenant_id set not null;
alter table deal_packs     alter column tenant_id set not null;
alter table matches        alter column tenant_id set not null;
alter table learning_events alter column tenant_id set not null;
