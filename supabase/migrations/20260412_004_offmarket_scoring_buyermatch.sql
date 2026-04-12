-- =============================================================================
-- Agency Group — Off-Market Scoring Enhancement + Buyer Matching
-- Migration: 20260412_004
-- FASE 6: AI Scoring fields (score_reason, score_attempts, last_score_at)
-- FASE 12: Buyer Matching fields
-- FASE 13: Pre-close flags
-- =============================================================================

-- ── FASE 6: Enhanced AI Scoring ──────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS score_reason       TEXT,          -- Human-readable AI scoring justification
  ADD COLUMN IF NOT EXISTS score_attempts     SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_score_at      TIMESTAMPTZ;

-- Index for re-score queue
CREATE INDEX IF NOT EXISTS idx_offmarket_leads_score_attempts
  ON offmarket_leads (score_attempts)
  WHERE score_status = 'pending_score' OR score_status = 'failed_score';

-- ── FASE 12: Buyer Matching ───────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS matched_buyers_count      SMALLINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS best_buyer_match_score    SMALLINT,         -- 0-100 best match quality
  ADD COLUMN IF NOT EXISTS buyer_match_notes         TEXT,             -- Top 3 matched buyer names/ids summary
  ADD COLUMN IF NOT EXISTS buyer_matched_at          TIMESTAMPTZ;

-- ── FASE 13: Pre-Close Flags ──────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS preclose_candidate        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS outreach_ready            BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS matched_to_buyers         BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS institutional_priority    BOOLEAN NOT NULL DEFAULT FALSE;

-- Indexes for pre-close pipeline queries
CREATE INDEX IF NOT EXISTS idx_offmarket_leads_preclose
  ON offmarket_leads (preclose_candidate)
  WHERE preclose_candidate = TRUE;

CREATE INDEX IF NOT EXISTS idx_offmarket_leads_outreach_ready
  ON offmarket_leads (outreach_ready)
  WHERE outreach_ready = TRUE AND status NOT IN ('closed_won','closed_lost');

-- Auto-flag outreach_ready when score >= 70 and contacto is not null
-- (applied at query time via trigger to avoid recomputing on every update)
CREATE OR REPLACE FUNCTION sync_offmarket_preclose_flags()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- outreach_ready: has score + has contact info
  NEW.outreach_ready := (
    NEW.score IS NOT NULL AND
    NEW.score >= 70 AND
    NEW.contacto IS NOT NULL AND
    NEW.status NOT IN ('closed_won','closed_lost','not_interested')
  );

  -- preclose_candidate: high score AND buyers matched
  NEW.preclose_candidate := (
    NEW.score IS NOT NULL AND
    NEW.score >= 70 AND
    NEW.matched_to_buyers = TRUE AND
    NEW.best_buyer_match_score IS NOT NULL AND
    NEW.best_buyer_match_score >= 60
  );

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_offmarket_preclose_flags ON offmarket_leads;
CREATE TRIGGER trg_offmarket_preclose_flags
  BEFORE INSERT OR UPDATE ON offmarket_leads
  FOR EACH ROW EXECUTE FUNCTION sync_offmarket_preclose_flags();

-- Backfill flags on existing rows
UPDATE offmarket_leads SET updated_at = NOW()
WHERE score IS NOT NULL;

-- ── Comment documentation ─────────────────────────────────────────────────────
COMMENT ON COLUMN offmarket_leads.score_reason IS
  'AI-generated justification: e.g. "Moradia T5 Cascais, proprietário com 3 herdeiros, urgência alta, zona Tier 1 — alta probabilidade de transação"';
COMMENT ON COLUMN offmarket_leads.preclose_candidate IS
  'TRUE when score>=70 AND matched_to_buyers=TRUE AND best_buyer_match_score>=60 — auto-set by trigger';
COMMENT ON COLUMN offmarket_leads.outreach_ready IS
  'TRUE when score>=70 AND contacto present AND not closed — auto-set by trigger';
COMMENT ON COLUMN offmarket_leads.institutional_priority IS
  'Manually flagged for institutional or portfolio sale — bypasses standard cadence';
