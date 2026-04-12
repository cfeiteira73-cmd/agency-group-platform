-- =============================================================================
-- Agency Group — Deal Negotiation Fields + SLA + Risk Flags
-- Migration: 20260412_005
-- Wave 10+11: Execution Machine → Negotiation → CPCV → Escritura
-- =============================================================================

-- ── SLA Tracking ─────────────────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS sla_contacted_at    TIMESTAMPTZ,        -- when first real contact was made
  ADD COLUMN IF NOT EXISTS sla_breach          BOOLEAN DEFAULT FALSE; -- auto-computed by trigger

-- ── Deal / Negotiation Fields ─────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS offer_amount            NUMERIC,          -- First offer received (€)
  ADD COLUMN IF NOT EXISTS offer_date              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS counter_offer_amount    NUMERIC,          -- Our counter (€)
  ADD COLUMN IF NOT EXISTS counter_offer_date      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS negotiation_status      TEXT CHECK (negotiation_status IN (
    'idle','offer_received','counter_proposed','terms_agreed','blocked','withdrawn'
  )) DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS cpcv_target_date        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cpcv_signed_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deposit_received        NUMERIC,          -- Sinal (€)
  ADD COLUMN IF NOT EXISTS legal_status            TEXT,             -- free text: 'certidão pendente','sem ónus','hipoteca parcial'
  ADD COLUMN IF NOT EXISTS docs_pending            TEXT[],           -- list of missing docs
  ADD COLUMN IF NOT EXISTS escritura_target_date   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS escritura_done_at       TIMESTAMPTZ;

-- ── Deal Risk Control ─────────────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS deal_risk_level         TEXT CHECK (deal_risk_level IN ('verde','amarelo','vermelho')) DEFAULT 'verde',
  ADD COLUMN IF NOT EXISTS deal_risk_reason        TEXT,             -- free text: 'hipoteca por resolver','comprador silencioso'
  ADD COLUMN IF NOT EXISTS deal_owner              TEXT,             -- responsible advisor email
  ADD COLUMN IF NOT EXISTS deal_next_step          TEXT,             -- clear text: 'enviar minuta CPCV ao advogado'
  ADD COLUMN IF NOT EXISTS deal_next_step_date     TIMESTAMPTZ;      -- deadline for next step

-- Indexes for deal pipeline queries
CREATE INDEX IF NOT EXISTS idx_offmarket_leads_negotiation_status
  ON offmarket_leads (negotiation_status)
  WHERE negotiation_status NOT IN ('idle','withdrawn');

CREATE INDEX IF NOT EXISTS idx_offmarket_leads_cpcv
  ON offmarket_leads (cpcv_target_date)
  WHERE cpcv_signed_at IS NULL AND cpcv_target_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_offmarket_leads_escritura
  ON offmarket_leads (escritura_target_date)
  WHERE escritura_done_at IS NULL AND escritura_target_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_offmarket_leads_deal_risk
  ON offmarket_leads (deal_risk_level)
  WHERE deal_risk_level IN ('amarelo','vermelho');

-- ── SLA Breach Trigger ────────────────────────────────────────────────────────
-- Computes sla_breach based on: when first contact was made (or should have been)
-- Rules:
--   score >= 80 → must contact within 15 min
--   score 70-79 → must contact within 60 min
--   score 50-69 → must contact within 8 hours (same business day)
--   <50 → no SLA

CREATE OR REPLACE FUNCTION compute_sla_breach()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  sla_minutes INTEGER;
  elapsed_minutes FLOAT;
BEGIN
  -- Only compute SLA for scored leads
  IF NEW.score IS NULL THEN
    NEW.sla_breach := FALSE;
    RETURN NEW;
  END IF;

  -- Determine SLA window
  IF NEW.score >= 80 THEN sla_minutes := 15;
  ELSIF NEW.score >= 70 THEN sla_minutes := 60;
  ELSIF NEW.score >= 50 THEN sla_minutes := 480;  -- 8 hours
  ELSE
    NEW.sla_breach := FALSE;
    RETURN NEW;
  END IF;

  -- If already contacted, no breach
  IF NEW.sla_contacted_at IS NOT NULL THEN
    elapsed_minutes := EXTRACT(EPOCH FROM (NEW.sla_contacted_at - NEW.created_at)) / 60.0;
    NEW.sla_breach := elapsed_minutes > sla_minutes;
  ELSE
    -- Not yet contacted — check elapsed time since creation
    elapsed_minutes := EXTRACT(EPOCH FROM (NOW() - NEW.created_at)) / 60.0;
    NEW.sla_breach := (
      elapsed_minutes > sla_minutes
      AND NEW.status = 'new'
    );
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_offmarket_sla_breach ON offmarket_leads;
CREATE TRIGGER trg_offmarket_sla_breach
  BEFORE INSERT OR UPDATE ON offmarket_leads
  FOR EACH ROW EXECUTE FUNCTION compute_sla_breach();

-- ── Risk Flags View ───────────────────────────────────────────────────────────
-- Computable risk flags for portal display (read-only view, not stored)

CREATE OR REPLACE VIEW offmarket_risk_flags AS
SELECT
  id,
  nome,
  score,
  status,
  assigned_to,
  deal_risk_level,
  created_at,
  last_contact_at,
  next_followup_at,
  sla_breach,
  ARRAY_REMOVE(ARRAY[
    CASE WHEN sla_breach = TRUE THEN 'sla_breach' END,
    CASE WHEN score >= 70 AND sla_contacted_at IS NULL AND status = 'new'
         AND EXTRACT(EPOCH FROM (NOW() - created_at))/3600 > 2
         THEN 'high_score_no_action' END,
    CASE WHEN next_followup_at < NOW() AND status NOT IN ('closed_won','closed_lost','not_interested')
         THEN 'no_followup_set' END,
    CASE WHEN assigned_to IS NULL AND status NOT IN ('closed_won','closed_lost')
         THEN 'no_owner_assigned' END,
    CASE WHEN matched_to_buyers = TRUE AND status = 'new'
         AND EXTRACT(EPOCH FROM (NOW() - COALESCE(buyer_matched_at, created_at)))/3600 > 4
         THEN 'matched_not_contacted' END,
    CASE WHEN status IN ('contacted','interested') AND last_contact_at < NOW() - INTERVAL '14 days'
         THEN 'stale_hot_lead' END,
    CASE WHEN cpcv_target_date IS NOT NULL AND cpcv_signed_at IS NULL
         AND cpcv_target_date < NOW() + INTERVAL '7 days'
         THEN 'cpcv_deadline_soon' END,
    CASE WHEN escritura_target_date IS NOT NULL AND escritura_done_at IS NULL
         AND escritura_target_date < NOW() + INTERVAL '14 days'
         THEN 'escritura_deadline_soon' END,
    CASE WHEN deal_next_step_date IS NOT NULL AND deal_next_step_date < NOW()
         AND escritura_done_at IS NULL
         THEN 'next_step_overdue' END
  ], NULL) AS risk_flags
FROM offmarket_leads
WHERE status NOT IN ('closed_won','closed_lost');

COMMENT ON VIEW offmarket_risk_flags IS
  'Computed risk flags per lead. Query this view for the risk dashboard. Not persisted.';

-- ── Backfill sla_contacted_at for existing contacted leads ────────────────────
UPDATE offmarket_leads
SET sla_contacted_at = last_contact_at
WHERE last_contact_at IS NOT NULL
  AND sla_contacted_at IS NULL
  AND status NOT IN ('new');
