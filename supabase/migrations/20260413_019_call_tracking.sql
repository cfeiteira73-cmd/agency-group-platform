-- =============================================================================
-- Agency Group — Call Tracking Engine
-- Migration: 20260413_019_call_tracking
--
-- ADICIONA:
--   last_call_at             — última chamada feita
--   last_whatsapp_at         — último WhatsApp enviado
--   first_contact_at         — primeiro contacto real (muda status)
--   first_meeting_at         — primeira visita confirmada
--   contact_attempts_count   — nº total de tentativas de contacto
--   last_action_type         — call / whatsapp / email / visit / proposal
--   call_done_today          — flag reset diário (cron 00:01)
--   calls_today_count        — chamadas feitas hoje
--   visits_this_week         — visitas marcadas esta semana
--   proposal_sent_at         — proposta enviada
--   proposal_amount          — valor da proposta
-- =============================================================================

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS last_call_at TIMESTAMPTZ;
COMMENT ON COLUMN offmarket_leads.last_call_at IS
  'Última chamada feita para este lead. Actualizado via /api/offmarket-leads/[id]/log-action.';

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS last_whatsapp_at TIMESTAMPTZ;
COMMENT ON COLUMN offmarket_leads.last_whatsapp_at IS
  'Último WhatsApp enviado. Actualizado via log-action.';

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS first_contact_at TIMESTAMPTZ;
COMMENT ON COLUMN offmarket_leads.first_contact_at IS
  'Primeira vez que houve contacto real confirmado (não tentativa). Trigger: muda status → in_contact.';

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS first_meeting_at TIMESTAMPTZ;
COMMENT ON COLUMN offmarket_leads.first_meeting_at IS
  'Data/hora da primeira visita confirmada. Trigger: deal_readiness_score sobe +15pts.';

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS contact_attempts_count SMALLINT DEFAULT 0;
COMMENT ON COLUMN offmarket_leads.contact_attempts_count IS
  'Total de tentativas de contacto (chamadas + WA). Incrementado via log-action.';

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS last_action_type TEXT;
COMMENT ON COLUMN offmarket_leads.last_action_type IS
  'Tipo do último acção: call / whatsapp / email / visit / proposal / cpcv_push.';

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS call_done_today BOOLEAN DEFAULT FALSE;
COMMENT ON COLUMN offmarket_leads.call_done_today IS
  'TRUE se foi feita chamada hoje. Reset diário via cron 00:01.
   Usado para discipline tracking: ≥10 chamadas/dia = OK.';

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS proposal_sent_at TIMESTAMPTZ;
COMMENT ON COLUMN offmarket_leads.proposal_sent_at IS
  'Data em que foi enviada a proposta ao proprietário.';

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS proposal_amount BIGINT;
COMMENT ON COLUMN offmarket_leads.proposal_amount IS
  'Valor da proposta enviada em €.';

-- ── Agent-level daily discipline tracking ─────────────────────────────────────
-- Tabela separada para não poluir offmarket_leads

CREATE TABLE IF NOT EXISTS agent_daily_discipline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_email TEXT NOT NULL,
  discipline_date DATE NOT NULL DEFAULT CURRENT_DATE,
  calls_made SMALLINT DEFAULT 0,
  visits_booked SMALLINT DEFAULT 0,
  proposals_sent SMALLINT DEFAULT 0,
  cpcv_pushed SMALLINT DEFAULT 0,
  human_failure_triggered BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (agent_email, discipline_date)
);

COMMENT ON TABLE agent_daily_discipline IS
  'Disciplina diária por agente: chamadas, visitas, propostas.
   Regra: ≥10 chamadas + ≥3 visitas marcadas. Se não → human_failure_triggered = TRUE.
   Cron 23:55 verifica e actualiza human_failure_flag em offmarket_leads.';

-- ── Trigger: auto-update first_contact_at and status ─────────────────────────

CREATE OR REPLACE FUNCTION fn_track_contact_action()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Se foi feita primeira chamada/whatsapp e ainda não há first_contact_at
  IF (NEW.last_call_at IS NOT NULL OR NEW.last_whatsapp_at IS NOT NULL)
     AND OLD.first_contact_at IS NULL
     AND NEW.first_contact_at IS NULL THEN
    NEW.first_contact_at := COALESCE(NEW.last_call_at, NEW.last_whatsapp_at);
  END IF;

  -- Se primeira visita foi marcada: bump deal_readiness_score +15
  IF NEW.first_meeting_at IS NOT NULL AND OLD.first_meeting_at IS NULL THEN
    NEW.deal_readiness_score := LEAST(100, COALESCE(OLD.deal_readiness_score, 0) + 15);
    NEW.status := 'visit_scheduled';
  END IF;

  -- Se proposta enviada: bump deal_readiness_score +20
  IF NEW.proposal_sent_at IS NOT NULL AND OLD.proposal_sent_at IS NULL THEN
    NEW.deal_readiness_score := LEAST(100, COALESCE(NEW.deal_readiness_score, OLD.deal_readiness_score, 0) + 20);
    NEW.status := 'proposal_sent';
    NEW.negotiation_status := 'offer_received';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_contact_action ON offmarket_leads;
CREATE TRIGGER trg_track_contact_action
  BEFORE UPDATE OF last_call_at, last_whatsapp_at, first_meeting_at, proposal_sent_at
  ON offmarket_leads
  FOR EACH ROW EXECUTE FUNCTION fn_track_contact_action();

-- ── RPC: reset call_done_today (cron 00:01) ───────────────────────────────────

CREATE OR REPLACE FUNCTION reset_call_done_today()
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE offmarket_leads
  SET call_done_today = FALSE
  WHERE call_done_today = TRUE;
$$;

COMMENT ON FUNCTION reset_call_done_today() IS
  'Reset diário dos flags call_done_today. Chamar via cron às 00:01.';

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_offmarket_first_contact
  ON offmarket_leads (first_contact_at DESC NULLS LAST)
  WHERE first_contact_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_offmarket_first_meeting
  ON offmarket_leads (first_meeting_at DESC NULLS LAST)
  WHERE first_meeting_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_offmarket_last_call
  ON offmarket_leads (last_call_at DESC NULLS LAST)
  WHERE last_call_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_offmarket_proposal_sent
  ON offmarket_leads (proposal_sent_at DESC NULLS LAST)
  WHERE proposal_sent_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_discipline
  ON agent_daily_discipline (agent_email, discipline_date DESC);

SELECT 'Migration 019 complete — Call Tracking Engine' AS status;
