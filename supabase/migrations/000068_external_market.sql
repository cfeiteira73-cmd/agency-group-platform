-- =============================================================================
-- Agency Group — External Market Data Tables
-- Migration: 000068_external_market.sql
--
-- Tables: external_price_benchmarks, credit_rate_data, price_comparisons,
--         market_externalization_reports, external_closing_records,
--         arbitrage_opportunities, market_data_refresh_logs
--
-- All tables: IF NOT EXISTS, RLS, tenant_isolation, indexes
-- =============================================================================

-- ─── 1. external_price_benchmarks ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS external_price_benchmarks (
  id                           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  benchmark_id                 text UNIQUE NOT NULL,
  tenant_id                    text NOT NULL,
  country                      text NOT NULL,
  city                         text NOT NULL,
  district                     text,
  property_type                text NOT NULL DEFAULT 'RESIDENTIAL',
  price_per_sqm_eur_cents      bigint NOT NULL,
  median_transaction_eur_cents bigint NOT NULL DEFAULT 0,
  transaction_volume           int NOT NULL DEFAULT 0,
  period_start                 timestamptz NOT NULL,
  period_end                   timestamptz NOT NULL,
  source                       text NOT NULL,
  source_url                   text,
  fetched_at                   timestamptz NOT NULL DEFAULT now(),
  is_official                  boolean NOT NULL DEFAULT false
);

ALTER TABLE external_price_benchmarks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'external_price_benchmarks'
      AND policyname = 'tenant_isolation_external_price_benchmarks'
  ) THEN
    CREATE POLICY tenant_isolation_external_price_benchmarks
      ON external_price_benchmarks
      USING (tenant_id = current_setting('app.tenant_id', true));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_epb_tenant_city
  ON external_price_benchmarks (tenant_id, country, city);

CREATE INDEX IF NOT EXISTS idx_epb_fetched_at
  ON external_price_benchmarks (fetched_at DESC);

CREATE INDEX IF NOT EXISTS idx_epb_source
  ON external_price_benchmarks (source);

-- ─── 2. credit_rate_data ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS credit_rate_data (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_id        text UNIQUE NOT NULL,
  tenant_id      text NOT NULL,
  bank_name      text NOT NULL,
  rate_type      text NOT NULL,
  rate_pct       numeric(6,4) NOT NULL,
  effective_date timestamptz NOT NULL,
  source         text NOT NULL,
  fetched_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE credit_rate_data ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'credit_rate_data'
      AND policyname = 'tenant_isolation_credit_rate_data'
  ) THEN
    CREATE POLICY tenant_isolation_credit_rate_data
      ON credit_rate_data
      USING (tenant_id = current_setting('app.tenant_id', true));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_crd_tenant_type
  ON credit_rate_data (tenant_id, rate_type);

CREATE INDEX IF NOT EXISTS idx_crd_fetched_at
  ON credit_rate_data (fetched_at DESC);

-- ─── 3. price_comparisons ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS price_comparisons (
  id                                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comparison_id                     text UNIQUE NOT NULL,
  tenant_id                         text NOT NULL,
  asset_id                          text,
  country                           text NOT NULL,
  city                              text NOT NULL,
  system_price_per_sqm_eur_cents    bigint NOT NULL,
  external_price_per_sqm_eur_cents  bigint NOT NULL,
  gap_pct                           numeric(8,4) NOT NULL DEFAULT 0,
  gap_direction                     text NOT NULL DEFAULT 'ALIGNED',
  arbitrage_opportunity             boolean NOT NULL DEFAULT false,
  arbitrage_eur_cents               bigint,
  compared_at                       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE price_comparisons ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'price_comparisons'
      AND policyname = 'tenant_isolation_price_comparisons'
  ) THEN
    CREATE POLICY tenant_isolation_price_comparisons
      ON price_comparisons
      USING (tenant_id = current_setting('app.tenant_id', true));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pc_tenant_asset
  ON price_comparisons (tenant_id, asset_id);

CREATE INDEX IF NOT EXISTS idx_pc_arbitrage
  ON price_comparisons (tenant_id, arbitrage_opportunity)
  WHERE arbitrage_opportunity = true;

CREATE INDEX IF NOT EXISTS idx_pc_compared_at
  ON price_comparisons (compared_at DESC);

CREATE INDEX IF NOT EXISTS idx_pc_gap_direction
  ON price_comparisons (tenant_id, gap_direction);

-- ─── 4. market_externalization_reports ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS market_externalization_reports (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id               text UNIQUE NOT NULL,
  tenant_id               text NOT NULL,
  total_comparisons       int NOT NULL DEFAULT 0,
  aligned_count           int NOT NULL DEFAULT 0,
  overpriced_count        int NOT NULL DEFAULT 0,
  underpriced_count       int NOT NULL DEFAULT 0,
  arbitrage_opportunities int NOT NULL DEFAULT 0,
  avg_gap_pct             numeric(8,4) NOT NULL DEFAULT 0,
  max_gap_pct             numeric(8,4) NOT NULL DEFAULT 0,
  recommendations         jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE market_externalization_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'market_externalization_reports'
      AND policyname = 'tenant_isolation_market_externalization_reports'
  ) THEN
    CREATE POLICY tenant_isolation_market_externalization_reports
      ON market_externalization_reports
      USING (tenant_id = current_setting('app.tenant_id', true));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mer_tenant
  ON market_externalization_reports (tenant_id);

CREATE INDEX IF NOT EXISTS idx_mer_generated_at
  ON market_externalization_reports (generated_at DESC);

-- ─── 5. external_closing_records ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS external_closing_records (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               text NOT NULL,
  asset_id                text NOT NULL,
  actual_price_eur_cents  bigint NOT NULL,
  actual_sqm              int NOT NULL DEFAULT 0,
  closed_at               timestamptz NOT NULL,
  source                  text NOT NULL,
  injected_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE external_closing_records ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'external_closing_records'
      AND policyname = 'tenant_isolation_external_closing_records'
  ) THEN
    CREATE POLICY tenant_isolation_external_closing_records
      ON external_closing_records
      USING (tenant_id = current_setting('app.tenant_id', true));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ecr_tenant_asset
  ON external_closing_records (tenant_id, asset_id);

CREATE INDEX IF NOT EXISTS idx_ecr_closed_at
  ON external_closing_records (closed_at DESC);

-- ─── 6. arbitrage_opportunities ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS arbitrage_opportunities (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id            text UNIQUE NOT NULL,
  tenant_id                 text NOT NULL,
  asset_id                  text,
  country                   text NOT NULL,
  city                      text NOT NULL,
  opportunity_type          text NOT NULL,
  system_price_eur_cents    bigint NOT NULL,
  market_price_eur_cents    bigint NOT NULL,
  estimated_gain_eur_cents  bigint NOT NULL,
  confidence_score          numeric(4,3) NOT NULL DEFAULT 0,
  expires_at                timestamptz NOT NULL,
  status                    text NOT NULL DEFAULT 'ACTIVE',
  detected_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE arbitrage_opportunities ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'arbitrage_opportunities'
      AND policyname = 'tenant_isolation_arbitrage_opportunities'
  ) THEN
    CREATE POLICY tenant_isolation_arbitrage_opportunities
      ON arbitrage_opportunities
      USING (tenant_id = current_setting('app.tenant_id', true));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ao_tenant_status
  ON arbitrage_opportunities (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_ao_active
  ON arbitrage_opportunities (tenant_id, detected_at DESC)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_ao_expires_at
  ON arbitrage_opportunities (expires_at)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_ao_asset
  ON arbitrage_opportunities (asset_id)
  WHERE asset_id IS NOT NULL;

-- ─── 7. market_data_refresh_logs ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS market_data_refresh_logs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           text NOT NULL,
  benchmarks_updated  int NOT NULL DEFAULT 0,
  rates_updated       int NOT NULL DEFAULT 0,
  refreshed_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE market_data_refresh_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'market_data_refresh_logs'
      AND policyname = 'tenant_isolation_market_data_refresh_logs'
  ) THEN
    CREATE POLICY tenant_isolation_market_data_refresh_logs
      ON market_data_refresh_logs
      USING (tenant_id = current_setting('app.tenant_id', true));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mdrl_tenant
  ON market_data_refresh_logs (tenant_id);

CREATE INDEX IF NOT EXISTS idx_mdrl_refreshed_at
  ON market_data_refresh_logs (refreshed_at DESC);
