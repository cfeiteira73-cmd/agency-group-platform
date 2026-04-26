-- =============================================================================
-- Agency Group · Migration 20260426_002
-- Add revenue tracking fields to deals table
-- Safe: all ADD COLUMN IF NOT EXISTS
-- =============================================================================

-- ── Revenue fields ────────────────────────────────────────────────────────────
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS expected_fee     NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS realized_fee     NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS fee_type         TEXT DEFAULT 'percentage'
    CHECK (fee_type IN ('percentage','flat','tiered','hybrid') OR fee_type IS NULL),
  ADD COLUMN IF NOT EXISTS partner_id       UUID
    REFERENCES institutional_partners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS partner_fee_pct  NUMERIC(5,4) DEFAULT 0
    CHECK (partner_fee_pct BETWEEN 0 AND 1),
  ADD COLUMN IF NOT EXISTS zone             TEXT;  -- denormalized from property for fast analytics

-- ── Auto-compute expected_fee when deal_value or commission_rate changes ──────
CREATE OR REPLACE FUNCTION sync_deal_expected_fee()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- expected_fee = deal_value * commission_rate (if not manually overridden)
  IF NEW.expected_fee IS NULL AND NEW.deal_value IS NOT NULL AND NEW.commission_rate IS NOT NULL THEN
    NEW.expected_fee := ROUND((NEW.deal_value * NEW.commission_rate)::NUMERIC, 2);
  END IF;
  -- realized_fee defaults to gci_net when deal closes (escritura)
  IF NEW.realized_fee IS NULL AND NEW.stage IN ('escritura','post_sale') AND NEW.gci_net IS NOT NULL THEN
    NEW.realized_fee := NEW.gci_net;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deals_fee_sync ON deals;
CREATE TRIGGER trg_deals_fee_sync
  BEFORE INSERT OR UPDATE OF deal_value, commission_rate, stage, gci_net
  ON deals
  FOR EACH ROW EXECUTE FUNCTION sync_deal_expected_fee();

-- ── Indexes for analytics queries ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_deals_partner_id ON deals(partner_id)
  WHERE partner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_zone ON deals(zone)
  WHERE zone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_source_stage ON deals(source, stage)
  WHERE source IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_realized_fee ON deals(realized_fee DESC)
  WHERE realized_fee IS NOT NULL;

-- Done
SELECT 'deals revenue fields added' AS status;
