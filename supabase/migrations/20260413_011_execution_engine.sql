-- =============================================================================
-- Agency Group — Execution Engine
-- Migration: 20260413_011_execution_engine
-- FASE 18: campos operacionais para forçar execução
--
-- ADICIONA (5 colunas):
--   first_contact_at          — quando foi feito o primeiro contacto real
--   last_contact_attempt_at   — última tentativa de contacto (mesmo sem sucesso)
--   execution_blocker_reason  — razão principal que bloqueia execução
--   data_completeness_score   — qualidade dos dados (0-100)
--   price_intel_blocked       — sem area_m2, price-intel não pode correr
-- =============================================================================

-- ── Contact tracking ─────────────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS first_contact_at TIMESTAMPTZ;

COMMENT ON COLUMN offmarket_leads.first_contact_at IS
  'Timestamp do primeiro contacto real com o proprietário. Usado para medir SLA de resposta.
   Diferente de sla_contacted_at (que é o contacto de qualificação). Set manualmente ou por automação.';

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS last_contact_attempt_at TIMESTAMPTZ;

COMMENT ON COLUMN offmarket_leads.last_contact_attempt_at IS
  'Última tentativa de contacto, mesmo sem sucesso (sem atender, sem resposta).
   Usado para medir persistência e evitar leads esquecidas.';

-- ── Execution blocker ─────────────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS execution_blocker_reason TEXT
    CHECK (execution_blocker_reason IS NULL OR execution_blocker_reason IN (
      'no_contact',
      'no_price_intel',
      'no_buyer',
      'sla_breach',
      'insufficient_data',
      'test_lead',
      'ready_to_attack'
    ));

COMMENT ON COLUMN offmarket_leads.execution_blocker_reason IS
  'Razão principal que bloqueia execução comercial.
   Hierarquia: no_contact > no_price_intel > no_buyer > sla_breach > insufficient_data > ready_to_attack.
   Set by /api/offmarket-leads/[id]/deal-eval.';

-- ── Data completeness ────────────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS data_completeness_score SMALLINT
    CHECK (data_completeness_score IS NULL OR (data_completeness_score BETWEEN 0 AND 100));

COMMENT ON COLUMN offmarket_leads.data_completeness_score IS
  '0-100. Qualidade dos dados para execução: contacto(30) + area_m2(20) + price_intel(20)
   + buyer_match(15) + source_quality(15). Score < 60 = "DADOS INSUFICIENTES".
   Set by /api/offmarket-leads/[id]/deal-eval.';

-- ── Price intel blocked ───────────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS price_intel_blocked BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN offmarket_leads.price_intel_blocked IS
  'TRUE quando area_m2 é NULL e price-intel não pode correr (falta dimensão para calcular €/m²).
   Set by /api/offmarket-leads/[id]/deal-eval.';

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_offmarket_leads_execution_blocker
  ON offmarket_leads (execution_blocker_reason)
  WHERE execution_blocker_reason IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_offmarket_leads_data_completeness
  ON offmarket_leads (data_completeness_score DESC NULLS LAST)
  WHERE data_completeness_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_offmarket_leads_first_contact
  ON offmarket_leads (first_contact_at)
  WHERE first_contact_at IS NOT NULL;

-- ── Test lead cleanup ─────────────────────────────────────────────────────────
-- Mark obvious test leads as not_interested so they don't pollute metrics

UPDATE offmarket_leads
SET
  status = 'not_interested',
  execution_blocker_reason = 'test_lead'
WHERE
  status NOT IN ('closed_won', 'closed_lost', 'not_interested')
  AND (
    nome ILIKE '%test%'
    OR nome ILIKE '%e2e%'
    OR nome ILIKE '%direct%'
    OR nome ILIKE '%Direct POST%'
    OR nome ILIKE '%Direct Portal%'
  );

SELECT 'Migration 011 complete — Execution Engine' AS status,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'offmarket_leads'
     AND column_name IN (
       'first_contact_at','last_contact_attempt_at',
       'execution_blocker_reason','data_completeness_score','price_intel_blocked'
     )
  ) AS new_columns_added;
