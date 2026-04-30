-- =============================================================================
-- Agency Group · Migration 20260429_003
-- Add increment_deal_pack_view_count() RPC
-- Atomic view_count increment for deal_packs table
-- Also: add metadata + ai_summary columns to deal_packs if not already present
--       (created by generate route but may be missing from initial migration)
--
-- SAFE: all ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE FUNCTION
-- =============================================================================

-- ── Ensure metadata + ai_summary columns exist ───────────────────────────────
-- The generate route writes to these columns; migration 20260424_001 may not
-- have included them in all environments.

ALTER TABLE deal_packs
  ADD COLUMN IF NOT EXISTS metadata    JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_summary  TEXT;

-- ── Atomic view_count increment RPC ──────────────────────────────────────────
-- Called by /api/deal-packs/[id] GET when a pack is viewed.
-- Uses UPDATE ... RETURNING to avoid race conditions.

CREATE OR REPLACE FUNCTION increment_deal_pack_view_count(pack_id UUID)
RETURNS TABLE(id UUID, view_count INT, status TEXT) LANGUAGE plpgsql
SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
    UPDATE deal_packs dp
    SET
      view_count = COALESCE(dp.view_count, 0) + 1,
      viewed_at  = COALESCE(dp.viewed_at, NOW()),
      -- Advance status: sent → viewed (so revenue funnel counts correctly)
      status     = CASE WHEN dp.status = 'sent' THEN 'viewed' ELSE dp.status END
    WHERE dp.id = pack_id
    RETURNING dp.id, dp.view_count, dp.status;
END;
$$;

COMMENT ON FUNCTION increment_deal_pack_view_count(UUID) IS
  'Atomically increments view_count and advances status sent→viewed.
   Called by /api/deal-packs/[id] GET on every recipient view.
   SECURITY DEFINER so it works from the service role.';

-- ── Grant execute to service_role ─────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION increment_deal_pack_view_count(UUID) TO service_role;

-- Done
SELECT 'deal_pack view RPC + metadata columns added' AS status;
