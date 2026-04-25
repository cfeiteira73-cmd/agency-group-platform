-- =============================================================================
-- Agency Group · Migration 20260425_003
-- Add Decision Engine fields to matches table
-- Safe: all ALTER TABLE use IF NOT EXISTS
-- =============================================================================

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS next_best_action    TEXT,
  ADD COLUMN IF NOT EXISTS match_weaknesses    TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS priority_level      TEXT
    CHECK (priority_level IN ('high', 'medium', 'low') OR priority_level IS NULL),
  ADD COLUMN IF NOT EXISTS next_action_deadline TIMESTAMPTZ;

-- Index for priority queue (agents see high-priority first)
CREATE INDEX IF NOT EXISTS idx_matches_priority ON matches(priority_level, next_action_deadline)
  WHERE priority_level IS NOT NULL;

-- Done
SELECT 'Decision engine fields added to matches' AS status;
