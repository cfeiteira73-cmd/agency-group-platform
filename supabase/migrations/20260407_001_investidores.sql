-- =============================================================================
-- AGENCY GROUP — Investidores Table Migration
-- 20260407_001_investidores.sql
-- AMI: 22506 | Investor CRM — family offices, HNWI, institucional, privado, fundo
-- =============================================================================

CREATE TABLE IF NOT EXISTS investidores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Identity
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  whatsapp TEXT,
  nacionalidade TEXT,
  flag TEXT, -- emoji flag e.g. 🇬🇧

  -- Classification
  tipo TEXT CHECK (tipo IN ('family_office','hnwi','institucional','privado','fundo')) DEFAULT 'privado',

  -- Investment profile (API uses snake_case; mapRow handles both)
  capital_min NUMERIC(12,2),
  capital_max NUMERIC(12,2),
  yield_target NUMERIC(5,2),
  horizon_years INTEGER,
  risk_profile TEXT DEFAULT 'moderado',

  -- Preferences
  zonas TEXT[],
  tipo_imovel TEXT[],
  ocupacao TEXT DEFAULT 'qualquer',

  -- Investor-specific flags
  nhr_interesse BOOLEAN DEFAULT false,
  golden_visa BOOLEAN DEFAULT false,

  -- CRM tracking
  status TEXT CHECK (status IN ('activo','ativo','dormiente','convertido','perdido')) DEFAULT 'activo',
  pipeline_stage TEXT DEFAULT 'qualificacao',
  last_contact DATE,
  total_invested NUMERIC(12,2) DEFAULT 0,
  deals_history INTEGER DEFAULT 0,

  -- Meta
  notes TEXT,
  tags TEXT[],
  lingua TEXT DEFAULT 'pt',
  fonte TEXT,
  consultor_id UUID
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_investidores_status ON investidores(status);
CREATE INDEX IF NOT EXISTS idx_investidores_tipo ON investidores(tipo);
CREATE INDEX IF NOT EXISTS idx_investidores_capital ON investidores(capital_min, capital_max);
CREATE INDEX IF NOT EXISTS idx_investidores_nacionalidade ON investidores(nacionalidade);
CREATE INDEX IF NOT EXISTS idx_investidores_created ON investidores(created_at DESC);

-- Row Level Security
ALTER TABLE investidores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage investidores"
  ON investidores FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_investidores_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_investidores_updated_at ON investidores;
CREATE TRIGGER trg_investidores_updated_at
  BEFORE UPDATE ON investidores
  FOR EACH ROW EXECUTE FUNCTION update_investidores_updated_at();
