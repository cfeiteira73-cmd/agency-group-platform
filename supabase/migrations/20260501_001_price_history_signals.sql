-- =============================================================================
-- Agency Group — Price History + Property Scoring Columns
-- Migration: 20260501_001_price_history_signals
-- Phase: SH-ROS Phase 1+2+3 — Deal Intelligence Platform
--
-- WHAT THIS ADDS:
--   1. price_history table  — append-only price change log per property
--   2. properties.score_reason  TEXT — human-readable scoring summary
--   3. properties.score_breakdown  JSONB — d1-d6 dimension breakdown
--   4. properties.scored_at  TIMESTAMPTZ — last scoring timestamp
--   5. properties.zone_key  TEXT — resolved zone key (from lib/market/zones.ts)
--   6. Indexes for signal detection queries (unscored, price-changed, stale)
--   7. RLS on price_history (mirrors properties policy)
--
-- SAFE: additive only — no existing columns altered, no tables dropped
-- REVERSIBLE: see rollback section at bottom
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. price_history table
--    Append-only ledger of price changes for each property.
--    Written by: sync-listings cron (external) + agent manual updates
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS price_history (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  price_old       DECIMAL(12, 2) NOT NULL,
  price_new       DECIMAL(12, 2) NOT NULL,
  price_delta     DECIMAL(12, 2) GENERATED ALWAYS AS (price_new - price_old) STORED,
  pct_change      DECIMAL(6, 3)  GENERATED ALWAYS AS (
                    CASE WHEN price_old > 0
                    THEN ROUND(((price_new - price_old) / price_old) * 100, 3)
                    ELSE 0 END
                  ) STORED,
  change_type     TEXT NOT NULL CHECK (change_type IN ('reduction','increase','correction')),
  source          TEXT NOT NULL DEFAULT 'sync',  -- 'sync','manual','idealista','imovirtual'
  agent_email     TEXT,                           -- null for automated syncs
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE price_history IS
  'Append-only price change ledger per property. Populated by sync-listings cron and manual agent updates. Never update rows — insert new ones.';

-- Indexes: fast lookup per property (time-series), recent reductions for signal detection
CREATE INDEX IF NOT EXISTS idx_price_history_property_time
  ON price_history (property_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_price_history_reductions
  ON price_history (change_type, created_at DESC)
  WHERE change_type = 'reduction';

CREATE INDEX IF NOT EXISTS idx_price_history_recent
  ON price_history (created_at DESC)
  WHERE created_at > NOW() - INTERVAL '30 days';

-- RLS: agents can read all price history; only service_role can write
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "price_history_authenticated_read" ON price_history
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "price_history_service_write" ON price_history
  FOR INSERT TO service_role WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 2. Extend properties table with scoring output columns
-- ---------------------------------------------------------------------------

-- Human-readable scoring summary (e.g. "Score HIGH (82/100) — yield 6.2% · nova listagem")
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS score_reason TEXT;

-- 6-dimension breakdown JSON {d1_price_vs_zone:22, d2_rental_yield:16, ...}
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS score_breakdown JSONB;

-- When was this property last scored by the engine
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS scored_at TIMESTAMPTZ;

-- Resolved zone key from lib/market/zones.ts (e.g. "Lisboa — Chiado/Santos")
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS zone_key TEXT;

-- ---------------------------------------------------------------------------
-- 3. Indexes for scoring pipeline queries
-- ---------------------------------------------------------------------------

-- Unscored properties (for initial scoring pass)
CREATE INDEX IF NOT EXISTS idx_properties_unscored
  ON properties (created_at DESC)
  WHERE opportunity_score = 0 AND status = 'active';

-- Properties needing re-score (scored > 7 days ago)
CREATE INDEX IF NOT EXISTS idx_properties_stale_score
  ON properties (scored_at ASC)
  WHERE status = 'active' AND scored_at IS NOT NULL;

-- High-score properties for investor matching
CREATE INDEX IF NOT EXISTS idx_properties_high_score
  ON properties (opportunity_score DESC, investor_suitable, zone_key)
  WHERE status = 'active' AND opportunity_score >= 60;

-- Zone-based queries (for signal detection)
CREATE INDEX IF NOT EXISTS idx_properties_zone_key_status
  ON properties (zone_key, status)
  WHERE status = 'active';

-- Stale listings detection: active props with high DOM
CREATE INDEX IF NOT EXISTS idx_properties_days_on_market
  ON properties (days_on_market DESC, status)
  WHERE status = 'active' AND days_on_market IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. Extend signals table with metadata JSONB index (for fast signal dedup)
-- ---------------------------------------------------------------------------

-- Composite index for deduplication: one active signal per type per property
CREATE UNIQUE INDEX IF NOT EXISTS idx_signals_property_type_active
  ON signals (property_id, type)
  WHERE status IN ('new', 'in_progress') AND property_id IS NOT NULL;

-- Fast lookup: signals by property
CREATE INDEX IF NOT EXISTS idx_signals_property_id
  ON signals (property_id, created_at DESC)
  WHERE property_id IS NOT NULL;

-- Fast lookup: new signals dashboard
CREATE INDEX IF NOT EXISTS idx_signals_status_priority
  ON signals (status, priority DESC, created_at DESC)
  WHERE status = 'new';

-- ---------------------------------------------------------------------------
-- 5. Helper view: v_signal_summary
--    Pre-joins signals with property data for the dashboard
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW v_signal_summary AS
SELECT
  s.id,
  s.type,
  s.status,
  s.priority,
  s.probability_score,
  s.property_id,
  s.property_address,
  s.property_zone,
  s.estimated_value,
  s.recommended_action,
  s.action_deadline,
  s.raw_data,
  s.source,
  s.created_at,
  -- Property join
  p.title          AS property_title,
  p.price          AS property_price,
  p.opportunity_score,
  p.investor_suitable,
  p.score_reason,
  p.zone_key,
  p.days_on_market,
  p.status         AS property_status,
  p.photos
FROM signals s
LEFT JOIN properties p ON p.id = s.property_id
ORDER BY s.priority DESC, s.created_at DESC;

COMMENT ON VIEW v_signal_summary IS
  'Pre-joined signals + property data. Used by Control Tower dashboard and alerts cron.';

-- ---------------------------------------------------------------------------
-- 6. Helper function: get_unscored_properties(limit_n INT)
--    Returns properties that need scoring (unscored OR score stale > 7d)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_unscored_properties(limit_n INT DEFAULT 100)
RETURNS TABLE (
  id                UUID,
  title             TEXT,
  price             DECIMAL,
  price_previous    DECIMAL,
  price_per_sqm     DECIMAL,
  avm_estimate      DECIMAL,
  area_m2           DECIMAL,
  bedrooms          SMALLINT,
  type              TEXT,
  condition         TEXT,
  features          TEXT[],
  zone              TEXT,
  city              TEXT,
  concelho          TEXT,
  address           TEXT,
  days_on_market    INT,
  is_exclusive      BOOLEAN,
  is_off_market     BOOLEAN,
  opportunity_score SMALLINT,
  investor_suitable BOOLEAN,
  status            TEXT,
  created_at        TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    id, title, price, price_previous, price_per_sqm, avm_estimate,
    area_m2, bedrooms, type::TEXT, condition, features,
    zone, city, concelho, address,
    days_on_market, is_exclusive, is_off_market,
    opportunity_score, investor_suitable, status::TEXT, created_at
  FROM properties
  WHERE
    status = 'active'
    AND (
      opportunity_score = 0
      OR scored_at IS NULL
      OR scored_at < NOW() - INTERVAL '7 days'
    )
  ORDER BY
    CASE WHEN opportunity_score = 0 THEN 0 ELSE 1 END,
    created_at DESC
  LIMIT limit_n;
$$;

COMMENT ON FUNCTION get_unscored_properties IS
  'Returns active properties that have never been scored OR whose score is stale (>7d). Used by sync-listings cron to batch re-score.';

-- =============================================================================
-- ROLLBACK (run in Supabase Dashboard → SQL Editor to undo this migration)
-- =============================================================================
--
-- DROP VIEW  IF EXISTS v_signal_summary;
-- DROP FUNCTION IF EXISTS get_unscored_properties(INT);
--
-- DROP INDEX IF EXISTS idx_signals_status_priority;
-- DROP INDEX IF EXISTS idx_signals_property_id;
-- DROP INDEX IF EXISTS idx_signals_property_type_active;
-- DROP INDEX IF EXISTS idx_properties_days_on_market;
-- DROP INDEX IF EXISTS idx_properties_zone_key_status;
-- DROP INDEX IF EXISTS idx_properties_high_score;
-- DROP INDEX IF EXISTS idx_properties_stale_score;
-- DROP INDEX IF EXISTS idx_properties_unscored;
--
-- ALTER TABLE properties DROP COLUMN IF EXISTS zone_key;
-- ALTER TABLE properties DROP COLUMN IF EXISTS scored_at;
-- ALTER TABLE properties DROP COLUMN IF EXISTS score_breakdown;
-- ALTER TABLE properties DROP COLUMN IF EXISTS score_reason;
--
-- DROP TABLE IF EXISTS price_history CASCADE;
--
-- SELECT 'Rollback 20260501_001 complete' AS status;
-- =============================================================================

SELECT '20260501_001 applied: price_history + property scoring columns + signal indexes' AS migration_status;
