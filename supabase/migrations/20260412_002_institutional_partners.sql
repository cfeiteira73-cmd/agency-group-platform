-- =============================================================================
-- Agency Group — Institutional Partners Table
-- Migration: 20260412_002_institutional_partners
-- FASE 11: Institutional Captation — lawyers, banks, accountants, family offices
-- =============================================================================

CREATE TABLE IF NOT EXISTS institutional_partners (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  nome              TEXT NOT NULL,
  empresa           TEXT,
  tipo              TEXT CHECK (tipo IN (
    'advogado','notario','contabilista','gestor_patrimonio',
    'family_office','banco','fundo_investimento',
    'mediador_parceiro','promotor','outro'
  )) NOT NULL,

  -- Contact
  email             TEXT,
  phone             TEXT,
  linkedin_url      TEXT,
  website           TEXT,

  -- Location & segment
  cidade            TEXT,                                  -- Base city
  paises_actuacao   TEXT[],                               -- Countries they operate in
  segmento          TEXT CHECK (segmento IN (
    'residencial_luxo','comercial','logistica',
    'turismo','hotelaria','terrenos','misto'
  )),
  ticket_medio      NUMERIC,                               -- Average transaction size they handle

  -- Relationship
  origem            TEXT CHECK (origem IN (
    'evento','referral','linkedin','cold_outreach',
    'portal','conference','introducao_directa','outro'
  )),
  estado            TEXT CHECK (estado IN (
    'prospect','contactado','reuniao_feita','parceiro_activo',
    'dormente','inactivo'
  )) DEFAULT 'prospect',
  nivel_prioridade  TEXT CHECK (nivel_prioridade IN ('A','B','C')) DEFAULT 'B',

  -- Activity
  last_contact_at   TIMESTAMPTZ,
  next_followup_at  TIMESTAMPTZ,
  contact_attempts  SMALLINT DEFAULT 0,
  deals_referidos   SMALLINT DEFAULT 0,                   -- Number of deals referred
  volume_referido   NUMERIC DEFAULT 0,                    -- Total € referred

  -- Owner & notes
  owner             TEXT,                                  -- Assigned consultant email
  notes             TEXT,
  tags              TEXT[],

  -- Timestamps
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_inst_partners_tipo          ON institutional_partners (tipo);
CREATE INDEX IF NOT EXISTS idx_inst_partners_estado        ON institutional_partners (estado);
CREATE INDEX IF NOT EXISTS idx_inst_partners_cidade        ON institutional_partners (cidade);
CREATE INDEX IF NOT EXISTS idx_inst_partners_prioridade    ON institutional_partners (nivel_prioridade);
CREATE INDEX IF NOT EXISTS idx_inst_partners_owner         ON institutional_partners (owner);
CREATE INDEX IF NOT EXISTS idx_inst_partners_followup      ON institutional_partners (next_followup_at)
  WHERE estado NOT IN ('inactivo');
CREATE UNIQUE INDEX IF NOT EXISTS idx_inst_partners_email  ON institutional_partners (email)
  WHERE email IS NOT NULL;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_institutional_partners_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_inst_partners_updated_at ON institutional_partners;
CREATE TRIGGER trg_inst_partners_updated_at
  BEFORE UPDATE ON institutional_partners
  FOR EACH ROW EXECUTE FUNCTION update_institutional_partners_updated_at();

-- RLS
ALTER TABLE institutional_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON institutional_partners
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "auth_read" ON institutional_partners
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_update_owned" ON institutional_partners
  FOR UPDATE TO authenticated
  USING (owner = auth.email())
  WITH CHECK (owner = auth.email());
