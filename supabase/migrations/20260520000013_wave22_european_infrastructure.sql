-- =============================================================================
-- Migration: 20260520000013_wave22_european_infrastructure
-- Wave 22: Commission ledger, revenue snapshots, market liquidity,
--          investor graph edges, deal lineage, enriched properties
-- =============================================================================

-- 1. properties_raw — staging layer before normalization
create table if not exists properties_raw (
  id                   uuid        primary key default gen_random_uuid(),
  tenant_id            text        not null default '00000000-0000-0000-0000-000000000001',
  provider             text        not null,
  provider_listing_id  text        not null,
  raw_payload          jsonb       not null default '{}'::jsonb,
  normalized_property_id uuid      references properties(id),
  status               text        not null default 'pending'
                       check (status in ('pending','normalized','rejected','duplicate')),
  created_at           timestamptz not null default now(),
  unique (provider, provider_listing_id, tenant_id)
);
create index if not exists idx_properties_raw_tenant
  on properties_raw(tenant_id, status, created_at desc);
alter table properties_raw enable row level security;
create policy properties_raw_service_role on properties_raw
  for all to service_role using (true) with check (true);

-- 2. properties_enriched — materialized projection with AI scoring
create table if not exists properties_enriched (
  id                          uuid         primary key default gen_random_uuid(),
  tenant_id                   uuid         not null references organizations(id)
                              default '00000000-0000-0000-0000-000000000001',
  property_id                 uuid         not null references properties(id) on delete cascade,
  price_per_m2                numeric(10,2),
  investment_tier             text         check (investment_tier in ('entry','mid','premium','luxury')),
  geo_tier                    text         check (geo_tier in ('prime','secondary','emerging')),
  yield_estimate              numeric(5,2),
  liquidity_probability       numeric(5,2),
  appreciation_probability    numeric(5,2),
  days_on_market              integer,
  opportunity_score           numeric(5,2),
  investment_grade            text,
  country                     text         not null default 'PT',
  currency                    text         not null default 'EUR',
  enriched_at                 timestamptz  not null default now(),
  valid_until                 timestamptz,
  unique (property_id)
);
create index if not exists idx_properties_enriched_tenant
  on properties_enriched(tenant_id, opportunity_score desc);
create index if not exists idx_properties_enriched_country
  on properties_enriched(tenant_id, country, investment_grade);
alter table properties_enriched enable row level security;
create policy properties_enriched_authenticated on properties_enriched
  for all to authenticated
  using (tenant_id in (select org_id from org_members where email = auth.email()));
create policy properties_enriched_service_role on properties_enriched
  for all to service_role using (true) with check (true);

-- 3. commission_events — deterministic commission ledger
create table if not exists commission_events (
  id                   uuid         primary key default gen_random_uuid(),
  tenant_id            uuid         not null references organizations(id)
                       default '00000000-0000-0000-0000-000000000001',
  deal_id              text         not null,
  deal_ref             text,
  gross_commission_eur numeric(12,2) not null,
  net_commission_eur   numeric(12,2) not null,
  agency_split_eur     numeric(12,2) not null,
  agent_split_eur      numeric(12,2) not null,
  commission_rate      numeric(5,4) not null,
  tier                 text         not null
                       check (tier in ('standard','premium','institutional')),
  agent_email          text,
  zone                 text,
  status               text         not null default 'pending'
                       check (status in ('pending','confirmed','paid','disputed')),
  revenue_event_id     text,
  created_at           timestamptz  not null default now(),
  confirmed_at         timestamptz,
  paid_at              timestamptz
);
create index if not exists idx_commission_events_tenant
  on commission_events(tenant_id, status, created_at desc);
create index if not exists idx_commission_events_agent
  on commission_events(tenant_id, agent_email, created_at desc);
alter table commission_events enable row level security;
create policy commission_events_authenticated on commission_events
  for all to authenticated
  using (tenant_id in (select org_id from org_members where email = auth.email()));
create policy commission_events_service_role on commission_events
  for all to service_role using (true) with check (true);

-- 4. revenue_snapshot — rolling revenue aggregates
create table if not exists revenue_snapshot (
  id                  uuid         primary key default gen_random_uuid(),
  tenant_id           uuid         not null references organizations(id)
                      default '00000000-0000-0000-0000-000000000001',
  period_start        date         not null,
  period_end          date         not null,
  period_type         text         not null
                      check (period_type in ('daily','weekly','monthly','quarterly')),
  total_deals         integer      not null default 0,
  total_revenue_eur   numeric(15,2) not null default 0,
  total_commission_eur numeric(15,2) not null default 0,
  avg_deal_value_eur  numeric(12,2),
  top_agent_email     text,
  top_zone            text,
  deals_by_stage      jsonb        not null default '{}'::jsonb,
  computed_at         timestamptz  not null default now(),
  unique (tenant_id, period_type, period_start)
);
create index if not exists idx_revenue_snapshot_tenant
  on revenue_snapshot(tenant_id, period_type, period_start desc);
alter table revenue_snapshot enable row level security;
create policy revenue_snapshot_authenticated on revenue_snapshot
  for all to authenticated
  using (tenant_id in (select org_id from org_members where email = auth.email()));
create policy revenue_snapshot_service_role on revenue_snapshot
  for all to service_role using (true) with check (true);

-- 5. market_liquidity_snapshot — systemic market intelligence
create table if not exists market_liquidity_snapshot (
  id                  uuid         primary key default gen_random_uuid(),
  tenant_id           uuid         not null references organizations(id)
                      default '00000000-0000-0000-0000-000000000001',
  active_properties   integer      not null default 0,
  total_investors     integer      not null default 0,
  matches_pending     integer      not null default 0,
  deals_in_pipeline   integer      not null default 0,
  avg_match_score     numeric(5,2),
  liquidity_ratio     numeric(5,3),
  top_zones           jsonb        not null default '[]'::jsonb,
  avg_days_to_match   numeric(6,1),
  avg_days_to_close   numeric(6,1),
  country             text         not null default 'ALL',
  snapshot_date       date         not null,
  computed_at         timestamptz  not null default now(),
  unique (tenant_id, country, snapshot_date)
);
create index if not exists idx_market_liquidity_tenant
  on market_liquidity_snapshot(tenant_id, snapshot_date desc);
alter table market_liquidity_snapshot enable row level security;
create policy market_liquidity_authenticated on market_liquidity_snapshot
  for all to authenticated
  using (tenant_id in (select org_id from org_members where email = auth.email()));
create policy market_liquidity_service_role on market_liquidity_snapshot
  for all to service_role using (true) with check (true);

-- 6. investor_graph_edges — network effect tracking
create table if not exists investor_graph_edges (
  id          uuid         primary key default gen_random_uuid(),
  tenant_id   uuid         not null references organizations(id)
              default '00000000-0000-0000-0000-000000000001',
  from_type   text         not null check (from_type in ('investor','property','deal')),
  from_id     uuid         not null,
  to_type     text         not null check (to_type in ('investor','property','deal')),
  to_id       uuid         not null,
  edge_type   text         not null check (edge_type in ('match','interest','deal','referral','co_investment')),
  weight      numeric(5,4) not null default 1.0,
  metadata    jsonb        not null default '{}'::jsonb,
  created_at  timestamptz  not null default now(),
  unique (tenant_id, from_type, from_id, to_type, to_id, edge_type)
);
create index if not exists idx_graph_edges_tenant
  on investor_graph_edges(tenant_id, edge_type, created_at desc);
create index if not exists idx_graph_edges_from
  on investor_graph_edges(tenant_id, from_type, from_id);
create index if not exists idx_graph_edges_to
  on investor_graph_edges(tenant_id, to_type, to_id);
alter table investor_graph_edges enable row level security;
create policy graph_edges_service_role on investor_graph_edges
  for all to service_role using (true) with check (true);

-- 7. deal_lineage — full causal chain: lead → property → match → deal → revenue
create table if not exists deal_lineage (
  id                uuid         primary key default gen_random_uuid(),
  tenant_id         uuid         not null references organizations(id)
                    default '00000000-0000-0000-0000-000000000001',
  deal_id           text         not null,
  lead_id           uuid         references contacts(id),
  property_id       uuid         references properties(id),
  investor_id       uuid         references investors(id),
  match_id          uuid         references investor_matches(id),
  commission_id     uuid         references commission_events(id),
  revenue_event_id  text,
  chain_complete    boolean      not null default false,
  deal_value_eur    numeric(12,2),
  commission_eur    numeric(12,2),
  created_at        timestamptz  not null default now(),
  completed_at      timestamptz,
  unique (deal_id)
);
create index if not exists idx_deal_lineage_tenant
  on deal_lineage(tenant_id, chain_complete, created_at desc);
alter table deal_lineage enable row level security;
create policy deal_lineage_authenticated on deal_lineage
  for all to authenticated
  using (tenant_id in (select org_id from org_members where email = auth.email()));
create policy deal_lineage_service_role on deal_lineage
  for all to service_role using (true) with check (true);
