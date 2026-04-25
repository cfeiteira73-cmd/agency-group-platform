-- =============================================================================
-- Agency Group · Migration 20260425_002
-- RUN IN SUPABASE SQL EDITOR (Dashboard)
-- Add rich content columns to deal_packs table
-- Safe: all ALTER TABLE use IF NOT EXISTS
-- =============================================================================

ALTER TABLE deal_packs
  ADD COLUMN IF NOT EXISTS investment_thesis    TEXT,
  ADD COLUMN IF NOT EXISTS market_summary       TEXT,
  ADD COLUMN IF NOT EXISTS highlights           JSONB  DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS financial_projections JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS opportunity_score    INT    CHECK (opportunity_score BETWEEN 0 AND 100 OR opportunity_score IS NULL),
  ADD COLUMN IF NOT EXISTS generated_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS view_count           INT    DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes                TEXT;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_deal_packs_lead_id     ON deal_packs(lead_id);
CREATE INDEX IF NOT EXISTS idx_deal_packs_property_id ON deal_packs(property_id);
CREATE INDEX IF NOT EXISTS idx_deal_packs_status      ON deal_packs(status);
CREATE INDEX IF NOT EXISTS idx_deal_packs_generated   ON deal_packs(generated_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_deal_packs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_deal_packs_updated_at ON deal_packs;
CREATE TRIGGER trg_deal_packs_updated_at
  BEFORE UPDATE ON deal_packs
  FOR EACH ROW EXECUTE FUNCTION update_deal_packs_updated_at();

-- Done
SELECT 'deal_packs full schema migration complete' AS status;
