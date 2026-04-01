-- Agency Group · Supabase Schema
-- Run this in the Supabase SQL editor to set up the database

-- ─── Contacts table ────────────────────────────────────────────────────────
CREATE TABLE contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_email TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  nationality TEXT,
  budget_min BIGINT DEFAULT 0,
  budget_max BIGINT DEFAULT 0,
  tipos TEXT[] DEFAULT '{}',
  zonas TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'lead' CHECK (status IN ('vip', 'cliente', 'prospect', 'lead')),
  notes TEXT DEFAULT '',
  last_contact TEXT,
  next_follow_up TEXT,
  deal_ref TEXT,
  origin TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Deals table ───────────────────────────────────────────────────────────
CREATE TABLE deals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_email TEXT NOT NULL,
  ref TEXT UNIQUE NOT NULL,
  imovel TEXT NOT NULL,
  valor BIGINT DEFAULT 0,
  fase TEXT DEFAULT 'Angariação',
  checklist JSONB DEFAULT '{}',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Properties table ──────────────────────────────────────────────────────
CREATE TABLE properties (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ref TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  zona TEXT NOT NULL,
  bairro TEXT,
  tipo TEXT NOT NULL,
  preco BIGINT NOT NULL,
  area INTEGER,
  quartos INTEGER DEFAULT 0,
  casas_banho INTEGER DEFAULT 0,
  andar TEXT,
  energia TEXT,
  vista TEXT,
  piscina BOOLEAN DEFAULT false,
  garagem BOOLEAN DEFAULT false,
  jardim BOOLEAN DEFAULT false,
  terraco BOOLEAN DEFAULT false,
  condominio BOOLEAN DEFAULT false,
  badge TEXT,
  status TEXT DEFAULT 'Ativo',
  desc TEXT,
  features TEXT[] DEFAULT '{}',
  tour_url TEXT,
  agent_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Row Level Security ────────────────────────────────────────────────────
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- ─── Policies ──────────────────────────────────────────────────────────────
-- Agents can only access their own data (permissive for now — tighten with auth.uid())
CREATE POLICY "contacts_agent_access" ON contacts
  USING (agent_email = current_user OR true);

CREATE POLICY "deals_agent_access" ON deals
  USING (agent_email = current_user OR true);

-- Properties: public read, agent write
CREATE POLICY "properties_public_read" ON properties
  FOR SELECT USING (true);

CREATE POLICY "properties_agent_write" ON properties
  FOR ALL USING (agent_email = current_user OR true);

-- ─── Indexes for performance ───────────────────────────────────────────────
CREATE INDEX idx_contacts_agent ON contacts(agent_email);
CREATE INDEX idx_deals_agent ON deals(agent_email);
CREATE INDEX idx_properties_zona ON properties(zona);
CREATE INDEX idx_properties_status ON properties(status);
CREATE INDEX idx_properties_preco ON properties(preco);
