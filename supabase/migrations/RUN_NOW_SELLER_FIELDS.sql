-- =============================================================================
-- AGENCY GROUP — RUN THIS IN SUPABASE SQL EDITOR (Dashboard)
-- Combines: 20260424_003 + 20260425_001
-- Safe: all ALTER TABLE use IF NOT EXISTS
-- =============================================================================

-- ─── 1. Seller profile fields on contacts ────────────────────────────────────
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS is_seller           BOOLEAN       DEFAULT false,
  ADD COLUMN IF NOT EXISTS seller_property_ref TEXT,
  ADD COLUMN IF NOT EXISTS seller_asking_price BIGINT,
  ADD COLUMN IF NOT EXISTS seller_property_type TEXT,
  ADD COLUMN IF NOT EXISTS seller_zona          TEXT,
  ADD COLUMN IF NOT EXISTS seller_urgency       TEXT
    CHECK (seller_urgency IN ('flexible','3-6months','urgent') OR seller_urgency IS NULL),
  ADD COLUMN IF NOT EXISTS seller_stage         TEXT
    CHECK (seller_stage IN (
      'prospecting','appraisal','mandate','listed',
      'under_offer','sold','withdrawn'
    ) OR seller_stage IS NULL),
  ADD COLUMN IF NOT EXISTS seller_notes         TEXT,
  ADD COLUMN IF NOT EXISTS mandate_type         TEXT
    CHECK (mandate_type IN ('exclusive','non-exclusive','dual') OR mandate_type IS NULL),
  ADD COLUMN IF NOT EXISTS mandate_expiry       DATE,
  ADD COLUMN IF NOT EXISTS agent_email          TEXT;

-- ─── 2. Lead score persistence ───────────────────────────────────────────────
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS lead_score           INT           DEFAULT 0
    CHECK (lead_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS lead_score_breakdown JSONB         DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS lead_scored_at       TIMESTAMPTZ;

-- ─── 3. Role field (RBAC) ────────────────────────────────────────────────────
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'lead'
    CHECK (role IN ('lead','client','investor','vip','seller','agent') OR role IS NULL);

-- ─── 4. Timestamp field ──────────────────────────────────────────────────────
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ─── 5. Auto-update trigger ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_contacts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_contacts_updated_at ON contacts;
CREATE TRIGGER trg_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_contacts_updated_at();

-- ─── 6. Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_contacts_is_seller     ON contacts(is_seller)    WHERE is_seller = true;
CREATE INDEX IF NOT EXISTS idx_contacts_seller_stage  ON contacts(seller_stage) WHERE seller_stage IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_agent_email   ON contacts(agent_email)  WHERE agent_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_lead_score    ON contacts(lead_score DESC);

-- Done
SELECT 'Seller fields migration complete' AS status;
