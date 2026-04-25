-- =============================================================================
-- Agency Group · Migration 20260425_001
-- RUN IN SUPABASE SQL EDITOR
-- Seller stage + agent_email on contacts
-- Depends on: 20260424_003_seller_fields.sql (must be run first)
-- =============================================================================

-- Add seller_stage (pipeline stage for sellers)
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS seller_stage TEXT
    CHECK (seller_stage IN (
      'prospecting','appraisal','mandate','listed',
      'under_offer','sold','withdrawn'
    ) OR seller_stage IS NULL);

-- Add agent_email for direct agent assignment (CRM kanban)
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS agent_email TEXT;

-- Index seller stage for kanban queries
CREATE INDEX IF NOT EXISTS idx_contacts_seller_stage
  ON contacts(seller_stage)
  WHERE seller_stage IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_agent_email
  ON contacts(agent_email)
  WHERE agent_email IS NOT NULL;

COMMENT ON COLUMN contacts.seller_stage IS 'Seller pipeline stage for kanban tracking';
COMMENT ON COLUMN contacts.agent_email  IS 'Assigned agent email (denormalised for fast CRM filter)';
