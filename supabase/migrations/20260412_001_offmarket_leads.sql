-- =============================================================================
-- Agency Group — Off-Market Leads Table
-- Migration: 20260412_001_offmarket_leads
-- FASE 10: Off-Market Engine — prospect database for outbound captation
-- =============================================================================

CREATE TABLE IF NOT EXISTS offmarket_leads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Asset identification
  nome              TEXT NOT NULL,                          -- Owner name or property descriptor
  tipo_ativo        TEXT,                                   -- 'moradia','apartamento','quinta','herdade','terreno','comercial'
  localizacao       TEXT,                                   -- Free-form: zona, rua, parish
  cidade            TEXT,                                   -- Lisboa | Cascais | Porto | Algarve | Comporta | Madeira | ...
  area_m2           NUMERIC,
  ano_construcao    INTEGER,

  -- Valuation
  price_ask         NUMERIC,                               -- Owner's asking price (if known)
  price_estimate    NUMERIC,                               -- Our AVM estimate
  price_per_m2      NUMERIC GENERATED ALWAYS AS (
    CASE WHEN area_m2 > 0 THEN price_estimate / area_m2 ELSE NULL END
  ) STORED,

  -- AI scoring (0–100)
  score             SMALLINT CHECK (score BETWEEN 0 AND 100),
  score_breakdown   JSONB,                                 -- { location: N, condition: N, size: N, demand: N, urgency: N }
  score_updated_at  TIMESTAMPTZ,

  -- Owner / contact
  contacto          TEXT,                                  -- phone or email
  owner_type        TEXT,                                  -- 'individual','empresa','herança','banco','fundo'
  urgency           TEXT CHECK (urgency IN ('high','medium','low','unknown')) DEFAULT 'unknown',

  -- Source & pipeline
  source            TEXT,                                  -- 'apify_idealista','apify_olx','apify_imovirtual','manual','referral','portal'
  source_url        TEXT,
  source_listing_id TEXT,                                  -- Original listing ID on source platform
  status            TEXT CHECK (status IN (
    'new','contacted','interested','meeting_scheduled',
    'valuation_done','captation_active','not_interested','closed_won','closed_lost'
  )) DEFAULT 'new',

  -- Assignment & follow-up
  assigned_to       TEXT,                                  -- Consultant email or ID
  next_followup_at  TIMESTAMPTZ,
  last_contact_at   TIMESTAMPTZ,
  contact_attempts  SMALLINT DEFAULT 0,

  -- Notes & metadata
  notes             TEXT,
  tags              TEXT[],
  raw_data          JSONB,                                 -- Full scraped payload for reference

  -- Timestamps
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_offmarket_leads_status      ON offmarket_leads (status);
CREATE INDEX IF NOT EXISTS idx_offmarket_leads_cidade       ON offmarket_leads (cidade);
CREATE INDEX IF NOT EXISTS idx_offmarket_leads_score        ON offmarket_leads (score DESC);
CREATE INDEX IF NOT EXISTS idx_offmarket_leads_assigned     ON offmarket_leads (assigned_to);
CREATE INDEX IF NOT EXISTS idx_offmarket_leads_followup     ON offmarket_leads (next_followup_at) WHERE status NOT IN ('closed_won','closed_lost');
CREATE INDEX IF NOT EXISTS idx_offmarket_leads_source       ON offmarket_leads (source);
CREATE UNIQUE INDEX IF NOT EXISTS idx_offmarket_leads_source_id
  ON offmarket_leads (source, source_listing_id)
  WHERE source_listing_id IS NOT NULL;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_offmarket_leads_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_offmarket_leads_updated_at ON offmarket_leads;
CREATE TRIGGER trg_offmarket_leads_updated_at
  BEFORE UPDATE ON offmarket_leads
  FOR EACH ROW EXECUTE FUNCTION update_offmarket_leads_updated_at();

-- RLS
ALTER TABLE offmarket_leads ENABLE ROW LEVEL SECURITY;

-- Service role has full access (used by API routes and n8n)
CREATE POLICY "service_role_all" ON offmarket_leads
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated users (portal) can read all and update their assigned leads
CREATE POLICY "auth_read" ON offmarket_leads
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_update_assigned" ON offmarket_leads
  FOR UPDATE TO authenticated
  USING (assigned_to = auth.email())
  WITH CHECK (assigned_to = auth.email());
