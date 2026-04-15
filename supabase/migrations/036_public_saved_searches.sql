-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 036: public_saved_searches
-- Purpose: Store anonymous buyer search alerts (email + criteria)
--          without requiring auth.users session.
--          Replaces Notion-based storage in /api/alerts.
--          n8n queries this table to send matching property alerts.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public_saved_searches (
  id            UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  email         TEXT          NOT NULL,
  zona          TEXT          DEFAULT 'Todas',
  tipo          TEXT          DEFAULT 'Todos',
  preco_min     INTEGER       DEFAULT 0,
  preco_max     INTEGER       DEFAULT 10000000,
  quartos_min   SMALLINT      DEFAULT 0,
  piscina       BOOLEAN       DEFAULT false,
  purpose       TEXT          DEFAULT 'buy',   -- 'buy' | 'invest' | 'both'
  keyword       TEXT,                           -- free-text hint e.g. "frente mar"
  is_active     BOOLEAN       DEFAULT true,
  last_notified_at TIMESTAMPTZ,
  notify_count  SMALLINT      DEFAULT 0,
  source        TEXT          DEFAULT 'imoveis_page', -- page where CTA was triggered
  created_at    TIMESTAMPTZ   DEFAULT now(),
  updated_at    TIMESTAMPTZ   DEFAULT now()
);

-- Dedup index: same email + zona + tipo = same alert
CREATE UNIQUE INDEX IF NOT EXISTS idx_pss_email_zona_tipo
  ON public_saved_searches (email, zona, tipo)
  WHERE is_active = true;

-- Query indexes for n8n matching
CREATE INDEX IF NOT EXISTS idx_pss_active     ON public_saved_searches (is_active);
CREATE INDEX IF NOT EXISTS idx_pss_zona       ON public_saved_searches (zona);
CREATE INDEX IF NOT EXISTS idx_pss_created    ON public_saved_searches (created_at DESC);

-- RLS: disabled for anonymous writes, service_role reads for n8n
ALTER TABLE public_saved_searches DISABLE ROW LEVEL SECURITY;

-- Grant anon insert (public form submissions)
GRANT INSERT ON public_saved_searches TO anon;
-- Grant service_role full access (n8n, crons)
GRANT ALL ON public_saved_searches TO service_role;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_pss_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pss_updated_at ON public_saved_searches;
CREATE TRIGGER trg_pss_updated_at
  BEFORE UPDATE ON public_saved_searches
  FOR EACH ROW EXECUTE FUNCTION update_pss_updated_at();

COMMENT ON TABLE public_saved_searches IS
  'Anonymous buyer search subscriptions. '
  'n8n queries via: GET /api/alerts?mode=active (service_role). '
  'Payload for n8n match: { email, zona, tipo, preco_min, preco_max, quartos_min, piscina, purpose, keyword }';
