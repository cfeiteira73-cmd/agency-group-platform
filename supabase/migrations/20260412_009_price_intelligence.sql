-- =============================================================================
-- Agency Group — Price Intelligence Engine
-- Migration: 20260412_009_price_intelligence
-- FASE 15: Market price references + price intelligence fields on offmarket_leads
--
-- AUDITORIA:
--   price_estimate quase sempre NULL → price_per_m2 sempre NULL
--   getPriceOpportunityScore() na API não tem input válido
--   Solução: tabela market_price_refs + price_ask_per_m2 + 5 campos derivados
--   NÃO altera: price_ask, price_estimate, price_per_m2, area_m2 (mantidos)
-- =============================================================================

-- ── STEP 1: Market Price References ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS market_price_refs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cidade              TEXT NOT NULL,          -- Normalised city/zone name
  tipo_ativo          TEXT NOT NULL,          -- 'moradia','apartamento','quinta','terreno','comercial','herdade','hotel'
  median_price_per_m2 NUMERIC NOT NULL,       -- €/m² median reference
  min_price_per_m2    NUMERIC,                -- €/m² bottom quartile
  max_price_per_m2    NUMERIC,                -- €/m² top quartile
  confidence_level    TEXT NOT NULL DEFAULT 'medium'
    CHECK (confidence_level IN ('high','medium','low')),
  source              TEXT NOT NULL DEFAULT 'market_data_2026',
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Composite index for fast lookup (cidade + tipo_ativo is the primary access pattern)
CREATE UNIQUE INDEX IF NOT EXISTS idx_market_price_refs_cidade_tipo
  ON market_price_refs (LOWER(cidade), LOWER(tipo_ativo));

CREATE INDEX IF NOT EXISTS idx_market_price_refs_cidade
  ON market_price_refs (LOWER(cidade));

-- RLS
ALTER TABLE market_price_refs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "market_price_refs_read_all" ON market_price_refs
  FOR SELECT TO authenticated, service_role USING (true);

CREATE POLICY "market_price_refs_write_service" ON market_price_refs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── STEP 2: Seed — Core Markets (valores defensáveis 2026) ───────────────────
-- Source: Idealista Price Index Q1 2026 + INE + Confidencial Imobiliário
-- Lisboa mediana global: €5.000/m² | Cascais: €4.713 | Algarve: €3.941
-- Porto: €3.643 | Madeira: €3.760 | Açores: €1.952

INSERT INTO market_price_refs
  (cidade, tipo_ativo, median_price_per_m2, min_price_per_m2, max_price_per_m2, confidence_level, source)
VALUES
  -- ── LISBOA ────────────────────────────────────────────────────────────────
  ('Lisboa',      'moradia',     5500,  3800,  9000,  'high',   'idealista_q1_2026'),
  ('Lisboa',      'apartamento', 4800,  3200,  8500,  'high',   'idealista_q1_2026'),
  ('Lisboa',      'comercial',   4200,  2500,  7000,  'medium', 'idealista_q1_2026'),
  ('Lisboa',      'terreno',     2800,  1500,  5000,  'medium', 'idealista_q1_2026'),
  ('Lisboa',      'prédio',      3800,  2500,  6500,  'medium', 'idealista_q1_2026'),
  -- ── CASCAIS / ESTORIL ─────────────────────────────────────────────────────
  ('Cascais',     'moradia',     5500,  3500,  12000, 'high',   'idealista_q1_2026'),
  ('Cascais',     'apartamento', 4200,  2800,  7500,  'high',   'idealista_q1_2026'),
  ('Cascais',     'terreno',     2500,  1200,  5500,  'medium', 'idealista_q1_2026'),
  ('Estoril',     'moradia',     5200,  3500,  9000,  'medium', 'idealista_q1_2026'),
  ('Estoril',     'apartamento', 4000,  2800,  6500,  'medium', 'idealista_q1_2026'),
  -- ── SINTRA ────────────────────────────────────────────────────────────────
  ('Sintra',      'moradia',     3200,  2000,  5500,  'high',   'idealista_q1_2026'),
  ('Sintra',      'apartamento', 2500,  1800,  4000,  'high',   'idealista_q1_2026'),
  ('Sintra',      'terreno',     1200,  600,   2500,  'medium', 'idealista_q1_2026'),
  -- ── OEIRAS ────────────────────────────────────────────────────────────────
  ('Oeiras',      'moradia',     4200,  2800,  6500,  'high',   'idealista_q1_2026'),
  ('Oeiras',      'apartamento', 3500,  2500,  5500,  'high',   'idealista_q1_2026'),
  -- ── PORTO ─────────────────────────────────────────────────────────────────
  ('Porto',       'moradia',     4200,  2500,  7000,  'high',   'idealista_q1_2026'),
  ('Porto',       'apartamento', 3200,  2200,  5500,  'high',   'idealista_q1_2026'),
  ('Porto',       'comercial',   3000,  1800,  5000,  'medium', 'idealista_q1_2026'),
  ('Porto',       'terreno',     1800,  800,   3500,  'medium', 'idealista_q1_2026'),
  -- ── ALGARVE PREMIUM (Quinta do Lago / Vale do Lobo / Vilamoura) ───────────
  ('Vilamoura',   'moradia',     7000,  4500,  15000, 'high',   'idealista_q1_2026'),
  ('Vilamoura',   'apartamento', 5500,  3500,  10000, 'high',   'idealista_q1_2026'),
  ('Quinta do Lago', 'moradia',  9000,  6000,  20000, 'high',   'idealista_q1_2026'),
  ('Quinta do Lago', 'apartamento', 6500, 4500, 14000,'high',   'idealista_q1_2026'),
  ('Vale do Lobo','moradia',     8500,  5500,  18000, 'high',   'idealista_q1_2026'),
  -- ── ALGARVE GERAL ─────────────────────────────────────────────────────────
  ('Algarve',     'moradia',     3800,  2500,  7500,  'medium', 'idealista_q1_2026'),
  ('Algarve',     'apartamento', 3000,  2000,  6000,  'medium', 'idealista_q1_2026'),
  ('Algarve',     'terreno',     1500,  800,   4000,  'medium', 'idealista_q1_2026'),
  ('Lagos',       'moradia',     4500,  3000,  8000,  'high',   'idealista_q1_2026'),
  ('Lagos',       'apartamento', 3800,  2500,  6500,  'high',   'idealista_q1_2026'),
  ('Albufeira',   'moradia',     4200,  2800,  7500,  'high',   'idealista_q1_2026'),
  ('Albufeira',   'apartamento', 3200,  2200,  5500,  'high',   'idealista_q1_2026'),
  -- ── COMPORTA / MELIDES (ultra-premium) ───────────────────────────────────
  ('Comporta',    'moradia',     8500,  5000,  20000, 'high',   'idealista_q1_2026'),
  ('Comporta',    'apartamento', 6000,  4000,  12000, 'medium', 'idealista_q1_2026'),
  ('Comporta',    'terreno',     3500,  2000,  8000,  'medium', 'idealista_q1_2026'),
  ('Melides',     'moradia',     7000,  4500,  15000, 'high',   'idealista_q1_2026'),
  -- ── ERICEIRA ──────────────────────────────────────────────────────────────
  ('Ericeira',    'moradia',     4000,  2500,  7000,  'medium', 'idealista_q1_2026'),
  ('Ericeira',    'apartamento', 3200,  2200,  5500,  'medium', 'idealista_q1_2026'),
  -- ── SETÚBAL / ARRÁBIDA ────────────────────────────────────────────────────
  ('Setúbal',     'moradia',     2200,  1500,  3800,  'medium', 'idealista_q1_2026'),
  ('Setúbal',     'apartamento', 1800,  1200,  3000,  'medium', 'idealista_q1_2026'),
  ('Azeitão',     'moradia',     2800,  1800,  5000,  'medium', 'idealista_q1_2026'),
  -- ── MADEIRA / FUNCHAL ─────────────────────────────────────────────────────
  ('Funchal',     'moradia',     4000,  2500,  7000,  'high',   'idealista_q1_2026'),
  ('Funchal',     'apartamento', 3200,  2200,  5500,  'high',   'idealista_q1_2026'),
  ('Madeira',     'moradia',     3800,  2200,  7000,  'medium', 'idealista_q1_2026'),
  ('Madeira',     'apartamento', 3000,  2000,  5000,  'medium', 'idealista_q1_2026'),
  -- ── AÇORES ────────────────────────────────────────────────────────────────
  ('Açores',      'moradia',     2200,  1400,  3800,  'medium', 'idealista_q1_2026'),
  ('Açores',      'apartamento', 1700,  1000,  2800,  'medium', 'idealista_q1_2026'),
  ('Ponta Delgada','moradia',    2500,  1600,  4000,  'medium', 'idealista_q1_2026'),
  ('Ponta Delgada','apartamento',2000,  1300,  3200,  'medium', 'idealista_q1_2026'),
  -- ── BRAGA ─────────────────────────────────────────────────────────────────
  ('Braga',       'moradia',     2500,  1600,  4200,  'high',   'idealista_q1_2026'),
  ('Braga',       'apartamento', 2000,  1400,  3200,  'high',   'idealista_q1_2026'),
  -- ── COIMBRA ───────────────────────────────────────────────────────────────
  ('Coimbra',     'moradia',     2000,  1400,  3500,  'medium', 'idealista_q1_2026'),
  ('Coimbra',     'apartamento', 1700,  1200,  2800,  'medium', 'idealista_q1_2026'),
  -- ── QUINTA RURAL / HERDADE (product-specific, nacional) ───────────────────
  ('Portugal',    'quinta',      1800,  800,   4500,  'low',    'market_estimate_2026'),
  ('Portugal',    'herdade',     1200,  500,   3000,  'low',    'market_estimate_2026'),
  ('Portugal',    'hotel',       3500,  1500,  8000,  'low',    'market_estimate_2026'),
  ('Portugal',    'terreno',     800,   300,   2500,  'low',    'market_estimate_2026'),
  ('Portugal',    'apartamento', 2800,  1200,  5500,  'low',    'market_estimate_2026'),
  ('Portugal',    'moradia',     3000,  1200,  7000,  'low',    'market_estimate_2026')
ON CONFLICT (LOWER(cidade), LOWER(tipo_ativo)) DO NOTHING;

-- ── STEP 3: Price intelligence columns on offmarket_leads ───────────────────

-- price_ask_per_m2: direct asking price per m2 (uses price_ask, not price_estimate)
-- CRITICAL: price_per_m2 (existing) uses price_ESTIMATE — keep it, add this as parallel column
ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS price_ask_per_m2 NUMERIC
    GENERATED ALWAYS AS (
      CASE WHEN area_m2 > 0 AND price_ask IS NOT NULL AND price_ask > 0
        THEN ROUND((price_ask / area_m2)::NUMERIC, 2)
        ELSE NULL
      END
    ) STORED;

-- Estimated fair value: area × market reference median (set by price-intel endpoint)
ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS estimated_fair_value NUMERIC;

-- Gross discount % vs estimated fair value
-- Positive = below market (opportunity), Negative = above market (requires negotiation)
ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS gross_discount_pct NUMERIC
    CHECK (gross_discount_pct IS NULL OR (gross_discount_pct >= -200 AND gross_discount_pct <= 100));

-- Confidence score 0-100: how reliable is the price comparison
ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS comp_confidence_score SMALLINT
    CHECK (comp_confidence_score IS NULL OR (comp_confidence_score >= 0 AND comp_confidence_score <= 100));

-- Price opportunity score 0-25 (replaces the dead price_opportunity component in score_breakdown)
ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS price_opportunity_score SMALLINT
    CHECK (price_opportunity_score IS NULL OR (price_opportunity_score >= 0 AND price_opportunity_score <= 25));

-- Human-readable price intelligence explanation
ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS price_reason TEXT;

-- When price intelligence was last computed
ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS price_intelligence_updated_at TIMESTAMPTZ;

-- ── STEP 4: Indexes ──────────────────────────────────────────────────────────

-- Fast queries: "leads com preço abaixo do mercado"
CREATE INDEX IF NOT EXISTS idx_offmarket_leads_discount
  ON offmarket_leads (gross_discount_pct DESC NULLS LAST)
  WHERE gross_discount_pct IS NOT NULL;

-- Fast queries: "leads com price intel calculado"
CREATE INDEX IF NOT EXISTS idx_offmarket_leads_price_intel_updated
  ON offmarket_leads (price_intelligence_updated_at DESC NULLS LAST)
  WHERE price_intelligence_updated_at IS NOT NULL;

-- Fast queries: "leads com price_ask_per_m2 disponível"
CREATE INDEX IF NOT EXISTS idx_offmarket_leads_price_ask_m2
  ON offmarket_leads (price_ask_per_m2 ASC NULLS LAST)
  WHERE price_ask_per_m2 IS NOT NULL;

-- ── STEP 5: Comments ─────────────────────────────────────────────────────────

COMMENT ON TABLE market_price_refs IS
  'Market price references (€/m²) per city + asset type. Updated quarterly. Used by price-intel API.';

COMMENT ON COLUMN offmarket_leads.price_ask_per_m2 IS
  'Asking price per m² (GENERATED from price_ask/area_m2). Uses price_ask, not price_estimate.
   Compare with price_per_m2 (uses price_estimate — often NULL for Apify leads).';

COMMENT ON COLUMN offmarket_leads.estimated_fair_value IS
  'Estimated fair value: area_m2 × market_price_refs.median_price_per_m2. Set by /api/price-intel.';

COMMENT ON COLUMN offmarket_leads.gross_discount_pct IS
  'Discount % vs estimated fair value. Positive=below market. Set by /api/price-intel.
   Formula: (fair_value - price_ask) / fair_value * 100';

COMMENT ON COLUMN offmarket_leads.comp_confidence_score IS
  '0-100 confidence in the price comparison. Factors: has area_m2, city match, type match.';

COMMENT ON COLUMN offmarket_leads.price_opportunity_score IS
  '0-25 price opportunity component. Replaces dead price_opportunity in score_breakdown
   when price-intel has run. Used by /api/offmarket-leads/score as elevated input.';

COMMENT ON COLUMN offmarket_leads.price_reason IS
  'Human-readable price intelligence summary. E.g.: "Preço 18% abaixo do mercado para moradia em Cascais. Confiança alta."';

-- ── STEP 6: Grant permissions ─────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE ON market_price_refs TO service_role;
GRANT SELECT ON market_price_refs TO authenticated;
