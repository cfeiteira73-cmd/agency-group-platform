-- =============================================================================
-- Agency Group — Closing Engine
-- Migration: 20260413_012_closing_engine
-- FASE 19: velocidade, pressão e probabilidade de CPCV
--
-- ADICIONA (8 colunas):
--   first_meeting_at      — data da primeira visita/reunião
--   deal_velocity_score   — velocidade do pipeline (0-100)
--   buyer_pressure_score  — força do comprador para fechar (0-100)
--   buyer_pressure_class  — HIGH / MED / LOW
--   seller_pressure_reason — narrativa da pressão do vendedor
--   buyer_pressure_reason  — narrativa da pressão do comprador
--   deal_readiness_score  — prontidão para CPCV (0-100)
--   cpcv_probability      — probabilidade de CPCV (0-100)
--
-- NÃO duplica:
--   execution_probability (011) — fechabilidade operacional
--   best_buyer_execution_score (010) — execução do buyer primário
--   deal_evaluation_score (010) — qualidade do activo
--   master_attack_rank (010) — rank de ataque
-- =============================================================================

-- ── First meeting ─────────────────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS first_meeting_at TIMESTAMPTZ;

COMMENT ON COLUMN offmarket_leads.first_meeting_at IS
  'Data/hora da primeira visita ou reunião presencial/video com o proprietário.
   Set manualmente pelo agente ou por automação após visita registada.';

-- ── Deal Velocity ─────────────────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS deal_velocity_score SMALLINT
    CHECK (deal_velocity_score IS NULL OR (deal_velocity_score BETWEEN 0 AND 100));

COMMENT ON COLUMN offmarket_leads.deal_velocity_score IS
  '0-100. Velocidade de execução do pipeline:
   contacto <2h(+25) + visita <24h(+25) + proposta <48h(+25) + CPCV <7d(+25).
   Score alto = equipa a executar com velocidade máxima. Set by /api/.../deal-eval.';

-- ── Buyer Pressure ────────────────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS buyer_pressure_score SMALLINT
    CHECK (buyer_pressure_score IS NULL OR (buyer_pressure_score BETWEEN 0 AND 100));

COMMENT ON COLUMN offmarket_leads.buyer_pressure_score IS
  '0-100. Força do comprador primário para fechar:
   liquidez(30) + histórico_deals(20) + velocidade_fecho(20) + response_rate(15) + reliability(15).
   Ajustado pelo active_status (dormant×0.70, inactive×0.40). Set by /api/.../deal-eval.';

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS buyer_pressure_class TEXT
    CHECK (buyer_pressure_class IS NULL OR buyer_pressure_class IN ('HIGH', 'MED', 'LOW'));

COMMENT ON COLUMN offmarket_leads.buyer_pressure_class IS
  'HIGH(≥70) / MED(40-69) / LOW(<40). Classificação da pressão do comprador primário.';

-- ── Pressure reasons ─────────────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS seller_pressure_reason TEXT;

COMMENT ON COLUMN offmarket_leads.seller_pressure_reason IS
  'Narrativa da pressão do vendedor: tipo_proprietário + urgência + desconto + estado negociação.
   Usado em next_action e attack_reason para contextualizar a pressão real. Set by deal-eval.';

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS buyer_pressure_reason TEXT;

COMMENT ON COLUMN offmarket_leads.buyer_pressure_reason IS
  'Narrativa da pressão do comprador: liquidez + histórico + velocidade de resposta.
   Incluída no next_action para dar contexto ao agente. Set by deal-eval.';

-- ── Deal Readiness ────────────────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS deal_readiness_score SMALLINT
    CHECK (deal_readiness_score IS NULL OR (deal_readiness_score BETWEEN 0 AND 100));

COMMENT ON COLUMN offmarket_leads.deal_readiness_score IS
  '0-100. Prontidão para avançar para CPCV:
   contacto_directo(20) + visita_feita(20) + preclose_activo(20)
   + buyer_alinhado(20, match≥70) + preço_alinhado(20, discount≥0).
   Score ≥80 = READY TO CLOSE. Set by /api/.../deal-eval.';

-- ── CPCV Probability ──────────────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS cpcv_probability SMALLINT
    CHECK (cpcv_probability IS NULL OR (cpcv_probability BETWEEN 0 AND 100));

COMMENT ON COLUMN offmarket_leads.cpcv_probability IS
  '0-100. Probabilidade estimada de CPCV nos próximos 30 dias:
   deal_eval(30%) + buyer_pressure(25%) + deal_velocity(20%) + deal_readiness(25%).
   ≥70 = provável fecho. Set by /api/.../deal-eval.';

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_offmarket_leads_cpcv_probability
  ON offmarket_leads (cpcv_probability DESC NULLS LAST)
  WHERE cpcv_probability IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_offmarket_leads_deal_readiness
  ON offmarket_leads (deal_readiness_score DESC NULLS LAST)
  WHERE deal_readiness_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_offmarket_leads_buyer_pressure_class
  ON offmarket_leads (buyer_pressure_class)
  WHERE buyer_pressure_class IS NOT NULL;

SELECT 'Migration 012 complete — Closing Engine' AS status,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'offmarket_leads'
     AND column_name IN (
       'first_meeting_at','deal_velocity_score','buyer_pressure_score',
       'buyer_pressure_class','seller_pressure_reason','buyer_pressure_reason',
       'deal_readiness_score','cpcv_probability'
     )
  ) AS new_columns_added;
