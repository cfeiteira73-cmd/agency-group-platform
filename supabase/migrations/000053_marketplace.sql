-- Agency Group — Wave 39: Marketplace Infrastructure
-- 000053_marketplace.sql
-- BID COMPETITION ENGINE + PRICE DISCOVERY tables

-- asset_bids: competitive bid registry
CREATE TABLE IF NOT EXISTS asset_bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id text NOT NULL UNIQUE,
  tenant_id uuid NOT NULL,
  asset_id text NOT NULL,
  investor_id text NOT NULL,
  amount_eur_cents bigint NOT NULL,
  max_amount_eur_cents bigint NOT NULL,
  bid_status text NOT NULL DEFAULT 'PENDING',
  win_probability numeric(5,4) DEFAULT 0,
  submitted_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  notes text,
  metadata jsonb DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_asset_bids_asset ON asset_bids(tenant_id, asset_id, bid_status);
CREATE INDEX IF NOT EXISTS idx_asset_bids_investor ON asset_bids(tenant_id, investor_id, bid_status);
ALTER TABLE asset_bids ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='asset_bids' AND policyname='tenant_isolation') THEN CREATE POLICY tenant_isolation ON asset_bids USING (tenant_id::text = current_setting('app.tenant_id', true)); END IF; END $$;

-- price_discovery_records: market price history
CREATE TABLE IF NOT EXISTS price_discovery_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  asset_id text NOT NULL,
  listed_price_eur_cents bigint,
  market_price_eur_cents bigint,
  price_premium_pct numeric(8,4),
  confidence text,
  drivers jsonb DEFAULT '[]',
  computed_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_price_discovery_asset ON price_discovery_records(tenant_id, asset_id, computed_at DESC);
ALTER TABLE price_discovery_records ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='price_discovery_records' AND policyname='tenant_isolation') THEN CREATE POLICY tenant_isolation ON price_discovery_records USING (tenant_id::text = current_setting('app.tenant_id', true)); END IF; END $$;

-- asset_liquidity_scores: per-asset liquidity snapshots
CREATE TABLE IF NOT EXISTS asset_liquidity_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  asset_id text NOT NULL,
  score numeric(5,2),
  tier text,
  active_bids integer DEFAULT 0,
  total_bid_capital_eur_cents bigint DEFAULT 0,
  coverage_ratio numeric(8,4),
  time_to_execution_days_p50 numeric(8,2),
  time_to_execution_days_p90 numeric(8,2),
  computed_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_asset_liquidity_asset ON asset_liquidity_scores(tenant_id, asset_id, computed_at DESC);
ALTER TABLE asset_liquidity_scores ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='asset_liquidity_scores' AND policyname='tenant_isolation') THEN CREATE POLICY tenant_isolation ON asset_liquidity_scores USING (tenant_id::text = current_setting('app.tenant_id', true)); END IF; END $$;

-- liquidity_reports: market-wide liquidity snapshots
CREATE TABLE IF NOT EXISTS liquidity_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  generated_at timestamptz DEFAULT now(),
  assets_analyzed integer DEFAULT 0,
  liquid_assets integer DEFAULT 0,
  illiquid_assets integer DEFAULT 0,
  total_bid_capital_eur_cents bigint DEFAULT 0,
  avg_liquidity_score numeric(5,2),
  hot_assets jsonb DEFAULT '[]',
  starved_assets jsonb DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_liquidity_reports_tenant ON liquidity_reports(tenant_id, generated_at DESC);
ALTER TABLE liquidity_reports ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='liquidity_reports' AND policyname='tenant_isolation') THEN CREATE POLICY tenant_isolation ON liquidity_reports USING (tenant_id::text = current_setting('app.tenant_id', true)); END IF; END $$;
