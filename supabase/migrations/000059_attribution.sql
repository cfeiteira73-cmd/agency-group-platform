-- Agency Group — Wave 40: System A3 Attribution & ROI Engine
-- supabase/migrations/000059_attribution.sql

CREATE TABLE IF NOT EXISTS attribution_touchpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  touchpoint_id text UNIQUE,
  tenant_id uuid NOT NULL,
  investor_id text NOT NULL,
  channel text NOT NULL,
  campaign_id text,
  occurred_at timestamptz DEFAULT now(),
  signal_type text,
  -- Legacy columns (from stub) preserved
  execution_id text,
  job_id text,
  event_type text,
  metadata jsonb DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_attribution_investor ON attribution_touchpoints(tenant_id, investor_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attribution_channel ON attribution_touchpoints(tenant_id, channel, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attribution_campaign ON attribution_touchpoints(tenant_id, campaign_id, occurred_at DESC);
ALTER TABLE attribution_touchpoints ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='attribution_touchpoints' AND policyname='tenant_isolation') THEN CREATE POLICY tenant_isolation ON attribution_touchpoints USING (tenant_id::text = current_setting('app.tenant_id', true)); END IF; END $$;

CREATE TABLE IF NOT EXISTS attribution_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  investor_id text NOT NULL,
  model text NOT NULL,
  capital_generated_eur_cents bigint DEFAULT 0,
  attribution_by_channel jsonb DEFAULT '{}',
  attributed_capital_by_channel jsonb DEFAULT '{}',
  touchpoints jsonb DEFAULT '[]',
  computed_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_attribution_results_investor ON attribution_results(tenant_id, investor_id, computed_at DESC);
ALTER TABLE attribution_results ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='attribution_results' AND policyname='tenant_isolation') THEN CREATE POLICY tenant_isolation ON attribution_results USING (tenant_id::text = current_setting('app.tenant_id', true)); END IF; END $$;

CREATE TABLE IF NOT EXISTS channel_attribution_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  channel text NOT NULL,
  model text NOT NULL,
  window_days integer DEFAULT 30,
  touchpoint_count integer DEFAULT 0,
  investor_count integer DEFAULT 0,
  total_attributed_capital_eur_cents bigint DEFAULT 0,
  avg_capital_per_touchpoint_eur_cents bigint DEFAULT 0,
  conversion_rate_pct numeric(5,2) DEFAULT 0,
  computed_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_channel_attr_tenant ON channel_attribution_summaries(tenant_id, channel, computed_at DESC);
ALTER TABLE channel_attribution_summaries ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='channel_attribution_summaries' AND policyname='tenant_isolation') THEN CREATE POLICY tenant_isolation ON channel_attribution_summaries USING (tenant_id::text = current_setting('app.tenant_id', true)); END IF; END $$;

CREATE TABLE IF NOT EXISTS campaign_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id text NOT NULL UNIQUE,
  tenant_id uuid NOT NULL,
  channel text,
  spend_eur_cents bigint NOT NULL DEFAULT 0,
  period_start timestamptz,
  period_end timestamptz,
  investors_targeted integer DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campaign_costs_tenant ON campaign_costs(tenant_id, period_start DESC);
ALTER TABLE campaign_costs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='campaign_costs' AND policyname='tenant_isolation') THEN CREATE POLICY tenant_isolation ON campaign_costs USING (tenant_id::text = current_setting('app.tenant_id', true)); END IF; END $$;

CREATE TABLE IF NOT EXISTS cac_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  period text,
  window_days integer DEFAULT 30,
  total_spend_eur_cents bigint DEFAULT 0,
  new_investors_acquired integer DEFAULT 0,
  cac_eur_cents bigint DEFAULT 0,
  channel_breakdown jsonb DEFAULT '[]',
  computed_at timestamptz DEFAULT now()
);
ALTER TABLE cac_metrics ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cac_metrics' AND policyname='tenant_isolation') THEN CREATE POLICY tenant_isolation ON cac_metrics USING (tenant_id::text = current_setting('app.tenant_id', true)); END IF; END $$;

CREATE TABLE IF NOT EXISTS ltv_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  investor_id text NOT NULL,
  first_activity_at timestamptz,
  total_capital_deployed_eur_cents bigint DEFAULT 0,
  total_commission_earned_eur_cents bigint DEFAULT 0,
  tenure_days integer DEFAULT 0,
  ltv_eur_cents bigint DEFAULT 0,
  ltv_per_day_eur_cents bigint DEFAULT 0,
  projected_12m_ltv_eur_cents bigint,
  computed_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, investor_id)
);
ALTER TABLE ltv_metrics ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ltv_metrics' AND policyname='tenant_isolation') THEN CREATE POLICY tenant_isolation ON ltv_metrics USING (tenant_id::text = current_setting('app.tenant_id', true)); END IF; END $$;

CREATE TABLE IF NOT EXISTS campaign_roi_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  campaign_id text NOT NULL,
  spend_eur_cents bigint DEFAULT 0,
  capital_generated_eur_cents bigint DEFAULT 0,
  commission_earned_eur_cents bigint DEFAULT 0,
  roi_multiple numeric(8,4) DEFAULT 0,
  roi_pct numeric(8,4) DEFAULT 0,
  investors_converted integer DEFAULT 0,
  cost_per_euro_capital numeric(8,6) DEFAULT 0,
  computed_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campaign_roi_tenant ON campaign_roi_results(tenant_id, computed_at DESC);
ALTER TABLE campaign_roi_results ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='campaign_roi_results' AND policyname='tenant_isolation') THEN CREATE POLICY tenant_isolation ON campaign_roi_results USING (tenant_id::text = current_setting('app.tenant_id', true)); END IF; END $$;

CREATE TABLE IF NOT EXISTS growth_kpi_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  computed_at timestamptz DEFAULT now(),
  window_days integer DEFAULT 30,
  capital_acquired_by_channel jsonb DEFAULT '{}',
  roi_by_campaign jsonb DEFAULT '[]',
  cac_vs_ltv jsonb DEFAULT '[]',
  capital_weighted_conversion_rate numeric(5,4) DEFAULT 0,
  overall_growth_score numeric(5,2) DEFAULT 0,
  growth_velocity text DEFAULT 'STABLE'
);
CREATE INDEX IF NOT EXISTS idx_growth_kpi_tenant ON growth_kpi_snapshots(tenant_id, computed_at DESC);
ALTER TABLE growth_kpi_snapshots ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='growth_kpi_snapshots' AND policyname='tenant_isolation') THEN CREATE POLICY tenant_isolation ON growth_kpi_snapshots USING (tenant_id::text = current_setting('app.tenant_id', true)); END IF; END $$;

-- roi_reports_full: stores assembled full ROI report snapshots
CREATE TABLE IF NOT EXISTS roi_reports_full (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  computed_at timestamptz DEFAULT now(),
  report_data jsonb DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_roi_reports_tenant ON roi_reports_full(tenant_id, computed_at DESC);
ALTER TABLE roi_reports_full ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='roi_reports_full' AND policyname='tenant_isolation') THEN CREATE POLICY tenant_isolation ON roi_reports_full USING (tenant_id::text = current_setting('app.tenant_id', true)); END IF; END $$;
