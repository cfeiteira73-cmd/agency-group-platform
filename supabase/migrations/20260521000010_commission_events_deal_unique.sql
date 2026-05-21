-- =============================================================================
-- Prevent duplicate commission records for the same deal
-- =============================================================================
ALTER TABLE commission_events
  ADD CONSTRAINT IF NOT EXISTS commission_events_deal_id_unique UNIQUE (deal_id);
