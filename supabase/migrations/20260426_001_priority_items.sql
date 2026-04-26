-- =============================================================================
-- Agency Group · Migration 20260426_001
-- Create priority_items table — Pipeline Predictability Engine
-- Safe: IF NOT EXISTS throughout
-- =============================================================================

CREATE TABLE IF NOT EXISTS priority_items (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type       TEXT          NOT NULL
    CHECK (entity_type IN ('contact','deal','match','deal_pack','property','seller')),
  entity_id         TEXT          NOT NULL,
  priority_score    SMALLINT      NOT NULL DEFAULT 50
    CHECK (priority_score BETWEEN 0 AND 100),
  reason            TEXT          NOT NULL,
  next_best_action  TEXT,
  deadline          TIMESTAMPTZ,
  owner_id          TEXT,                         -- agent email
  revenue_impact    NUMERIC,                      -- estimated EUR impact
  status            TEXT          NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','in_progress','resolved','dismissed')),
  source            TEXT          DEFAULT 'engine' -- 'engine' | 'manual' | 'n8n'
    CHECK (source IN ('engine','manual','n8n')),
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  resolved_at       TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_priority_items_open
  ON priority_items(priority_score DESC, deadline ASC)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_priority_items_entity
  ON priority_items(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_priority_items_owner
  ON priority_items(owner_id)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_priority_items_deadline
  ON priority_items(deadline)
  WHERE deadline IS NOT NULL AND status = 'open';

-- ── Auto updated_at trigger ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_priority_items_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_priority_items_updated_at ON priority_items;
CREATE TRIGGER trg_priority_items_updated_at
  BEFORE UPDATE ON priority_items
  FOR EACH ROW EXECUTE FUNCTION update_priority_items_updated_at();

-- Done
SELECT 'priority_items table created' AS status;
