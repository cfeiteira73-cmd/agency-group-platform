CREATE TABLE IF NOT EXISTS market_intelligence_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id text NOT NULL,
  tenant_id uuid NOT NULL,
  country text NOT NULL,
  city text NOT NULL,
  zone text,
  active_assets integer DEFAULT 0,
  active_bids integer DEFAULT 0,
  avg_bid_amount_eur_cents bigint DEFAULT 0,
  bid_pressure numeric(8,4) DEFAULT 0,
  capital_inflow_30d_eur_cents bigint DEFAULT 0,
  avg_roi_pct numeric(8,4) DEFAULT 0,
  investor_count integer DEFAULT 0,
  competition_intensity numeric(5,4) DEFAULT 0,
  liquidity_score numeric(5,2) DEFAULT 0,
  avg_days_to_close numeric(8,2),
  analyzed_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_market_intelligence_tenant ON market_intelligence_snapshots(tenant_id, country, city, analyzed_at DESC);
ALTER TABLE market_intelligence_snapshots ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='market_intelligence_snapshots' AND policyname='tenant_isolation') THEN CREATE POLICY tenant_isolation ON market_intelligence_snapshots USING (tenant_id::text = current_setting('app.tenant_id', true)); END IF; END $$;

CREATE TABLE IF NOT EXISTS market_intelligence_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  generated_at timestamptz DEFAULT now(),
  markets_analyzed integer DEFAULT 0,
  total_capital_in_market_eur_cents bigint DEFAULT 0,
  global_avg_roi_pct numeric(8,4) DEFAULT 0,
  top_markets jsonb DEFAULT '[]',
  emerging_markets jsonb DEFAULT '[]',
  cold_markets jsonb DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_market_intelligence_reports ON market_intelligence_reports(tenant_id, generated_at DESC);
ALTER TABLE market_intelligence_reports ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='market_intelligence_reports' AND policyname='tenant_isolation') THEN CREATE POLICY tenant_isolation ON market_intelligence_reports USING (tenant_id::text = current_setting('app.tenant_id', true)); END IF; END $$;

CREATE TABLE IF NOT EXISTS market_selection_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  generated_at timestamptz DEFAULT now(),
  markets_scored integer DEFAULT 0,
  priority_1_markets jsonb DEFAULT '[]',
  priority_2_markets jsonb DEFAULT '[]',
  recommended_expansion_order jsonb DEFAULT '[]',
  total_addressable_capital_eur_cents bigint DEFAULT 0,
  expansion_budget_suggestion_eur_cents bigint DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_market_selection_reports ON market_selection_reports(tenant_id, generated_at DESC);
ALTER TABLE market_selection_reports ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='market_selection_reports' AND policyname='tenant_isolation') THEN CREATE POLICY tenant_isolation ON market_selection_reports USING (tenant_id::text = current_setting('app.tenant_id', true)); END IF; END $$;

CREATE TABLE IF NOT EXISTS supply_demand_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id text NOT NULL UNIQUE,
  tenant_id uuid NOT NULL,
  country text NOT NULL,
  city text NOT NULL,
  signal_type text NOT NULL,
  severity text NOT NULL DEFAULT 'MEDIUM',
  capital_surplus_eur_cents bigint,
  asset_deficit integer,
  opportunity_score numeric(5,2) DEFAULT 0,
  recommended_action text,
  detected_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_supply_demand_tenant ON supply_demand_signals(tenant_id, severity, detected_at DESC);
ALTER TABLE supply_demand_signals ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='supply_demand_signals' AND policyname='tenant_isolation') THEN CREATE POLICY tenant_isolation ON supply_demand_signals USING (tenant_id::text = current_setting('app.tenant_id', true)); END IF; END $$;
