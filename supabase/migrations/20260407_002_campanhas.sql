-- =============================================================================
-- AGENCY GROUP — Campanhas Table Migration
-- 20260407_002_campanhas.sql
-- AMI: 22506 | Marketing Campaign Tracking — email, whatsapp, social, ads
-- =============================================================================

CREATE TABLE IF NOT EXISTS campanhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Identity
  nome TEXT NOT NULL,
  tipo TEXT CHECK (tipo IN ('email','whatsapp','social','google_ads','meta_ads','referral','organico')) DEFAULT 'email',
  status TEXT CHECK (status IN ('rascunho','ativa','pausada','concluida')) DEFAULT 'rascunho',

  -- Schedule
  data_inicio DATE,
  data_fim DATE,

  -- Budget
  orcamento NUMERIC(10,2),
  gasto_atual NUMERIC(10,2) DEFAULT 0,

  -- Funnel metrics
  leads_gerados INTEGER DEFAULT 0,
  visitas INTEGER DEFAULT 0,
  reunioes INTEGER DEFAULT 0,
  propostas INTEGER DEFAULT 0,
  fechados INTEGER DEFAULT 0,
  receita_gerada NUMERIC(12,2) DEFAULT 0,

  -- Targeting
  publico_alvo TEXT,
  zonas TEXT[],
  segmento_preco TEXT,

  -- Creative
  plataforma TEXT,
  criativo_url TEXT,

  -- Meta
  notas TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_campanhas_status ON campanhas(status);
CREATE INDEX IF NOT EXISTS idx_campanhas_tipo ON campanhas(tipo);
CREATE INDEX IF NOT EXISTS idx_campanhas_datas ON campanhas(data_inicio, data_fim);
CREATE INDEX IF NOT EXISTS idx_campanhas_created ON campanhas(created_at DESC);

-- Row Level Security
ALTER TABLE campanhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage campanhas"
  ON campanhas FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_campanhas_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_campanhas_updated_at ON campanhas;
CREATE TRIGGER trg_campanhas_updated_at
  BEFORE UPDATE ON campanhas
  FOR EACH ROW EXECUTE FUNCTION update_campanhas_updated_at();
