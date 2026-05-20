-- =============================================================================
-- Migration: 20260520000012_job_queue_investors_scores
-- Wave 21: Queue infrastructure + Investor engine + Property scoring persistence
-- =============================================================================

-- 1. job_queue
create table if not exists job_queue (
  id             uuid         primary key default gen_random_uuid(),
  queue          text         not null,
  payload        jsonb        not null default '{}'::jsonb,
  tenant_id      text         not null default '00000000-0000-0000-0000-000000000001',
  correlation_id text,
  attempt        int          not null default 1,
  max_attempts   int          not null default 3,
  status         text         not null default 'pending'
                 check (status in ('pending','processing','done','failed')),
  error          text,
  scheduled_at   timestamptz  not null default now(),
  processed_at   timestamptz,
  created_at     timestamptz  not null default now()
);
create index if not exists idx_job_queue_pending
  on job_queue(queue, scheduled_at asc) where status = 'pending';
create index if not exists idx_job_queue_tenant
  on job_queue(tenant_id, queue, status);
alter table job_queue enable row level security;
create policy job_queue_service_role on job_queue
  for all to service_role using (true) with check (true);

-- 2. investors
create table if not exists investors (
  id                       uuid         primary key default gen_random_uuid(),
  tenant_id                uuid         not null references organizations(id)
                           default '00000000-0000-0000-0000-000000000001',
  name                     text         not null,
  email                    text,
  phone                    text,
  nationality              text,
  language                 text         not null default 'pt',
  investor_type            text         not null default 'individual'
                           check (investor_type in ('individual','family_office','fund','institution')),
  capital_min_eur          bigint,
  capital_max_eur          bigint,
  risk_tolerance           text         not null default 'moderate'
                           check (risk_tolerance in ('conservative','moderate','aggressive')),
  yield_target_pct         numeric(5,2),
  liquidity_preference     text         not null default 'medium'
                           check (liquidity_preference in ('short','medium','long')),
  geography_preference     text[]       not null default '{}',
  property_type_preference text[]       not null default '{}',
  deal_count               integer      not null default 0,
  total_invested_eur       bigint       not null default 0,
  last_contact_at          timestamptz,
  next_followup_at         timestamptz,
  status                   text         not null default 'active'
                           check (status in ('active','inactive','archived')),
  notes                    text,
  tags                     text[]       not null default '{}',
  created_at               timestamptz  not null default now(),
  updated_at               timestamptz  not null default now(),
  created_by               text
);
create index if not exists idx_investors_tenant
  on investors(tenant_id, status, risk_tolerance);
create index if not exists idx_investors_capital
  on investors(tenant_id, capital_min_eur, capital_max_eur) where status = 'active';
alter table investors enable row level security;
create policy investors_authenticated on investors
  for all to authenticated
  using (tenant_id in (select org_id from org_members where email = auth.email()));
create policy investors_service_role on investors
  for all to service_role using (true) with check (true);

-- 3. investor_matches
create table if not exists investor_matches (
  id            uuid         primary key default gen_random_uuid(),
  tenant_id     uuid         not null references organizations(id)
                default '00000000-0000-0000-0000-000000000001',
  investor_id   uuid         not null references investors(id) on delete cascade,
  property_id   uuid         not null references properties(id) on delete cascade,
  match_score   numeric(5,2) not null,
  capital_fit   numeric(5,2),
  yield_fit     numeric(5,2),
  geography_fit numeric(5,2),
  risk_fit      numeric(5,2),
  type_fit      numeric(5,2),
  status        text         not null default 'pending'
                check (status in ('pending','sent','viewed','interested','rejected','deal')),
  sent_at       timestamptz,
  responded_at  timestamptz,
  created_at    timestamptz  not null default now(),
  unique (investor_id, property_id)
);
create index if not exists idx_investor_matches_tenant
  on investor_matches(tenant_id, status, match_score desc);
create index if not exists idx_investor_matches_investor
  on investor_matches(investor_id, status);
create index if not exists idx_investor_matches_property
  on investor_matches(property_id, match_score desc);
alter table investor_matches enable row level security;
create policy investor_matches_authenticated on investor_matches
  for all to authenticated
  using (tenant_id in (select org_id from org_members where email = auth.email()));
create policy investor_matches_service_role on investor_matches
  for all to service_role using (true) with check (true);

-- 4. property_scores
create table if not exists property_scores (
  id                uuid         primary key default gen_random_uuid(),
  tenant_id         uuid         not null references organizations(id)
                    default '00000000-0000-0000-0000-000000000001',
  property_id       uuid         not null references properties(id) on delete cascade,
  opportunity_score numeric(5,2),
  yield_score       numeric(5,2),
  risk_score        numeric(5,2),
  liquidity_score   numeric(5,2),
  investment_score  numeric(5,2),
  grade             text,
  confidence        numeric(5,2),
  model_version     text         not null default 'v2',
  scored_at         timestamptz  not null default now(),
  valid_until       timestamptz,
  unique (property_id)
);
create index if not exists idx_property_scores_tenant
  on property_scores(tenant_id, investment_score desc);
create index if not exists idx_property_scores_grade
  on property_scores(tenant_id, grade, scored_at desc);
alter table property_scores enable row level security;
create policy property_scores_authenticated on property_scores
  for all to authenticated
  using (tenant_id in (select org_id from org_members where email = auth.email()));
create policy property_scores_service_role on property_scores
  for all to service_role using (true) with check (true);
