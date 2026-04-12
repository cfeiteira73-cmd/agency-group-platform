-- =============================================================================
-- Agency Group — Off-Market Leads: Add score_status column
-- Migration: 20260412_003_offmarket_score_status
-- Tracks scoring state lifecycle: pending_score → scored | failed_score
-- =============================================================================

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS score_status TEXT
    CHECK (score_status IN ('pending_score', 'scored', 'failed_score'))
    DEFAULT 'pending_score';

-- Index for scoring queue (pick up all pending leads)
CREATE INDEX IF NOT EXISTS idx_offmarket_leads_score_status
  ON offmarket_leads (score_status)
  WHERE score_status = 'pending_score';

-- Backfill: leads with a score are already scored
UPDATE offmarket_leads
  SET score_status = 'scored'
  WHERE score IS NOT NULL AND score_status = 'pending_score';
