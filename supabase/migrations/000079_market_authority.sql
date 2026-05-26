-- =============================================================================
-- Agency Group — Wave 43: Market Authority Tables
-- supabase/migrations/000079_market_authority.sql
--
-- Creates:
--   official_liquidity_index       — OLI per market + period (tamper-evident, SHA-256)
--   official_price_benchmarks_v2   — Weighted median price reference per market/city/type
--   investment_confidence_scores   — ICS composite institutional confidence signal
--
-- All EUR amounts in bigint (cents) — never float for money.
-- All tables: IF NOT EXISTS, RLS enabled, tenant isolation policy, indexes.
-- SHA-256 hash chain on all published indices (tamper-evident).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- official_liquidity_index
-- The Official Liquidity Index (OLI) — proprietary institutional reference
-- measuring real estate market liquidity per market and period.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS official_liquidity_index (
  id                          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  index_id                    text         UNIQUE NOT NULL,
  tenant_id                   text         NOT NULL,
  market                      text         NOT NULL,
  period                      text         NOT NULL,

  -- Core metrics
  oli_score                   numeric(5,2) NOT NULL DEFAULT 0,
  liquidity_tier              text         NOT NULL DEFAULT 'MODERATE',

  -- Input signals
  active_listings             int          NOT NULL DEFAULT 0,
  avg_days_on_market          numeric(8,2) NOT NULL DEFAULT 90,
  transaction_velocity        numeric(8,2) NOT NULL DEFAULT 0,
  bid_competition_ratio       numeric(6,3) NOT NULL DEFAULT 1,
  capital_available_eur_cents bigint       NOT NULL DEFAULT 0,
  demand_supply_ratio         numeric(6,3) NOT NULL DEFAULT 0,

  -- Derived
  price_momentum_pct          numeric(8,4) NOT NULL DEFAULT 0,
  absorption_rate_pct         numeric(6,3) NOT NULL DEFAULT 0,

  -- Authority metadata
  index_version               text         NOT NULL DEFAULT 'v1.0',
  sha256_hash                 text         NOT NULL,
  published_at                timestamptz  NOT NULL DEFAULT now(),
  valid_until                 timestamptz,
  methodology_url             text,

  UNIQUE (market, period, tenant_id)
);

ALTER TABLE official_liquidity_index ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_official_liquidity_index ON official_liquidity_index;
CREATE POLICY tenant_isolation_official_liquidity_index
  ON official_liquidity_index
  USING (tenant_id = current_setting('app.tenant_id', true));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_oli_market_period
  ON official_liquidity_index (market, period);

CREATE INDEX IF NOT EXISTS idx_oli_tenant_published
  ON official_liquidity_index (tenant_id, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_oli_score_desc
  ON official_liquidity_index (oli_score DESC);

CREATE INDEX IF NOT EXISTS idx_oli_index_id
  ON official_liquidity_index (index_id);

-- ---------------------------------------------------------------------------
-- official_price_benchmarks_v2
-- Multi-source weighted median price reference.
-- "v2" suffix avoids collision with the existing external_price_benchmarks table.
-- Source: raw_opportunity_stream + external_price_benchmarks + public_registry_transactions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS official_price_benchmarks_v2 (
  id                              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  benchmark_id                    text         UNIQUE NOT NULL,
  tenant_id                       text         NOT NULL,
  market                          text         NOT NULL,
  city                            text         NOT NULL,
  property_type                   text         NOT NULL,
  period                          text         NOT NULL,

  -- Benchmark values (EUR cents per sqm)
  price_per_sqm_p25_eur_cents     bigint       NOT NULL DEFAULT 0,
  price_per_sqm_p50_eur_cents     bigint       NOT NULL DEFAULT 0,  -- THE benchmark
  price_per_sqm_p75_eur_cents     bigint       NOT NULL DEFAULT 0,
  price_per_sqm_mean_eur_cents    bigint       NOT NULL DEFAULT 0,

  -- Sample quality
  sample_count                    int          NOT NULL DEFAULT 0,
  source_breakdown                jsonb        NOT NULL DEFAULT '{}',
  confidence_score                numeric(4,3) NOT NULL DEFAULT 0,
  is_statistically_significant    boolean      NOT NULL DEFAULT false,

  -- Trend
  prior_period_p50_eur_cents      bigint,
  trend_pct                       numeric(8,4),

  -- Authority
  sha256_hash                     text         NOT NULL,
  published_at                    timestamptz  NOT NULL DEFAULT now(),
  methodology                     text         NOT NULL DEFAULT 'WEIGHTED_MEDIAN_MULTI_SOURCE',

  UNIQUE (market, city, property_type, period, tenant_id)
);

ALTER TABLE official_price_benchmarks_v2 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_official_price_benchmarks_v2 ON official_price_benchmarks_v2;
CREATE POLICY tenant_isolation_official_price_benchmarks_v2
  ON official_price_benchmarks_v2
  USING (tenant_id = current_setting('app.tenant_id', true));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_opb_v2_market_period
  ON official_price_benchmarks_v2 (market, period);

CREATE INDEX IF NOT EXISTS idx_opb_v2_tenant_published
  ON official_price_benchmarks_v2 (tenant_id, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_opb_v2_market_city_type
  ON official_price_benchmarks_v2 (market, city, property_type);

CREATE INDEX IF NOT EXISTS idx_opb_v2_benchmark_id
  ON official_price_benchmarks_v2 (benchmark_id);

-- ---------------------------------------------------------------------------
-- investment_confidence_scores
-- ICS — composite institutional confidence signal.
-- Integrates liquidity, pricing stability, capital, regulatory, and data quality.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS investment_confidence_scores (
  id                           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  ics_id                       text         UNIQUE NOT NULL,
  tenant_id                    text         NOT NULL,
  market                       text         NOT NULL,
  period                       text         NOT NULL,

  -- ICS components (all 0–100)
  ics_score                    numeric(5,2) NOT NULL DEFAULT 0,
  market_liquidity_score       numeric(5,2) NOT NULL DEFAULT 0,
  pricing_stability_score      numeric(5,2) NOT NULL DEFAULT 0,
  capital_availability_score   numeric(5,2) NOT NULL DEFAULT 0,
  regulatory_alignment_score   numeric(5,2) NOT NULL DEFAULT 0,
  data_quality_score           numeric(5,2) NOT NULL DEFAULT 0,

  confidence_level             text         NOT NULL DEFAULT 'MODERATE',

  -- Institutional suitability flags
  suitable_for_retail          boolean      NOT NULL DEFAULT false,
  suitable_for_professional    boolean      NOT NULL DEFAULT false,
  suitable_for_institutional   boolean      NOT NULL DEFAULT false,

  -- Authority
  sha256_hash                  text         NOT NULL,
  published_at                 timestamptz  NOT NULL DEFAULT now(),
  valid_until                  timestamptz,

  UNIQUE (market, period, tenant_id)
);

ALTER TABLE investment_confidence_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_investment_confidence_scores ON investment_confidence_scores;
CREATE POLICY tenant_isolation_investment_confidence_scores
  ON investment_confidence_scores
  USING (tenant_id = current_setting('app.tenant_id', true));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ics_market_period
  ON investment_confidence_scores (market, period);

CREATE INDEX IF NOT EXISTS idx_ics_tenant_published
  ON investment_confidence_scores (tenant_id, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_ics_score_desc
  ON investment_confidence_scores (ics_score DESC);

CREATE INDEX IF NOT EXISTS idx_ics_ics_id
  ON investment_confidence_scores (ics_id);
