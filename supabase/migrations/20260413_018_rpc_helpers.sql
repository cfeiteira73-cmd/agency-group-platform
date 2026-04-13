-- =============================================================================
-- Agency Group — RPC Helper Functions
-- Migration: 20260413_018_rpc_helpers
--
-- ADDS:
--   increment_alert_count(lead_ids uuid[]) — safe bulk increment for alert_count
-- =============================================================================

CREATE OR REPLACE FUNCTION increment_alert_count(lead_ids uuid[])
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE offmarket_leads
  SET alert_count = COALESCE(alert_count, 0) + 1
  WHERE id = ANY(lead_ids);
$$;

COMMENT ON FUNCTION increment_alert_count(uuid[]) IS
  'Safe bulk increment of alert_count. Called by alerts/push after firing alerts.
   Avoids using rpc() inside update() which silently fails.';

SELECT 'Migration 018 complete — RPC helpers' AS status;
