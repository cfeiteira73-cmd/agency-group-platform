-- =============================================================================
-- Agency Group — Supply Layer Migration
-- supabase/migrations/000072_supply_layer.sql
--
-- Creates:
--   1. raw_opportunity_stream  — central intake table for all supply sources
--   2. ingestion_runs          — audit log for each ingestion cycle
--
-- RLS: tenant_isolation on both tables.
-- =============================================================================

-- ─── raw_opportunity_stream ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS raw_opportunity_stream (
  id                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               text          NOT NULL,
  source                  text          NOT NULL,     -- e.g. IDEALISTA, CASAFARI
  source_id               text          NOT NULL,     -- portal's own listing ID
  market                  text          NOT NULL,     -- country code e.g. PT, ES, FR
  city                    text          NOT NULL,
  property_type           text,
  size_sqm                numeric(10,2),
  asking_price_eur_cents  bigint        NOT NULL,     -- EUR cents (integer, never float)
  price_per_sqm_eur_cents bigint,
  listing_date            timestamptz,
  days_on_market          int,
  is_distressed           boolean       NOT NULL DEFAULT false,  -- bank-owned, auction, judicial
  confidence_score        numeric(4,3)  NOT NULL DEFAULT 0.5,    -- 0–1
  data_observed           jsonb         NOT NULL DEFAULT '{}',   -- fields from API (observed)
  data_inferred           jsonb         NOT NULL DEFAULT '{}',   -- computed fields (inferred)
  raw_payload             jsonb         NOT NULL DEFAULT '{}',   -- original API response
  ingested_at             timestamptz   NOT NULL DEFAULT now(),
  last_seen_at            timestamptz   NOT NULL DEFAULT now(),
  delisted_at             timestamptz,                           -- null = still active

  CONSTRAINT raw_opportunity_stream_source_source_id_key UNIQUE (source, source_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_raw_opp_tenant_market_price
  ON raw_opportunity_stream (tenant_id, market, asking_price_eur_cents);

CREATE INDEX IF NOT EXISTS idx_raw_opp_tenant_distressed_delisted
  ON raw_opportunity_stream (tenant_id, is_distressed, delisted_at);

CREATE INDEX IF NOT EXISTS idx_raw_opp_tenant_ingested
  ON raw_opportunity_stream (tenant_id, ingested_at DESC);

CREATE INDEX IF NOT EXISTS idx_raw_opp_confidence
  ON raw_opportunity_stream (confidence_score DESC);

CREATE INDEX IF NOT EXISTS idx_raw_opp_source_id
  ON raw_opportunity_stream (source, source_id);

-- RLS
ALTER TABLE raw_opportunity_stream ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON raw_opportunity_stream;
CREATE POLICY "tenant_isolation"
  ON raw_opportunity_stream
  USING (tenant_id = current_setting('app.tenant_id', true));

-- ─── ingestion_runs ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ingestion_runs (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id                text          NOT NULL,
  tenant_id             text          NOT NULL,
  providers_attempted   jsonb         NOT NULL DEFAULT '[]',  -- SupplyProvider[]
  providers_succeeded   jsonb         NOT NULL DEFAULT '[]',  -- SupplyProvider[]
  total_raw_records     int           NOT NULL DEFAULT 0,
  new_records           int           NOT NULL DEFAULT 0,
  updated_records       int           NOT NULL DEFAULT 0,
  errors                jsonb         NOT NULL DEFAULT '[]',  -- {provider, error}[]
  run_at                timestamptz   NOT NULL DEFAULT now(),
  duration_ms           int,

  CONSTRAINT ingestion_runs_run_id_key UNIQUE (run_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_tenant_run_at
  ON ingestion_runs (tenant_id, run_at DESC);

-- RLS
ALTER TABLE ingestion_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON ingestion_runs;
CREATE POLICY "tenant_isolation"
  ON ingestion_runs
  USING (tenant_id = current_setting('app.tenant_id', true));

-- ─── Comments ─────────────────────────────────────────────────────────────────

COMMENT ON TABLE raw_opportunity_stream IS
  'Central intake for all supply connectors (Idealista, Casafari, etc.). '
  'Each record represents one raw property listing as observed from a data source. '
  'data_observed = fields from API (observed fact). '
  'data_inferred = computed fields (e.g. price_per_sqm, days_on_market). '
  'Deduplication key: (source, source_id). '
  'confidence_score: 0.85 Idealista, 0.80 Casafari.';

COMMENT ON TABLE ingestion_runs IS
  'Audit trail for each ingestion cycle. One row per runIngestionCycle() call. '
  'Tracks which providers were attempted/succeeded, record counts, errors, and timing.';
