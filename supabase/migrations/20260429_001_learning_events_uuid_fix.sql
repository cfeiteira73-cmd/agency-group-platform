-- =============================================================================
-- Agency Group · Migration 20260429_001
-- Fix learning_events: lead_id + deal_id INTEGER → TEXT (UUID-compatible)
-- Add event bus correlation columns: correlation_id, session_id, source_system
--
-- SAFE: ALTER TYPE using USING cast — no data loss
--       IF NOT EXISTS guards on all new columns
--       Non-blocking on empty or small tables
-- =============================================================================

-- ── Step 1: Change lead_id / deal_id from INTEGER to TEXT ─────────────────────
-- The contacts.id and deals.id are UUIDs. The old schema used INTEGER which
-- caused all UUID lead_ids to be NULL (NaN coercion). TEXT accepts both UUID
-- strings and legacy integer strings (backward compatible).

ALTER TABLE learning_events
  ALTER COLUMN lead_id TYPE TEXT USING CASE
    WHEN lead_id IS NULL THEN NULL
    ELSE lead_id::TEXT
  END;

ALTER TABLE learning_events
  ALTER COLUMN deal_id TYPE TEXT USING CASE
    WHEN deal_id IS NULL THEN NULL
    ELSE deal_id::TEXT
  END;

-- ── Step 2: Add event bus correlation fields (GAP 1 — Event Bus foundation) ───

-- Unique request flow ID — links all events triggered by one API call
ALTER TABLE learning_events
  ADD COLUMN IF NOT EXISTS correlation_id  UUID;

-- Agent/user session ID — links events across a working session
ALTER TABLE learning_events
  ADD COLUMN IF NOT EXISTS session_id      UUID;

-- Which system fired the event
ALTER TABLE learning_events
  ADD COLUMN IF NOT EXISTS source_system   TEXT DEFAULT 'api'
    CHECK (source_system IN ('api', 'n8n', 'cron', 'engine') OR source_system IS NULL);

-- ── Step 3: Indexes for event stream queries ──────────────────────────────────

-- Replay by correlation (all events in one request flow)
CREATE INDEX IF NOT EXISTS idx_learning_events_correlation
  ON learning_events(correlation_id)
  WHERE correlation_id IS NOT NULL;

-- Replay by session (all events in one agent session)
CREATE INDEX IF NOT EXISTS idx_learning_events_session
  ON learning_events(session_id)
  WHERE session_id IS NOT NULL;

-- Lookup by lead (now works with UUID strings)
CREATE INDEX IF NOT EXISTS idx_learning_events_lead_text
  ON learning_events(lead_id)
  WHERE lead_id IS NOT NULL;

-- Lookup by deal
CREATE INDEX IF NOT EXISTS idx_learning_events_deal_text
  ON learning_events(deal_id)
  WHERE deal_id IS NOT NULL;

-- Event type + time (learning loop queries)
CREATE INDEX IF NOT EXISTS idx_learning_events_type_time
  ON learning_events(event_type, created_at DESC);

-- Done
SELECT 'learning_events UUID fix + event bus columns added' AS status;
