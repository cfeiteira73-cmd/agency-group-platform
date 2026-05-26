-- Agency Group — Proprietary Data Layer
-- supabase/migrations/000080_proprietary_data.sql
-- Wave 43: Time-to-Close, Discount Data, Investor Behavior, LVI
-- All tables: RLS, tenant_isolation, indexes

-- ============================================================================
-- 1. time_to_close_records
-- ============================================================================
CREATE TABLE IF NOT EXISTS time_to_close_records (
  id                           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id                    text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  tenant_id                    text NOT NULL,
  asset_id                     text NOT NULL,
  opportunity_id               text,
  market                       text NOT NULL,
  city                         text NOT NULL DEFAULT '',
  property_type                text NOT NULL,
  price_band                   text NOT NULL,
  days_listing_to_first_bid    int,
  days_first_bid_to_accepted   int,
  days_accepted_to_cpcv        int,
  days_cpcv_to_escritura       int,
  days_total_listing_to_close  int NOT NULL CHECK (days_total_listing_to_close >= 0),
  asking_price_eur_cents       bigint NOT NULL DEFAULT 0,
  final_price_eur_cents        bigint NOT NULL DEFAULT 0,
  discount_from_asking_pct     numeric(8,4) NOT NULL DEFAULT 0,
  bid_count                    int NOT NULL DEFAULT 0,
  was_distressed               boolean NOT NULL DEFAULT false,
  source                       text NOT NULL,
  recorded_at                  timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE time_to_close_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "time_to_close_records_tenant_isolation" ON time_to_close_records;
CREATE POLICY "time_to_close_records_tenant_isolation"
  ON time_to_close_records
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ttc_tenant_market
  ON time_to_close_records (tenant_id, market);

CREATE INDEX IF NOT EXISTS idx_ttc_market_property_band
  ON time_to_close_records (market, property_type, price_band);

CREATE INDEX IF NOT EXISTS idx_ttc_recorded_at
  ON time_to_close_records (recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_ttc_asset_id
  ON time_to_close_records (asset_id);

-- ============================================================================
-- 2. discount_data_points
-- ============================================================================
CREATE TABLE IF NOT EXISTS discount_data_points (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_id                   text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  tenant_id                 text NOT NULL,
  market                    text NOT NULL,
  city                      text NOT NULL DEFAULT '',
  property_type             text NOT NULL,
  asking_price_eur_cents    bigint NOT NULL DEFAULT 0,
  final_price_eur_cents     bigint NOT NULL DEFAULT 0,
  discount_pct              numeric(8,4) NOT NULL DEFAULT 0,
  days_on_market            int NOT NULL DEFAULT 0,
  was_distressed            boolean NOT NULL DEFAULT false,
  bid_count                 int NOT NULL DEFAULT 0,
  price_band                text NOT NULL DEFAULT '',
  source                    text NOT NULL DEFAULT '',
  recorded_at               timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE discount_data_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "discount_data_points_tenant_isolation" ON discount_data_points;
CREATE POLICY "discount_data_points_tenant_isolation"
  ON discount_data_points
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ddp_tenant_market
  ON discount_data_points (tenant_id, market);

CREATE INDEX IF NOT EXISTS idx_ddp_market_property
  ON discount_data_points (market, property_type);

CREATE INDEX IF NOT EXISTS idx_ddp_recorded_at
  ON discount_data_points (recorded_at DESC);

-- ============================================================================
-- 3. investor_behavior_profiles
-- ============================================================================
CREATE TABLE IF NOT EXISTS investor_behavior_profiles (
  id                                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id                          text UNIQUE NOT NULL,
  tenant_id                           text NOT NULL,
  investor_id                         text UNIQUE NOT NULL,
  avg_time_to_decision_days           int,
  preferred_opportunity_types         jsonb NOT NULL DEFAULT '[]',
  preferred_markets                   jsonb NOT NULL DEFAULT '[]',
  preferred_price_bands               jsonb NOT NULL DEFAULT '[]',
  total_opportunities_viewed          int NOT NULL DEFAULT 0,
  total_bids_placed                   int NOT NULL DEFAULT 0,
  total_deals_closed                  int NOT NULL DEFAULT 0,
  bid_to_view_ratio                   numeric(6,4) NOT NULL DEFAULT 0,
  close_to_bid_ratio                  numeric(6,4) NOT NULL DEFAULT 0,
  avg_bid_vs_asking_pct               numeric(6,2),
  avg_deal_size_eur_cents             bigint,
  total_capital_deployed_eur_cents    bigint NOT NULL DEFAULT 0,
  avg_roi_realized_pct                numeric(6,3),
  is_price_sensitive                  boolean NOT NULL DEFAULT false,
  is_speed_buyer                      boolean NOT NULL DEFAULT false,
  is_distressed_specialist            boolean NOT NULL DEFAULT false,
  computed_at                         timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE investor_behavior_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "investor_behavior_profiles_tenant_isolation" ON investor_behavior_profiles;
CREATE POLICY "investor_behavior_profiles_tenant_isolation"
  ON investor_behavior_profiles
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ibp_tenant_id
  ON investor_behavior_profiles (tenant_id);

CREATE INDEX IF NOT EXISTS idx_ibp_investor_id
  ON investor_behavior_profiles (investor_id);

CREATE INDEX IF NOT EXISTS idx_ibp_computed_at
  ON investor_behavior_profiles (computed_at DESC);

-- ============================================================================
-- 4. liquidity_velocity_index
-- ============================================================================
CREATE TABLE IF NOT EXISTS liquidity_velocity_index (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lvi_id                      text UNIQUE NOT NULL,
  tenant_id                   text NOT NULL,
  market                      text NOT NULL,
  period                      text NOT NULL,
  lvi_score                   numeric(5,2) NOT NULL DEFAULT 0,
  capital_turnover_rate       numeric(6,4) NOT NULL DEFAULT 0,
  deal_velocity               int NOT NULL DEFAULT 0,
  bid_velocity                numeric(6,3) NOT NULL DEFAULT 0,
  price_discovery_speed_days  numeric(8,2) NOT NULL DEFAULT 0,
  lvi_change_pct              numeric(8,4),
  velocity_trend              text NOT NULL DEFAULT 'STABLE',
  active_listings             int NOT NULL DEFAULT 0,
  active_investors            int NOT NULL DEFAULT 0,
  sha256_hash                 text NOT NULL DEFAULT '',
  computed_at                 timestamptz NOT NULL DEFAULT now(),
  UNIQUE (market, period, tenant_id)
);

-- RLS
ALTER TABLE liquidity_velocity_index ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "liquidity_velocity_index_tenant_isolation" ON liquidity_velocity_index;
CREATE POLICY "liquidity_velocity_index_tenant_isolation"
  ON liquidity_velocity_index
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lvi_tenant_market
  ON liquidity_velocity_index (tenant_id, market);

CREATE INDEX IF NOT EXISTS idx_lvi_market_period
  ON liquidity_velocity_index (market, period DESC);

CREATE INDEX IF NOT EXISTS idx_lvi_computed_at
  ON liquidity_velocity_index (computed_at DESC);

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON TABLE time_to_close_records IS 'Wave 43: Proprietary time-to-close analytics dataset';
COMMENT ON TABLE discount_data_points IS 'Wave 43: Proprietary discount vs listing price dataset';
COMMENT ON TABLE investor_behavior_profiles IS 'Wave 43: Proprietary investor behavior analytics';
COMMENT ON TABLE liquidity_velocity_index IS 'Wave 43: Liquidity Velocity Index — proprietary market velocity metric';
