-- =============================================================================
-- Migration: 20260522000003_ingestion_canonical_system
-- Purpose: Canonical property entity system — dedup, enrichment, fraud
-- Agency Group SH-ROS — European Real Estate Liquidity Infrastructure Phase 2
-- =============================================================================

-- ── canonical_properties: single source of truth for property entities ────────
CREATE TABLE IF NOT EXISTS canonical_properties (
  canonical_id      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid        NOT NULL REFERENCES organizations(id),
  source_ids        jsonb       NOT NULL DEFAULT '{}',
  title             text        NOT NULL,
  description       text,
  address           text        NOT NULL,
  city              text        NOT NULL,
  zone              text,
  country           text        NOT NULL DEFAULT 'PT',
  latitude          numeric,
  longitude         numeric,
  property_type     text        NOT NULL,
  area_m2           numeric     NOT NULL,
  bedrooms          integer,
  bathrooms         integer,
  floor             integer,
  price_eur         numeric     NOT NULL,
  price_per_m2      numeric,
  estimated_yield_pct numeric,
  listing_status    text        NOT NULL DEFAULT 'active'
                    CHECK (listing_status IN ('active','sold','reserved','expired')),
  listed_at         timestamptz NOT NULL DEFAULT now(),
  freshness_score   numeric     NOT NULL DEFAULT 100,
  fraud_risk_score  numeric     NOT NULL DEFAULT 0,
  is_canonical      boolean     NOT NULL DEFAULT true,
  merged_from       uuid[],
  demand_score      numeric,
  computed_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_canonical_properties_tenant_city
  ON canonical_properties(tenant_id, city, listing_status);

CREATE INDEX IF NOT EXISTS idx_canonical_properties_geo
  ON canonical_properties(latitude, longitude)
  WHERE latitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_canonical_properties_price_area
  ON canonical_properties(tenant_id, city, property_type, price_eur, area_m2);

CREATE INDEX IF NOT EXISTS idx_canonical_properties_source_ids
  ON canonical_properties USING gin(source_ids);

CREATE INDEX IF NOT EXISTS idx_canonical_properties_freshness
  ON canonical_properties(tenant_id, freshness_score DESC)
  WHERE listing_status = 'active';

ALTER TABLE canonical_properties ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'canonical_properties' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON canonical_properties
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ── dedup_candidates: pending merge review queue ───────────────────────────────
CREATE TABLE IF NOT EXISTS dedup_candidates (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid        NOT NULL REFERENCES organizations(id),
  canonical_id_a    uuid        NOT NULL,
  canonical_id_b    uuid        NOT NULL,
  similarity_score  numeric     NOT NULL,
  match_factors     jsonb       NOT NULL DEFAULT '{}',
  auto_merge        boolean     NOT NULL DEFAULT false,
  status            text        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','merged','rejected','reviewing')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  reviewed_at       timestamptz,
  UNIQUE(canonical_id_a, canonical_id_b)
);

CREATE INDEX IF NOT EXISTS idx_dedup_candidates_tenant_status
  ON dedup_candidates(tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dedup_candidates_score
  ON dedup_candidates(tenant_id, similarity_score DESC)
  WHERE status = 'pending';

ALTER TABLE dedup_candidates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'dedup_candidates' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON dedup_candidates
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ── property_enrichments: enrichment data separate from canonical record ───────
CREATE TABLE IF NOT EXISTS property_enrichments (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_id                uuid        NOT NULL,
  tenant_id                   uuid        NOT NULL REFERENCES organizations(id),
  zone_classification         text,
  market_median_price_per_m2  numeric,
  price_vs_market_pct         numeric,
  avg_days_to_sell_in_zone    numeric,
  liquidity_index             numeric,
  risk_tags                   text[],
  demand_pressure             text,
  similar_listed              integer,
  similar_sold_90d            integer,
  enriched_at                 timestamptz NOT NULL DEFAULT now(),
  UNIQUE(canonical_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_property_enrichments_tenant
  ON property_enrichments(tenant_id, enriched_at DESC);

CREATE INDEX IF NOT EXISTS idx_property_enrichments_canonical
  ON property_enrichments(canonical_id);

CREATE INDEX IF NOT EXISTS idx_property_enrichments_risk_tags
  ON property_enrichments USING gin(risk_tags);

ALTER TABLE property_enrichments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'property_enrichments' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON property_enrichments
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
