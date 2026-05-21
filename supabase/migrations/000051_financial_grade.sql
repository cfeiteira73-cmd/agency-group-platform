-- Agency Group — Wave 38: Financial-Grade Execution Mode
-- 000051_financial_grade.sql
-- Creates 5 reporting tables for the SH-ROS financial intelligence system.

-- ─────────────────────────────────────────────────────────────────────────────
-- revenue_pipeline_reports
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS revenue_pipeline_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  generated_at timestamptz DEFAULT now(),
  active_deals integer DEFAULT 0,
  total_pipeline_value_eur numeric(15,2) DEFAULT 0,
  deals_closed_30d integer DEFAULT 0,
  revenue_realized_30d_eur numeric(15,2) DEFAULT 0,
  health text DEFAULT 'NORMAL',
  pipeline_stages jsonb DEFAULT '[]',
  velocity jsonb DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_revenue_pipeline_reports_tenant
  ON revenue_pipeline_reports(tenant_id, generated_at DESC);
ALTER TABLE revenue_pipeline_reports ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'revenue_pipeline_reports'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON revenue_pipeline_reports
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- capital_latency_metrics
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS capital_latency_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  generated_at timestamptz DEFAULT now(),
  avg_total_cycle_days numeric(8,2),
  p50_cycle_days numeric(8,2),
  p90_cycle_days numeric(8,2),
  bottleneck_stage text,
  bottleneck_avg_days numeric(8,2),
  raw_metrics jsonb DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_capital_latency_tenant
  ON capital_latency_metrics(tenant_id, generated_at DESC);
ALTER TABLE capital_latency_metrics ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'capital_latency_metrics'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON capital_latency_metrics
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- leak_reports
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leak_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  generated_at timestamptz DEFAULT now(),
  total_estimated_leakage_eur numeric(15,2) DEFAULT 0,
  worst_drop_stage text,
  overall_funnel_efficiency_pct numeric(5,2),
  drop_points jsonb DEFAULT '[]',
  recommendations jsonb DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_leak_reports_tenant
  ON leak_reports(tenant_id, generated_at DESC);
ALTER TABLE leak_reports ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'leak_reports'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON leak_reports
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- roi_reports
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roi_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  generated_at timestamptz DEFAULT now(),
  top_channel text,
  top_zone text,
  avg_roi_score numeric(8,2),
  by_channel jsonb DEFAULT '[]',
  by_zone jsonb DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_roi_reports_tenant
  ON roi_reports(tenant_id, generated_at DESC);
ALTER TABLE roi_reports ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'roi_reports'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON roi_reports
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- cashflow_forecasts
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cashflow_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  generated_at timestamptz DEFAULT now(),
  forecast_horizon_days integer DEFAULT 90,
  current_pipeline_value_eur numeric(15,2) DEFAULT 0,
  historical_conversion_rate_pct numeric(5,2),
  total_90d_projected_eur numeric(15,2) DEFAULT 0,
  forecast_confidence text DEFAULT 'LOW',
  projections jsonb DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_cashflow_forecasts_tenant
  ON cashflow_forecasts(tenant_id, generated_at DESC);
ALTER TABLE cashflow_forecasts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'cashflow_forecasts'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON cashflow_forecasts
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;
