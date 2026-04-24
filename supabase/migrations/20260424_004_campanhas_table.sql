-- =============================================================================
-- Agency Group · Migration 20260424_004
-- Campanhas (campaigns) table — replaces hardcoded mock data in crmStore
-- =============================================================================

CREATE TABLE IF NOT EXISTS campanhas (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name             TEXT        NOT NULL,
  type             TEXT        NOT NULL CHECK (type IN ('email','whatsapp','sms','push','mixed')),
  status           TEXT        NOT NULL DEFAULT 'draft'
                               CHECK (status IN ('draft','scheduled','sending','sent','paused','cancelled','failed')),

  -- Content
  subject          TEXT,
  html             TEXT,

  -- Recipients
  recipient_list   TEXT[]      NOT NULL DEFAULT '{}',
  recipient_count  INT         NOT NULL DEFAULT 0,

  -- Delivery stats
  sent_count       INT         NOT NULL DEFAULT 0,
  delivered_count  INT         NOT NULL DEFAULT 0,
  opened_count     INT         NOT NULL DEFAULT 0,
  clicked_count    INT         NOT NULL DEFAULT 0,

  -- Scheduling
  scheduled_at     TIMESTAMPTZ,
  sent_at          TIMESTAMPTZ,

  -- Metadata
  metadata         JSONB       NOT NULL DEFAULT '{}',
  created_by       TEXT        NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campanhas_status     ON campanhas(status);
CREATE INDEX IF NOT EXISTS idx_campanhas_type       ON campanhas(type);
CREATE INDEX IF NOT EXISTS idx_campanhas_created_by ON campanhas(created_by);
CREATE INDEX IF NOT EXISTS idx_campanhas_created_at ON campanhas(created_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_campanhas_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_campanhas_updated_at ON campanhas;
CREATE TRIGGER trg_campanhas_updated_at
  BEFORE UPDATE ON campanhas
  FOR EACH ROW EXECUTE FUNCTION update_campanhas_updated_at();

-- RLS
ALTER TABLE campanhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "campanhas_service_role"
  ON campanhas FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "campanhas_agent_read"
  ON campanhas FOR SELECT USING (true);

COMMENT ON TABLE campanhas IS
  'Email/SMS/WhatsApp/push campaign records. '
  'Replaces hardcoded mock campaigns in crmStore. '
  'Stats updated by /api/campanhas/send after each send.';
