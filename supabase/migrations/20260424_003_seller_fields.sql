-- =============================================================================
-- Agency Group · Migration 20260424_003
-- Seller fields on contacts + lead_score persistence fix
-- =============================================================================

-- ─── Seller profile fields ───────────────────────────────────────────────────
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS is_seller          BOOLEAN       DEFAULT false,
  ADD COLUMN IF NOT EXISTS seller_property_ref TEXT,
  ADD COLUMN IF NOT EXISTS seller_asking_price BIGINT,
  ADD COLUMN IF NOT EXISTS seller_property_type TEXT,
  ADD COLUMN IF NOT EXISTS seller_zona         TEXT,
  ADD COLUMN IF NOT EXISTS seller_urgency      TEXT          CHECK (seller_urgency IN ('flexible','3-6months','urgent') OR seller_urgency IS NULL),
  ADD COLUMN IF NOT EXISTS mandate_type        TEXT          CHECK (mandate_type IN ('exclusive','non-exclusive','dual') OR mandate_type IS NULL),
  ADD COLUMN IF NOT EXISTS mandate_expiry      DATE,
  ADD COLUMN IF NOT EXISTS seller_notes        TEXT;

-- ─── Lead score persistence (ensure columns exist) ───────────────────────────
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS lead_score           INT           DEFAULT 0 CHECK (lead_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS lead_score_breakdown JSONB         DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS lead_scored_at       TIMESTAMPTZ;

-- ─── Role field (RBAC) ───────────────────────────────────────────────────────
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS role               TEXT          DEFAULT 'lead'
                                              CHECK (role IN ('lead','client','investor','vip','seller','agent') OR role IS NULL);

-- ─── Updated_at field ────────────────────────────────────────────────────────
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS updated_at         TIMESTAMPTZ   DEFAULT NOW();

-- Auto-update updated_at on contacts
CREATE OR REPLACE FUNCTION update_contacts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_contacts_updated_at ON contacts;
CREATE TRIGGER trg_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_contacts_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contacts_is_seller    ON contacts(is_seller) WHERE is_seller = true;
CREATE INDEX IF NOT EXISTS idx_contacts_lead_score   ON contacts(lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_lead_scored  ON contacts(lead_scored_at);

COMMENT ON COLUMN contacts.is_seller IS 'True if contact is also a property seller (dual role: buyer+seller possible)';
COMMENT ON COLUMN contacts.lead_score IS 'AI lead score 0-100, computed by /api/automation/lead-score, persisted here';
