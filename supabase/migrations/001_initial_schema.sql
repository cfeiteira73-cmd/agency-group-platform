-- Agency Group · Supabase Migration 001 · Initial Schema
-- Run in Supabase SQL editor or via supabase db push

-- ─── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Users (agents/admins) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email               TEXT UNIQUE NOT NULL,
  name                TEXT NOT NULL,
  password_hash       TEXT,
  role                TEXT DEFAULT 'agent' CHECK (role IN ('admin', 'agent', 'viewer')),
  avatar_url          TEXT,
  phone               TEXT,
  ami                 TEXT DEFAULT 'AMI 22506',
  totp_secret         TEXT,
  totp_secret_pending TEXT,
  is_active           BOOLEAN DEFAULT true,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Properties (imóveis) ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS properties (
  id             TEXT PRIMARY KEY, -- e.g. 'AG-2026-010'
  nome           TEXT NOT NULL,
  zona           TEXT NOT NULL,
  bairro         TEXT,
  tipo           TEXT NOT NULL CHECK (tipo IN ('Apartamento', 'Moradia', 'Villa', 'Penthouse', 'Quinta', 'Herdade')),
  preco          NUMERIC(15,2) NOT NULL,
  area           INTEGER NOT NULL,
  quartos        INTEGER,
  casas_banho    INTEGER,
  energia        TEXT,
  descricao      TEXT,
  features       JSONB DEFAULT '[]',
  views          TEXT,
  amenities      JSONB DEFAULT '{}',
  badge          TEXT CHECK (badge IN ('Destaque', 'Exclusivo', 'Off-Market', 'Novo')),
  status         TEXT DEFAULT 'active' CHECK (status IN ('active', 'sold', 'reserved', 'off-market')),
  lat            NUMERIC(10,7),
  lng            NUMERIC(10,7),
  images         JSONB DEFAULT '[]',
  matterport_url TEXT,
  youtube_url    TEXT,
  lifestyle_tags JSONB DEFAULT '[]',
  gradient       TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  agent_id       UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ─── CRM Contacts ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id           BIGSERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  email        TEXT,
  phone        TEXT,
  nationality  TEXT,
  language     TEXT DEFAULT 'PT' CHECK (language IN ('PT','EN','FR','DE','AR','ZH','ES','IT')),
  budget_min   NUMERIC(15,2),
  budget_max   NUMERIC(15,2),
  zonas        JSONB DEFAULT '[]',
  tipos        JSONB DEFAULT '[]',
  status       TEXT DEFAULT 'lead' CHECK (status IN ('lead','prospect','cliente','vip','inactive')),
  notes        TEXT,
  origin       TEXT CHECK (origin IN ('WhatsApp','Email','Referência','Website','LinkedIn','Phone','Event')),
  last_contact DATE,
  lead_score   INTEGER DEFAULT 0 CHECK (lead_score >= 0 AND lead_score <= 100),
  tasks        JSONB DEFAULT '[]',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  agent_id     UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ─── Deals (pipeline CPCV) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deals (
  id             BIGSERIAL PRIMARY KEY,
  ref            TEXT UNIQUE NOT NULL,
  imovel         TEXT NOT NULL,
  property_id    TEXT REFERENCES properties(id) ON DELETE SET NULL,
  valor          TEXT NOT NULL,
  fase           TEXT NOT NULL CHECK (fase IN (
                   'Angariação','Proposta Enviada','Proposta Aceite','Due Diligence',
                   'CPCV Assinado','Financiamento','Escritura Marcada','Escritura Concluída'
                 )),
  comprador      TEXT,
  contact_id     BIGINT REFERENCES contacts(id) ON DELETE SET NULL,
  cpcv_date      DATE,
  escritura_date DATE,
  notas          TEXT,
  checklist      JSONB DEFAULT '{}',
  deal_room      JSONB DEFAULT '[]',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  agent_id       UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ─── Visitas ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS visitas (
  id             BIGSERIAL PRIMARY KEY,
  property_id    TEXT REFERENCES properties(id) ON DELETE SET NULL,
  property_name  TEXT NOT NULL,
  contact_id     BIGINT REFERENCES contacts(id) ON DELETE SET NULL,
  contact_name   TEXT NOT NULL,
  date           DATE NOT NULL,
  time           TEXT,
  status         TEXT DEFAULT 'agendada' CHECK (status IN ('agendada','realizada','cancelada')),
  notes          TEXT,
  interest_score INTEGER CHECK (interest_score >= 1 AND interest_score <= 5),
  feedback       TEXT,
  ai_suggestion  JSONB,
  visit_type     TEXT DEFAULT 'presencial' CHECK (visit_type IN ('presencial','virtual')),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  agent_id       UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ─── Market Data Cache ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS market_data (
  zona         TEXT PRIMARY KEY,
  preco_m2     NUMERIC(10,2),
  yield_bruto  NUMERIC(5,2),
  yoy_percent  NUMERIC(5,2),
  dias_mercado INTEGER,
  cached_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Push Notification Tokens ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_tokens (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL,
  platform   TEXT CHECK (platform IN ('ios','android','web')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Analytics Events ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_events (
  id          BIGSERIAL PRIMARY KEY,
  event_type  TEXT NOT NULL,
  property_id TEXT,
  contact_id  BIGINT,
  user_id     UUID,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE contacts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals             ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties        ENABLE ROW LEVEL SECURITY;
ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens       ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events  ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's id from email
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID
LANGUAGE sql STABLE
AS $$
  SELECT id FROM users WHERE email = auth.email() LIMIT 1;
$$;

-- Helper function to check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$
  SELECT role = 'admin' FROM users WHERE email = auth.email() LIMIT 1;
$$;

-- ─── RLS Policies ─────────────────────────────────────────────────────────────

-- Users: can see and update own profile; admins see all
CREATE POLICY "users_own_profile" ON users
  FOR SELECT USING (id = current_user_id() OR is_admin());

CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (id = current_user_id());

-- Contacts: agents own; admins all
CREATE POLICY "contacts_agent_access" ON contacts
  FOR ALL USING (agent_id = current_user_id() OR is_admin());

-- Deals: agents own; admins all
CREATE POLICY "deals_agent_access" ON deals
  FOR ALL USING (agent_id = current_user_id() OR is_admin());

-- Visitas: agents own; admins all
CREATE POLICY "visitas_agent_access" ON visitas
  FOR ALL USING (agent_id = current_user_id() OR is_admin());

-- Properties: public read for active; write requires auth
CREATE POLICY "properties_public_read" ON properties
  FOR SELECT USING (status = 'active' OR agent_id = current_user_id() OR is_admin());

CREATE POLICY "properties_agent_write" ON properties
  FOR INSERT WITH CHECK (agent_id = current_user_id() OR is_admin());

CREATE POLICY "properties_agent_update" ON properties
  FOR UPDATE USING (agent_id = current_user_id() OR is_admin());

-- Push tokens: own only
CREATE POLICY "push_tokens_own" ON push_tokens
  FOR ALL USING (user_id = current_user_id());

-- Analytics: agents write own; admins read all
CREATE POLICY "analytics_agent_insert" ON analytics_events
  FOR INSERT WITH CHECK (user_id = current_user_id());

CREATE POLICY "analytics_admin_read" ON analytics_events
  FOR SELECT USING (user_id = current_user_id() OR is_admin());

-- ─── Performance Indexes ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_email         ON users(email);
CREATE INDEX IF NOT EXISTS idx_contacts_agent      ON contacts(agent_id);
CREATE INDEX IF NOT EXISTS idx_contacts_status     ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_last       ON contacts(last_contact);
CREATE INDEX IF NOT EXISTS idx_deals_agent         ON deals(agent_id);
CREATE INDEX IF NOT EXISTS idx_deals_fase          ON deals(fase);
CREATE INDEX IF NOT EXISTS idx_deals_ref           ON deals(ref);
CREATE INDEX IF NOT EXISTS idx_visitas_date        ON visitas(date);
CREATE INDEX IF NOT EXISTS idx_visitas_agent       ON visitas(agent_id);
CREATE INDEX IF NOT EXISTS idx_properties_zona     ON properties(zona);
CREATE INDEX IF NOT EXISTS idx_properties_preco    ON properties(preco);
CREATE INDEX IF NOT EXISTS idx_properties_status   ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_tipo     ON properties(tipo);
CREATE INDEX IF NOT EXISTS idx_analytics_event     ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created   ON analytics_events(created_at DESC);

-- ─── Updated_at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at     BEFORE UPDATE ON users     FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER contacts_updated_at  BEFORE UPDATE ON contacts  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER deals_updated_at     BEFORE UPDATE ON deals     FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER visitas_updated_at   BEFORE UPDATE ON visitas   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER properties_updated_at BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Seed admin user ─────────────────────────────────────────────────────────
-- Password: AgencyGroup2026! (change on first login)
INSERT INTO users (email, name, role, password_hash, ami)
VALUES (
  'carlos@agencygroup.pt',
  'Carlos Feiteira',
  'admin',
  crypt('AgencyGroup2026!', gen_salt('bf', 12)),
  'AMI 22506'
)
ON CONFLICT (email) DO NOTHING;

-- ─── Seed market data ─────────────────────────────────────────────────────────
INSERT INTO market_data (zona, preco_m2, yield_bruto, yoy_percent, dias_mercado) VALUES
  ('Lisboa',         5000, 4.5, 18.0, 45),
  ('Lisboa — Chiado', 7000, 4.3, 20.0, 38),
  ('Lisboa — Príncipe Real', 7400, 4.2, 19.0, 40),
  ('Lisboa — Belém', 5200, 4.4, 17.0, 50),
  ('Cascais',        4713, 4.6, 15.5, 55),
  ('Porto',          3643, 5.2, 14.0, 60),
  ('Porto — Foz',    4800, 4.8, 15.0, 48),
  ('Algarve',        3941, 5.5, 12.0, 90),
  ('Comporta',       8500, 4.1, 12.0, 120),
  ('Madeira',        3760, 5.0, 11.0, 75),
  ('Sintra',         3200, 4.9, 13.0, 65),
  ('Ericeira',       3500, 5.1, 14.5, 70)
ON CONFLICT (zona) DO NOTHING;
