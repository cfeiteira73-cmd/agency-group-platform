-- =============================================================================
-- Agency Group Portal — Migration 002: Missing Tables
-- Run this in Supabase Dashboard → SQL Editor
-- =============================================================================

-- 1. PROFILES (linked to auth.users)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  avatar_url  text,
  role        text not null default 'agent' check (role in ('admin','agent','viewer')),
  agency_id   text,
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- 2. ACTIVITIES (contact/deal interaction log)
create table if not exists public.activities (
  id          uuid primary key default gen_random_uuid(),
  type        text not null check (type in ('call','whatsapp','email','visit','note','proposal','cpcv','meeting','task')),
  contact_id  uuid references public.contacts(id) on delete cascade,
  deal_id     uuid references public.deals(id) on delete set null,
  agent_id    uuid references auth.users(id) on delete set null,
  note        text,
  duration    int,
  outcome     text,
  created_at  timestamptz not null default now()
);
alter table public.activities enable row level security;
create policy "Agents can manage activities" on public.activities for all using (true);

-- 3. VISITS (property visit scheduling)
create table if not exists public.visits (
  id              uuid primary key default gen_random_uuid(),
  property_id     int references public.properties(id) on delete set null,
  contact_id      uuid references public.contacts(id) on delete cascade,
  deal_id         uuid references public.deals(id) on delete set null,
  agent_id        uuid references auth.users(id) on delete set null,
  scheduled_at    timestamptz not null,
  status          text not null default 'agendada' check (status in ('agendada','realizada','cancelada','reagendada')),
  interest_score  int check (interest_score >= 1 and interest_score <= 5),
  notes           text,
  feedback        text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.visits enable row level security;
create policy "Agents can manage visits" on public.visits for all using (true);

-- 4. NOTIFICATIONS
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  agent_id    uuid references auth.users(id) on delete cascade,
  type        text not null check (type in ('deal_alert','follow_up','system','lead_hot','cpcv_due','escritura_due')),
  title       text not null,
  message     text not null,
  priority    text not null default 'normal' check (priority in ('low','normal','high','critical')),
  read        boolean not null default false,
  link        text,
  deal_id     uuid references public.deals(id) on delete set null,
  contact_id  uuid references public.contacts(id) on delete set null,
  created_at  timestamptz not null default now()
);
alter table public.notifications enable row level security;
create policy "Users see own notifications" on public.notifications for all using (auth.uid() = agent_id);

-- 5. SIGNALS (market opportunity signals)
create table if not exists public.signals (
  id              uuid primary key default gen_random_uuid(),
  type            text not null check (type in ('price_drop','new_listing','sold_comparable','dre_permit','zone_trend','off_market')),
  title           text not null,
  description     text,
  zone            text,
  property_id     int references public.properties(id) on delete set null,
  source          text,
  source_url      text,
  priority        text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  status          text not null default 'new' check (status in ('new','read','actioned','dismissed')),
  agent_id        uuid references auth.users(id) on delete set null,
  data            jsonb,
  created_at      timestamptz not null default now()
);
alter table public.signals enable row level security;
create policy "Agents can manage signals" on public.signals for all using (true);

-- 6. MARKET_SNAPSHOTS (historical market data snapshots)
create table if not exists public.market_snapshots (
  id              uuid primary key default gen_random_uuid(),
  zona            text not null,
  preco_medio     numeric(12,2),
  variacao_anual  numeric(5,2),
  transacoes      int,
  dias_mercado    int,
  yield_medio     numeric(5,2),
  snapshot_date   date not null default current_date,
  source          text default 'manual',
  created_at      timestamptz not null default now()
);
alter table public.market_snapshots enable row level security;
create policy "Anyone can read market snapshots" on public.market_snapshots for select using (true);
create policy "Agents can insert snapshots" on public.market_snapshots for insert with check (true);

-- 7. TASKS (agent task management)
create table if not exists public.tasks (
  id            uuid primary key default gen_random_uuid(),
  agent_id      uuid references auth.users(id) on delete cascade,
  contact_id    uuid references public.contacts(id) on delete set null,
  deal_id       uuid references public.deals(id) on delete set null,
  title         text not null,
  description   text,
  type          text not null default 'other' check (type in ('call','visit','email','proposal','cpcv','escritura','follow_up','other')),
  priority      text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status        text not null default 'pending' check (status in ('pending','in_progress','done','cancelled')),
  due_date      date,
  done_at       timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.tasks enable row level security;
create policy "Agents can manage own tasks" on public.tasks for all using (auth.uid() = agent_id);

-- Indexes for performance
create index if not exists idx_activities_contact on public.activities(contact_id);
create index if not exists idx_activities_deal on public.activities(deal_id);
create index if not exists idx_visits_contact on public.visits(contact_id);
create index if not exists idx_visits_scheduled on public.visits(scheduled_at);
create index if not exists idx_notifications_agent on public.notifications(agent_id, read);
create index if not exists idx_signals_zone on public.signals(zone, status);
create index if not exists idx_tasks_agent on public.tasks(agent_id, status);
create index if not exists idx_market_snapshots_zona on public.market_snapshots(zona, snapshot_date);

-- Grant permissions
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant select, insert, update on all tables in schema public to authenticated;
