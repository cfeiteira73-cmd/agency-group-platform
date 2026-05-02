-- =============================================================================
-- Agency Group — Intelligence Dominance Layer ROLLBACK
-- 20260502_003_rollback.sql
--
-- Safely reverses 20260502_003_intelligence_dominance.sql.
-- Run ONLY if rollback is explicitly required.
-- Preserves all data from 20260501_002 (scoring_feedback_events core columns).
-- =============================================================================

-- Drop views first (no data)
DROP VIEW IF EXISTS v_market_intelligence_current;
DROP VIEW IF EXISTS v_agent_performance_latest;

-- Drop new tables (all Phase 2-5 data will be lost — recomputable from source)
DROP TABLE IF EXISTS market_microstructure           CASCADE;
DROP TABLE IF EXISTS investor_intelligence           CASCADE;
DROP TABLE IF EXISTS distribution_events             CASCADE;
DROP TABLE IF EXISTS agent_performance_metrics       CASCADE;
DROP TABLE IF EXISTS calibration_recommendations     CASCADE;

-- Remove Phase 1a columns added to scoring_feedback_events
-- NOTE: Only removes columns added in 003 — original columns from 002 are preserved
ALTER TABLE scoring_feedback_events
  DROP COLUMN IF EXISTS avm_value_at_time,
  DROP COLUMN IF EXISTS asking_price,
  DROP COLUMN IF EXISTS close_status,
  DROP COLUMN IF EXISTS buyer_type,
  DROP COLUMN IF EXISTS negotiation_delta_pct;

-- Drop indexes added in 003
DROP INDEX IF EXISTS idx_sfe_close_status_date;
DROP INDEX IF EXISTS idx_sfe_agent_email;

-- Restore original record_scoring_feedback RPC (without new parameters)
CREATE OR REPLACE FUNCTION record_scoring_feedback(
  p_property_id    TEXT,
  p_score          INTEGER,
  p_grade          TEXT,
  p_breakdown      JSONB,
  p_contact_id     TEXT,
  p_deal_pack_id   UUID,
  p_agent_email    TEXT
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO scoring_feedback_events (
    property_id, opportunity_score, opportunity_grade,
    score_breakdown, was_surfaced_to, deal_pack_id, agent_email
  )
  VALUES (
    p_property_id, p_score, p_grade,
    p_breakdown, p_contact_id, p_deal_pack_id, p_agent_email
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

DO $$
BEGIN
  RAISE NOTICE '20260502_003_rollback.sql: Intelligence Dominance Layer rolled back successfully.';
  RAISE NOTICE 'Core scoring_feedback_events data (from 002) preserved.';
END $$;
