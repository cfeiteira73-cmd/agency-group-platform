-- =============================================================================
-- Agency Group — Discipline Engine
-- Migration: 20260413_014_discipline_engine
-- FASE 21: execution_discipline_score, close_window_score, deal_momentum_score,
--           human_failure_flag, time_waste_flag, realistic_cpcv_forecast_flag
--
-- ADICIONA (6 colunas):
--   execution_discipline_score — mede disciplina operacional do agente (0-100)
--   close_window_score         — janela de fecho óptima (0-100)
--   deal_momentum_score        — actividade recente + progressão (0-100)
--   human_failure_flag         — agente a falhar SLA críticos
--   time_waste_flag            — deal a consumir tempo sem ROI possível
--   realistic_cpcv_forecast_flag — conta para o forecast conservador real
-- =============================================================================

-- ── Execution Discipline Score ────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS execution_discipline_score SMALLINT
    CHECK (execution_discipline_score IS NULL OR (execution_discipline_score BETWEEN 0 AND 100));

COMMENT ON COLUMN offmarket_leads.execution_discipline_score IS
  '0-100. Mede disciplina do agente dentro de cada milestone:
   contacto<2h(25) + visita<24h após contacto(25)
   + follow-up<24h após visita(25) + proposta<48h após visita(25).
   Score alto = agente executa rápido. Score baixo = SLA sistematicamente falhados.
   Set by /api/offmarket-leads/[id]/deal-eval.';

-- ── Close Window Score ────────────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS close_window_score SMALLINT
    CHECK (close_window_score IS NULL OR (close_window_score BETWEEN 0 AND 100));

COMMENT ON COLUMN offmarket_leads.close_window_score IS
  '0-100. Janela de fecho óptima AGORA:
   visita recente <48h(25) + buyer HIGH pressure(25)
   + vendedor com pressão alta(25) + desconto >15%(25).
   Score ≥75 = FECHAR ESTA SEMANA ou perder janela.
   Set by /api/offmarket-leads/[id]/deal-eval.';

-- ── Deal Momentum Score ───────────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS deal_momentum_score SMALLINT
    CHECK (deal_momentum_score IS NULL OR (deal_momentum_score BETWEEN 0 AND 100));

COMMENT ON COLUMN offmarket_leads.deal_momentum_score IS
  '0-100. Momentum actual do deal (últimos 7 dias):
   contacto activo(20) + visita recente(20) + proposta activa(20)
   + negociação viva(20) + tentativas de contacto ≥2(20).
   Score cai se pipeline estagnado. Alertar se deal_momentum < 20 e score ≥70.
   Set by /api/offmarket-leads/[id]/deal-eval.';

-- ── Human Failure Flag ────────────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS human_failure_flag BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN offmarket_leads.human_failure_flag IS
  'TRUE quando o agente está a falhar SLAs críticos:
   SLA breach sem nenhum contacto tentado, OU
   score ≥70 sem visita após 72h, OU
   contacto feito mas sem follow-up em 48h.
   Diferente do deal_kill_flag: aqui o problema é o agente, não o lead.
   Set by /api/offmarket-leads/[id]/deal-eval.';

-- ── Time Waste Flag ───────────────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS time_waste_flag BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN offmarket_leads.time_waste_flag IS
  'TRUE quando o deal está a consumir atenção sem ROI possível:
   sem comprador matched + sem contacto + criado >72h + score <65, OU
   ≥4 tentativas de contacto sem resposta + sem buyer.
   Diferente do deal_kill: time_waste pode ser revertido se aparecer buyer ou contacto.
   Set by /api/offmarket-leads/[id]/deal-eval.';

-- ── Realistic CPCV Forecast Flag ─────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS realistic_cpcv_forecast_flag BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN offmarket_leads.realistic_cpcv_forecast_flag IS
  'TRUE quando o lead conta para o forecast de CPCV conservador (realista):
   visita feita (first_meeting_at NOT NULL)
   + buyer pressure HIGH
   + deal_readiness_score ≥60.
   Só estes leads entram no forecast €€ apresentado à direcção.
   Set by /api/offmarket-leads/[id]/deal-eval.';

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_offmarket_leads_discipline
  ON offmarket_leads (execution_discipline_score DESC NULLS LAST)
  WHERE execution_discipline_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_offmarket_leads_close_window
  ON offmarket_leads (close_window_score DESC NULLS LAST)
  WHERE close_window_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_offmarket_leads_human_failure
  ON offmarket_leads (human_failure_flag)
  WHERE human_failure_flag = TRUE;

CREATE INDEX IF NOT EXISTS idx_offmarket_leads_time_waste
  ON offmarket_leads (time_waste_flag)
  WHERE time_waste_flag = TRUE;

CREATE INDEX IF NOT EXISTS idx_offmarket_leads_realistic_cpcv
  ON offmarket_leads (realistic_cpcv_forecast_flag, price_ask DESC NULLS LAST)
  WHERE realistic_cpcv_forecast_flag = TRUE;

SELECT 'Migration 014 complete — Discipline Engine' AS status,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'offmarket_leads'
     AND column_name IN (
       'execution_discipline_score','close_window_score','deal_momentum_score',
       'human_failure_flag','time_waste_flag','realistic_cpcv_forecast_flag'
     )
  ) AS new_columns_added;
