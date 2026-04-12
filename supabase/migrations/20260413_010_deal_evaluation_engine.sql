-- =============================================================================
-- Agency Group — Deal Evaluation Engine
-- Migration: 20260413_010_deal_evaluation_engine
-- FASE 16: 8-layer deal scoring model
--
-- AUDITORIA — NÃO duplica:
--   score (001), score_breakdown (001/003), score_reason (004)
--   deal_priority_score (007), attack_recommendation (007), buyer_triad_notes (007)
--   estimated_fair_value (009), gross_discount_pct (009), comp_confidence_score (009)
--   price_opportunity_score (009), price_reason (009)
--
-- ADICIONA (18 colunas novas):
--   adjusted_discount_score  — desconto bruto ajustado pela confiança (0-100)
--   liquidity_score          — liquidez real do ativo (0-100)
--   liquidity_reason         — narrativa da liquidez
--   execution_probability    — fechabilidade do deal (0-100)
--   execution_reason         — narrativa da execução
--   best_buyer_execution_score — buyer primário × active_status (0-100)
--   buyer_execution_reason   — narrativa do buyer
--   upside_score             — potencial de valorização bruto (0-100)
--   friction_penalty         — penalização por fricção e risco (0-50)
--   risk_adjusted_upside_score — upside líquido de fricção (0-100)
--   upside_reason            — narrativa do upside
--   asset_quality_score      — qualidade intrínseca do ativo (0-100)
--   source_quality_score     — fiabilidade da origem (0-100)
--   deal_evaluation_score    — composite elite: 8 camadas (0-100)
--   deal_evaluation_reason   — narrativa completa
--   master_attack_rank       — rank final de ataque (0-100)
--   master_attack_reason     — narrativa do rank
--   deal_evaluation_updated_at — timestamp da última avaliação
-- =============================================================================

-- ── Desconto ajustado pela confiança ────────────────────────────────────────
ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS adjusted_discount_score SMALLINT
    CHECK (adjusted_discount_score IS NULL OR (adjusted_discount_score BETWEEN 0 AND 100));

-- ── Liquidez real ────────────────────────────────────────────────────────────
ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS liquidity_score SMALLINT
    CHECK (liquidity_score IS NULL OR (liquidity_score BETWEEN 0 AND 100));

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS liquidity_reason TEXT;

-- ── Execution probability ────────────────────────────────────────────────────
ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS execution_probability SMALLINT
    CHECK (execution_probability IS NULL OR (execution_probability BETWEEN 0 AND 100));

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS execution_reason TEXT;

-- ── Buyer execution score ────────────────────────────────────────────────────
ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS best_buyer_execution_score SMALLINT
    CHECK (best_buyer_execution_score IS NULL OR (best_buyer_execution_score BETWEEN 0 AND 100));

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS buyer_execution_reason TEXT;

-- ── Upside + Friction + Risk-adjusted upside ─────────────────────────────────
ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS upside_score SMALLINT
    CHECK (upside_score IS NULL OR (upside_score BETWEEN 0 AND 100));

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS friction_penalty SMALLINT
    CHECK (friction_penalty IS NULL OR (friction_penalty BETWEEN 0 AND 50));

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS risk_adjusted_upside_score SMALLINT
    CHECK (risk_adjusted_upside_score IS NULL OR (risk_adjusted_upside_score BETWEEN 0 AND 100));

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS upside_reason TEXT;

-- ── Asset quality ────────────────────────────────────────────────────────────
ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS asset_quality_score SMALLINT
    CHECK (asset_quality_score IS NULL OR (asset_quality_score BETWEEN 0 AND 100));

-- ── Source quality ────────────────────────────────────────────────────────────
ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS source_quality_score SMALLINT
    CHECK (source_quality_score IS NULL OR (source_quality_score BETWEEN 0 AND 100));

-- ── Deal Evaluation composite ─────────────────────────────────────────────────
ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS deal_evaluation_score SMALLINT
    CHECK (deal_evaluation_score IS NULL OR (deal_evaluation_score BETWEEN 0 AND 100));

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS deal_evaluation_reason TEXT;

-- ── Master Attack Rank ───────────────────────────────────────────────────────
ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS master_attack_rank SMALLINT
    CHECK (master_attack_rank IS NULL OR (master_attack_rank BETWEEN 0 AND 100));

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS master_attack_reason TEXT;

-- ── Timestamp ────────────────────────────────────────────────────────────────
ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS deal_evaluation_updated_at TIMESTAMPTZ;

-- ── Indexes — sorting by rank / eval score / execution ───────────────────────

CREATE INDEX IF NOT EXISTS idx_offmarket_leads_master_attack_rank
  ON offmarket_leads (master_attack_rank DESC NULLS LAST)
  WHERE master_attack_rank IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_offmarket_leads_deal_eval_score
  ON offmarket_leads (deal_evaluation_score DESC NULLS LAST)
  WHERE deal_evaluation_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_offmarket_leads_execution_prob
  ON offmarket_leads (execution_probability DESC NULLS LAST)
  WHERE execution_probability IS NOT NULL;

-- ── Comments ─────────────────────────────────────────────────────────────────

COMMENT ON COLUMN offmarket_leads.adjusted_discount_score IS
  '0-100. Desconto bruto (gross_discount_pct) multiplicado pela confiança da comparação (comp_confidence_score/100) × 2.
   Evita usar headline de desconto sem validação. Set by /api/offmarket-leads/[id]/deal-eval.';

COMMENT ON COLUMN offmarket_leads.liquidity_score IS
  '0-100. Liquidez real do ativo: zona (0-30) + tipo (0-25) + ticket (0-20) + buyer pool (0-25).
   Mede capacidade real de saída, não apenas localização. Set by /api/.../deal-eval.';

COMMENT ON COLUMN offmarket_leads.execution_probability IS
  '0-100. Probabilidade de fecho real: motivação owner (0-20) + urgência (0-20) + contacto (0-15)
   + preclose (0-15) + price realism (0-15) + buyer depth (0-15). Set by /api/.../deal-eval.';

COMMENT ON COLUMN offmarket_leads.best_buyer_execution_score IS
  '0-100. buyer_score do comprador primário × multiplicador de active_status
   (active=1.0, dormant=0.70, inactive=0.40). Não basta ter match — é preciso quem fecha.';

COMMENT ON COLUMN offmarket_leads.upside_score IS
  '0-100. Potencial bruto de valorização: tipo activo (0-35) + zona (0-25) + desconto (0-25) + tamanho (0-15).';

COMMENT ON COLUMN offmarket_leads.friction_penalty IS
  '0-50. Penalização por fricção operacional e risco: sem contacto (+10), risco vermelho (+15),
   confiança baixa (+8), sem buyers (+10), preço acima mercado (+12), docs pendentes (+5), bloqueado (+7-12).';

COMMENT ON COLUMN offmarket_leads.risk_adjusted_upside_score IS
  '0-100. upside_score - friction_penalty (floored at 0). Upside real líquido de todas as fricções.';

COMMENT ON COLUMN offmarket_leads.asset_quality_score IS
  '0-100. Qualidade intrínseca: tipo (0-40) + zona (0-30) + tamanho (0-20) + confiança nos dados (0-10).';

COMMENT ON COLUMN offmarket_leads.source_quality_score IS
  '0-100. Fiabilidade da fonte: referral=90, banco/leilão=85, linkedin=80, casafari=75,
   idealista=65, google_maps=60, olx=48, manual=42, desconhecido=28.';

COMMENT ON COLUMN offmarket_leads.deal_evaluation_score IS
  '0-100. Score elite composto: adjusted_discount(25%) + liquidity(15%) + execution_prob(20%)
   + buyer_execution(20%) + risk_adj_upside(10%) + asset_quality(5%) + source_quality(5%).
   Não substitui o score off-market — é a camada de decisão elite sobre ele.';

COMMENT ON COLUMN offmarket_leads.master_attack_rank IS
  '0-100. Rank final de ataque: deal_evaluation_score(50%) + deal_priority_score(30%) + execution_probability(20%).
   Combina avaliação qualitativa + matching de compradores + fechabilidade.
   Usado para ordenar execution queue e destacar P0/P1.';

SELECT 'Migration 010 complete — Deal Evaluation Engine' AS status,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'offmarket_leads'
     AND column_name IN (
       'adjusted_discount_score','liquidity_score','execution_probability',
       'best_buyer_execution_score','upside_score','friction_penalty',
       'risk_adjusted_upside_score','asset_quality_score','source_quality_score',
       'deal_evaluation_score','master_attack_rank','deal_evaluation_updated_at'
     )
  ) AS new_columns_added;
