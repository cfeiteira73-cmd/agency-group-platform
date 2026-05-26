-- =============================================================================
-- Agency Group — Canonical Assets v1.0
-- Wave 42 | Migration 000073
-- canonical_assets_v2, asset_lineage_records, asset_interaction_events,
-- asset_relationships, deduplication_candidates
-- =============================================================================

-- ─── 1. canonical_assets_v2 ──────────────────────────────────────────────────
-- Named _v2 to avoid collision with existing canonical_assets table from
-- migration 20260522000025_canonical_asset_ledger.sql
-- This version: text tenant_id, bigint cents, full normalization pipeline.

CREATE TABLE IF NOT EXISTS canonical_assets_v2 (
  id                       uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id                 text         NOT NULL,
  tenant_id                text         NOT NULL,
  primary_source           text,
  source_ids               jsonb        DEFAULT '{}',
  source_confidence        numeric(4,3) DEFAULT 0.5,
  country                  text,
  market                   text,
  city                     text,
  district                 text,
  address                  text,
  latitude                 numeric(10,7),
  longitude                numeric(10,7),
  property_type            text,
  size_sqm                 numeric(10,2),
  bedrooms                 int,
  bathrooms                int,
  floor                    int,
  asking_price_eur_cents   bigint,
  valuation                jsonb        DEFAULT '{}',
  price_per_sqm_eur_cents  bigint,
  liquidity_score          numeric(5,2) DEFAULT 50,
  risk_score               numeric(5,2) DEFAULT 50,
  opportunity_score        numeric(5,2) DEFAULT 50,
  undervaluation_pct       numeric(8,4) DEFAULT 0,
  legal_status             text         DEFAULT 'UNKNOWN',
  is_distressed            boolean      DEFAULT false,
  is_auction               boolean      DEFAULT false,
  auction_date             timestamptz,
  encumbrances             jsonb        DEFAULT '[]',
  days_on_market           int,
  price_history            jsonb        DEFAULT '[]',
  normalization_status     text         DEFAULT 'PENDING',
  first_seen_at            timestamptz  DEFAULT now(),
  last_updated_at          timestamptz  DEFAULT now(),
  delisted_at              timestamptz,

  CONSTRAINT canonical_assets_v2_asset_id_unique UNIQUE (asset_id),
  CONSTRAINT canonical_assets_v2_legal_status_check
    CHECK (legal_status IN ('FREE','ENCUMBERED','JUDICIAL','AUCTION','NPL','FORECLOSURE','UNKNOWN')),
  CONSTRAINT canonical_assets_v2_normalization_status_check
    CHECK (normalization_status IN ('PENDING','NORMALIZED','DEDUPLICATED','REJECTED','NEEDS_REVIEW')),
  CONSTRAINT canonical_assets_v2_asking_price_check
    CHECK (asking_price_eur_cents IS NULL OR asking_price_eur_cents >= 0)
);

-- Composite indexes for portal queries
CREATE INDEX IF NOT EXISTS idx_canonical_assets_v2_tenant_city_score
  ON canonical_assets_v2 (tenant_id, city, opportunity_score DESC);

CREATE INDEX IF NOT EXISTS idx_canonical_assets_v2_tenant_market_distressed
  ON canonical_assets_v2 (tenant_id, market, is_distressed);

CREATE INDEX IF NOT EXISTS idx_canonical_assets_v2_tenant_norm_status
  ON canonical_assets_v2 (tenant_id, normalization_status);

CREATE INDEX IF NOT EXISTS idx_canonical_assets_v2_coordinates
  ON canonical_assets_v2 (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_canonical_assets_v2_asset_id
  ON canonical_assets_v2 (asset_id);

CREATE INDEX IF NOT EXISTS idx_canonical_assets_v2_tenant_updated
  ON canonical_assets_v2 (tenant_id, last_updated_at DESC);

-- RLS
ALTER TABLE canonical_assets_v2 ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'canonical_assets_v2'
      AND policyname = 'canonical_assets_v2_tenant_isolation'
  ) THEN
    CREATE POLICY canonical_assets_v2_tenant_isolation
      ON canonical_assets_v2
      USING (tenant_id = current_setting('app.tenant_id', true));
  END IF;
END;
$$;

-- ─── 2. asset_lineage_records ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS asset_lineage_records (
  id                     uuid      DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id               text      NOT NULL,
  tenant_id              text,
  source_records         jsonb     DEFAULT '[]',
  normalization_history  jsonb     DEFAULT '[]',
  price_timeline         jsonb     DEFAULT '[]',
  view_count             int       DEFAULT 0,
  bid_count              int       DEFAULT 0,
  closed                 boolean   DEFAULT false,
  updated_at             timestamptz DEFAULT now(),

  CONSTRAINT asset_lineage_records_asset_id_unique UNIQUE (asset_id)
);

CREATE INDEX IF NOT EXISTS idx_asset_lineage_records_asset_id
  ON asset_lineage_records (asset_id);

CREATE INDEX IF NOT EXISTS idx_asset_lineage_records_tenant
  ON asset_lineage_records (tenant_id);

ALTER TABLE asset_lineage_records ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'asset_lineage_records'
      AND policyname = 'asset_lineage_records_tenant_isolation'
  ) THEN
    CREATE POLICY asset_lineage_records_tenant_isolation
      ON asset_lineage_records
      USING (tenant_id = current_setting('app.tenant_id', true));
  END IF;
END;
$$;

-- ─── 3. asset_interaction_events ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS asset_interaction_events (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id          text        UNIQUE DEFAULT gen_random_uuid()::text,
  tenant_id         text,
  asset_id          text,
  investor_id       text,
  event_type        text,
  amount_eur_cents  bigint,
  occurred_at       timestamptz DEFAULT now(),

  CONSTRAINT asset_interaction_events_type_check
    CHECK (event_type IN ('VIEW','BID','OFFER','VISIT','FAVOURITE','SHARE'))
);

CREATE INDEX IF NOT EXISTS idx_asset_interaction_events_asset_id
  ON asset_interaction_events (asset_id);

CREATE INDEX IF NOT EXISTS idx_asset_interaction_events_tenant_occurred
  ON asset_interaction_events (tenant_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_asset_interaction_events_investor
  ON asset_interaction_events (investor_id, occurred_at DESC)
  WHERE investor_id IS NOT NULL;

ALTER TABLE asset_interaction_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'asset_interaction_events'
      AND policyname = 'asset_interaction_events_tenant_isolation'
  ) THEN
    CREATE POLICY asset_interaction_events_tenant_isolation
      ON asset_interaction_events
      USING (tenant_id = current_setting('app.tenant_id', true));
  END IF;
END;
$$;

-- ─── 4. asset_relationships ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS asset_relationships (
  id                  uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id            text,
  related_asset_id    text,
  tenant_id           text,
  relationship_type   text,
  similarity_score    numeric(4,3),
  detected_at         timestamptz  DEFAULT now(),

  CONSTRAINT asset_relationships_unique UNIQUE (asset_id, related_asset_id),
  CONSTRAINT asset_relationships_type_check
    CHECK (relationship_type IN ('SAME_BUILDING','SAME_STREET','COMPARABLE','DUPLICATE'))
);

CREATE INDEX IF NOT EXISTS idx_asset_relationships_asset_id
  ON asset_relationships (asset_id);

CREATE INDEX IF NOT EXISTS idx_asset_relationships_related
  ON asset_relationships (related_asset_id);

CREATE INDEX IF NOT EXISTS idx_asset_relationships_tenant
  ON asset_relationships (tenant_id);

ALTER TABLE asset_relationships ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'asset_relationships'
      AND policyname = 'asset_relationships_tenant_isolation'
  ) THEN
    CREATE POLICY asset_relationships_tenant_isolation
      ON asset_relationships
      USING (tenant_id = current_setting('app.tenant_id', true));
  END IF;
END;
$$;

-- ─── 5. deduplication_candidates ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS deduplication_candidates (
  id                uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id         text,
  asset_a_id        text,
  asset_b_id        text,
  similarity_score  numeric(4,3),
  match_signals     jsonb        DEFAULT '[]',
  recommendation    text,
  status            text         DEFAULT 'PENDING',
  detected_at       timestamptz  DEFAULT now(),

  CONSTRAINT deduplication_candidates_unique UNIQUE (asset_a_id, asset_b_id),
  CONSTRAINT deduplication_candidates_recommendation_check
    CHECK (recommendation IN ('MERGE','LIKELY_SAME','POSSIBLY_SAME','DIFFERENT')),
  CONSTRAINT deduplication_candidates_status_check
    CHECK (status IN ('PENDING','NEEDS_REVIEW','AUTO_MERGED','MANUALLY_MERGED','DISMISSED'))
);

CREATE INDEX IF NOT EXISTS idx_deduplication_candidates_tenant_status
  ON deduplication_candidates (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_deduplication_candidates_score
  ON deduplication_candidates (similarity_score DESC);

CREATE INDEX IF NOT EXISTS idx_deduplication_candidates_asset_a
  ON deduplication_candidates (asset_a_id);

CREATE INDEX IF NOT EXISTS idx_deduplication_candidates_asset_b
  ON deduplication_candidates (asset_b_id);

ALTER TABLE deduplication_candidates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'deduplication_candidates'
      AND policyname = 'deduplication_candidates_tenant_isolation'
  ) THEN
    CREATE POLICY deduplication_candidates_tenant_isolation
      ON deduplication_candidates
      USING (tenant_id = current_setting('app.tenant_id', true));
  END IF;
END;
$$;

-- ─── Comments ─────────────────────────────────────────────────────────────────

COMMENT ON TABLE canonical_assets_v2 IS
  'Wave 42: Normalized canonical real estate assets. 1 property = 1 record regardless of source count. OBSERVED vs INFERRED tracked per field. EUR in bigint cents.';

COMMENT ON TABLE asset_lineage_records IS
  'Wave 42: Full lineage for each canonical asset — source records, normalization history, price timeline, interaction counts.';

COMMENT ON TABLE asset_interaction_events IS
  'Wave 42: Immutable event log for asset interactions — views, bids, offers, visits per investor.';

COMMENT ON TABLE asset_relationships IS
  'Wave 42: Graph of relationships between canonical assets — same building, comparable, or duplicate.';

COMMENT ON TABLE deduplication_candidates IS
  'Wave 42: Probabilistic deduplication candidates with match signals and recommendation for review or auto-merge.';
