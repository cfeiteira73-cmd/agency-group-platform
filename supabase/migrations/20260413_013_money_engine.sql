-- =============================================================================
-- Agency Group — Money Engine
-- Migration: 20260413_013_money_engine
-- FASE 20: money_priority_score, contact loop, kill flag, competition flag
--
-- ADICIONA (4 colunas):
--   money_priority_score   — €/tempo: prioridade real por receita + velocidade
--   last_attempt_channel   — canal da última tentativa de contacto
--   buyer_competition_flag — ≥2 buyers HIGH pressure activos
--   deal_kill_flag         — sinal de descarte automático
--
-- ACTUALIZA CHECK:
--   execution_blocker_reason — adiciona no_meeting, deal_kill, cpcv_trigger
-- =============================================================================

-- ── Money Priority Score ──────────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS money_priority_score SMALLINT
    CHECK (money_priority_score IS NULL OR (money_priority_score BETWEEN 0 AND 100));

COMMENT ON COLUMN offmarket_leads.money_priority_score IS
  '0-100. Prioridade por receita × velocidade:
   cpcv_probability(50%) + deal_velocity_score(20%) + buyer_pressure_score(20%) + ticket_size(10%).
   Ordena o Deal Desk por impacto financeiro real, não apenas por qualidade do activo.
   Set by /api/offmarket-leads/[id]/deal-eval.';

-- ── Contact Channel Loop ──────────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS last_attempt_channel TEXT
    CHECK (last_attempt_channel IS NULL OR last_attempt_channel IN
      ('call', 'whatsapp', 'email', 'linkedin', 'other'));

COMMENT ON COLUMN offmarket_leads.last_attempt_channel IS
  'Canal da última tentativa de contacto com o proprietário.
   Sequência recomendada: call → whatsapp → email → linkedin → loop.
   Set manualmente pelo agente ou por automação n8n.';

-- ── Buyer Competition Flag ────────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS buyer_competition_flag BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN offmarket_leads.buyer_competition_flag IS
  'TRUE quando existem ≥2 compradores com buyer_pressure_score ≥70 matched.
   Aciona táctica de urgência: "vários compradores activos interessados".
   Set by /api/offmarket-leads/[id]/deal-eval.';

-- ── Deal Kill Flag ────────────────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS deal_kill_flag BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN offmarket_leads.deal_kill_flag IS
  'TRUE quando o deal deve ser descartado: sem contacto >72h + score<70,
   OU sem buyers + score<60, OU price_intel impossível + score<60.
   Sinaliza leads de baixo ROI que bloqueiam a fila de execução.
   Set by /api/offmarket-leads/[id]/deal-eval.';

-- ── Expand execution_blocker_reason CHECK ────────────────────────────────────
-- Drop auto-generated constraint and recreate with new values

ALTER TABLE offmarket_leads
  DROP CONSTRAINT IF EXISTS offmarket_leads_execution_blocker_reason_check;

ALTER TABLE offmarket_leads
  ADD CONSTRAINT offmarket_leads_execution_blocker_reason_check
    CHECK (execution_blocker_reason IS NULL OR execution_blocker_reason IN (
      'no_contact',
      'no_price_intel',
      'no_buyer',
      'no_meeting',
      'sla_breach',
      'insufficient_data',
      'test_lead',
      'deal_kill',
      'cpcv_trigger',
      'ready_to_attack'
    ));

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_offmarket_leads_money_priority
  ON offmarket_leads (money_priority_score DESC NULLS LAST)
  WHERE money_priority_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_offmarket_leads_deal_kill
  ON offmarket_leads (deal_kill_flag)
  WHERE deal_kill_flag = TRUE;

CREATE INDEX IF NOT EXISTS idx_offmarket_leads_buyer_competition
  ON offmarket_leads (buyer_competition_flag)
  WHERE buyer_competition_flag = TRUE;

SELECT 'Migration 013 complete — Money Engine' AS status,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'offmarket_leads'
     AND column_name IN (
       'money_priority_score','last_attempt_channel',
       'buyer_competition_flag','deal_kill_flag'
     )
  ) AS new_columns_added;
