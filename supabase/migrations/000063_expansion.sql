CREATE TABLE IF NOT EXISTS migration_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id text NOT NULL UNIQUE,
  tenant_id uuid NOT NULL,
  investor_id text NOT NULL,
  current_market text,
  target_market text NOT NULL,
  reason text,
  incentive_type text,
  expected_capital_migration_eur_cents bigint DEFAULT 0,
  probability numeric(5,4) DEFAULT 0,
  generated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_migration_opportunities_tenant ON migration_opportunities(tenant_id, target_market, generated_at DESC);
ALTER TABLE migration_opportunities ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='migration_opportunities' AND policyname='tenant_isolation') THEN CREATE POLICY tenant_isolation ON migration_opportunities USING (tenant_id::text = current_setting('app.tenant_id', true)); END IF; END $$;

CREATE TABLE IF NOT EXISTS migration_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id text NOT NULL UNIQUE,
  tenant_id uuid NOT NULL,
  target_market text NOT NULL,
  target_segment text,
  migration_opportunities integer DEFAULT 0,
  total_capital_target_eur_cents bigint DEFAULT 0,
  launch_status text DEFAULT 'PLANNED',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE migration_campaigns ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='migration_campaigns' AND policyname='tenant_isolation') THEN CREATE POLICY tenant_isolation ON migration_campaigns USING (tenant_id::text = current_setting('app.tenant_id', true)); END IF; END $$;

CREATE TABLE IF NOT EXISTS expansion_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id text NOT NULL UNIQUE,
  tenant_id uuid NOT NULL,
  country text NOT NULL,
  city text NOT NULL,
  phase text NOT NULL DEFAULT 'RESEARCH',
  target_investor_count integer DEFAULT 5,
  target_capital_eur_cents bigint DEFAULT 0,
  target_liquidity_score numeric(5,2) DEFAULT 40,
  campaigns_launched jsonb DEFAULT '[]',
  milestones jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expansion_plans_tenant ON expansion_plans(tenant_id, phase, updated_at DESC);
ALTER TABLE expansion_plans ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='expansion_plans' AND policyname='tenant_isolation') THEN CREATE POLICY tenant_isolation ON expansion_plans USING (tenant_id::text = current_setting('app.tenant_id', true)); END IF; END $$;

CREATE TABLE IF NOT EXISTS network_effect_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  measured_at timestamptz DEFAULT now(),
  investor_count integer DEFAULT 0,
  avg_liquidity_score numeric(5,2) DEFAULT 0,
  avg_roi_pct numeric(8,4) DEFAULT 0,
  total_capital_deployed_eur_cents bigint DEFAULT 0,
  geographic_coverage integer DEFAULT 0,
  network_effect_score numeric(5,2) DEFAULT 0,
  network_effect_stage text DEFAULT 'SPARK',
  virtuous_cycle_active boolean DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_network_effect_tenant ON network_effect_snapshots(tenant_id, measured_at DESC);
ALTER TABLE network_effect_snapshots ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='network_effect_snapshots' AND policyname='tenant_isolation') THEN CREATE POLICY tenant_isolation ON network_effect_snapshots USING (tenant_id::text = current_setting('app.tenant_id', true)); END IF; END $$;

CREATE TABLE IF NOT EXISTS network_effect_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  generated_at timestamptz DEFAULT now(),
  growth_rate_pct numeric(8,4) DEFAULT 0,
  moat_strength text DEFAULT 'NASCENT',
  key_drivers jsonb DEFAULT '[]',
  amplification_recommendations jsonb DEFAULT '[]',
  history_30d jsonb DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_network_effect_reports ON network_effect_reports(tenant_id, generated_at DESC);
ALTER TABLE network_effect_reports ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='network_effect_reports' AND policyname='tenant_isolation') THEN CREATE POLICY tenant_isolation ON network_effect_reports USING (tenant_id::text = current_setting('app.tenant_id', true)); END IF; END $$;
