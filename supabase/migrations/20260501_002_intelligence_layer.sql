-- =============================================================================
-- Agency Group — Intelligence Layer v2 Migration
-- 20260501_002_intelligence_layer.sql
--
-- Extends properties table with:
--   - Provider ingestion tracking (source_provider, source_confidence, provider_listing_id)
--   - Advanced AVM columns (value_low/base/high, confidence, comps_used)
--   - Presentation quality columns (presentation_score, presentation_flags)
--   - Score V2 columns (opportunity_grade, score_v2_confidence_adjusted)
--
-- Creates new tables:
--   - market_comps     : comparable transaction ledger for AVM engine
--   - scoring_feedback_events : realized outcome tracking for calibration
--
-- IDEMPOTENT: all DDL wrapped in IF NOT EXISTS / DO $$ checks
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extend properties table — provider / ingestion columns
-- ---------------------------------------------------------------------------

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS source_provider         TEXT        DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_confidence       NUMERIC(3,2) DEFAULT 1.00,
  ADD COLUMN IF NOT EXISTS provider_listing_id     TEXT,
  ADD COLUMN IF NOT EXISTS canonical_listing_id    TEXT;

-- Unique index: one canonical row per provider + provider_listing_id
-- Allows idempotent upsert from ingestion pipeline
CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_provider_listing
  ON properties (source_provider, provider_listing_id)
  WHERE provider_listing_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Extend properties table — AVM / valuation columns
-- ---------------------------------------------------------------------------

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS avm_value_low           NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS avm_value_base          NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS avm_value_high          NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS avm_confidence          NUMERIC(4,3),   -- 0.000–1.000
  ADD COLUMN IF NOT EXISTS avm_comps_used          INTEGER         DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avm_computed_at         TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- 3. Extend properties table — presentation quality columns
-- ---------------------------------------------------------------------------

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS presentation_score      INTEGER         DEFAULT NULL,  -- 0-100
  ADD COLUMN IF NOT EXISTS presentation_flags      TEXT[]          DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS presentation_opportunity_bonus INTEGER  DEFAULT 0;

-- ---------------------------------------------------------------------------
-- 4. Extend properties table — Score V2 / opportunity grade
-- ---------------------------------------------------------------------------

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS opportunity_grade       TEXT,  -- 'A+','A','B','C','D'
  ADD COLUMN IF NOT EXISTS score_v2_confidence_adjusted INTEGER;  -- score after confidence penalty

-- ---------------------------------------------------------------------------
-- 5. Create market_comps table (comparable transactions for AVM)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS market_comps (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Location
  zone_key              TEXT        NOT NULL,
  city                  TEXT,
  address               TEXT,
  latitude              NUMERIC(10,7),
  longitude             NUMERIC(10,7),
  -- Property
  property_type         TEXT,
  area_m2               NUMERIC(8,2),
  bedrooms              INTEGER,
  bathrooms             INTEGER,
  condition             TEXT,
  -- Transaction
  sale_price            NUMERIC(12,2) NOT NULL,
  price_per_sqm         NUMERIC(8,2),
  transaction_date      DATE,
  transaction_type      TEXT NOT NULL DEFAULT 'sale',  -- 'sale','rental','auction'
  -- Source
  source                TEXT NOT NULL,  -- 'ine','idealista','eleiloes','manual'
  source_reference      TEXT,
  -- Timestamps
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_comps_zone_key
  ON market_comps (zone_key, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_market_comps_city_type
  ON market_comps (city, property_type, transaction_date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_market_comps_source_ref
  ON market_comps (source, source_reference)
  WHERE source_reference IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 6. Create scoring_feedback_events table (closed-loop calibration)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS scoring_feedback_events (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Property context
  property_id           TEXT        NOT NULL,
  opportunity_score     INTEGER     NOT NULL,  -- score when surfaced
  opportunity_grade     TEXT,
  score_breakdown       JSONB,
  -- Outcome tracking
  was_surfaced_to       TEXT,       -- contact/investor id shown to
  surfaced_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  investor_opened       BOOLEAN     DEFAULT FALSE,
  investor_replied      BOOLEAN     DEFAULT FALSE,
  meeting_booked        BOOLEAN     DEFAULT FALSE,
  offer_submitted       BOOLEAN     DEFAULT FALSE,
  deal_won              BOOLEAN     DEFAULT FALSE,
  -- Realized values (populated when deal closes)
  realized_sale_price   NUMERIC(12,2),
  realized_dom          INTEGER,    -- actual days from listing to sale
  realized_yield        NUMERIC(5,2),
  predicted_yield       NUMERIC(5,2),
  -- Calibration metadata
  deal_pack_id          UUID,
  agent_email           TEXT,
  notes                 TEXT,
  -- Timestamps
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- FK
  CONSTRAINT fk_sfe_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sfe_property_id
  ON scoring_feedback_events (property_id);
CREATE INDEX IF NOT EXISTS idx_sfe_surfaced_at
  ON scoring_feedback_events (surfaced_at DESC);
CREATE INDEX IF NOT EXISTS idx_sfe_score_outcome
  ON scoring_feedback_events (opportunity_score, deal_won);

-- ---------------------------------------------------------------------------
-- 7. RPC: record_scoring_feedback (upsert based on property+deal_pack)
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- 8. RPC: get_scoring_performance — calibration metrics by grade band
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW v_scoring_performance AS
SELECT
  opportunity_grade,
  COUNT(*)                                                   AS total_surfaced,
  COUNT(*) FILTER (WHERE investor_opened)                   AS opened,
  COUNT(*) FILTER (WHERE investor_replied)                  AS replied,
  COUNT(*) FILTER (WHERE meeting_booked)                    AS meetings,
  COUNT(*) FILTER (WHERE offer_submitted)                   AS offers,
  COUNT(*) FILTER (WHERE deal_won)                          AS deals_won,
  ROUND(
    COUNT(*) FILTER (WHERE deal_won)::NUMERIC /
    NULLIF(COUNT(*), 0) * 100, 1
  )                                                          AS win_rate_pct,
  ROUND(
    COUNT(*) FILTER (WHERE meeting_booked)::NUMERIC /
    NULLIF(COUNT(*), 0) * 100, 1
  )                                                          AS meeting_rate_pct,
  ROUND(AVG(realized_yield), 2)                             AS avg_realized_yield,
  ROUND(AVG(predicted_yield), 2)                            AS avg_predicted_yield,
  ROUND(AVG(realized_yield - predicted_yield), 2)          AS yield_prediction_error,
  MIN(surfaced_at)                                           AS first_event,
  MAX(surfaced_at)                                           AS last_event
FROM scoring_feedback_events
GROUP BY opportunity_grade
ORDER BY
  CASE opportunity_grade
    WHEN 'A+' THEN 1
    WHEN 'A'  THEN 2
    WHEN 'B'  THEN 3
    WHEN 'C'  THEN 4
    WHEN 'D'  THEN 5
    ELSE 6
  END;

-- ---------------------------------------------------------------------------
-- 9. RLS policies for new tables
-- ---------------------------------------------------------------------------

ALTER TABLE market_comps             ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_feedback_events  ENABLE ROW LEVEL SECURITY;

-- Service role has full access (used by backend APIs)
CREATE POLICY IF NOT EXISTS "service_role_market_comps_all"
  ON market_comps FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "service_role_sfe_all"
  ON scoring_feedback_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Completion marker
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  RAISE NOTICE '20260501_002_intelligence_layer.sql applied successfully';
END $$;
