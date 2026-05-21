-- Agency Group — Wave 40 Growth Optimization Tables
-- Migration: 000061_growth_optimization.sql
-- System A5+A6: AI Growth Optimizer + Closed Loop Growth System

CREATE TABLE IF NOT EXISTS optimization_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id text NOT NULL UNIQUE,
  tenant_id uuid NOT NULL,
  decision_type text NOT NULL,
  rationale text,
  expected_capital_impact_eur_cents bigint DEFAULT 0,
  confidence numeric(5,4) DEFAULT 0,
  action_payload jsonb DEFAULT '{}',
  executed boolean DEFAULT false,
  generated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_optimization_decisions_tenant ON optimization_decisions(tenant_id, executed, generated_at DESC);
ALTER TABLE optimization_decisions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='optimization_decisions' AND policyname='tenant_isolation') THEN CREATE POLICY tenant_isolation ON optimization_decisions USING (tenant_id::text = current_setting('app.tenant_id', true)); END IF; END $$;

CREATE TABLE IF NOT EXISTS optimization_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id text NOT NULL UNIQUE,
  tenant_id uuid NOT NULL,
  run_at timestamptz DEFAULT now(),
  signals_analyzed integer DEFAULT 0,
  decisions_made integer DEFAULT 0,
  decisions_executed integer DEFAULT 0,
  projected_capital_uplift_eur_cents bigint DEFAULT 0,
  next_cycle_in_hours integer DEFAULT 24
);
CREATE INDEX IF NOT EXISTS idx_optimization_cycles_tenant ON optimization_cycles(tenant_id, run_at DESC);
ALTER TABLE optimization_cycles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='optimization_cycles' AND policyname='tenant_isolation') THEN CREATE POLICY tenant_isolation ON optimization_cycles USING (tenant_id::text = current_setting('app.tenant_id', true)); END IF; END $$;

CREATE TABLE IF NOT EXISTS closed_loop_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  measured_at timestamptz DEFAULT now(),
  loop_efficiency_pct numeric(5,2) DEFAULT 0,
  loop_velocity_score numeric(5,2) DEFAULT 0,
  stages jsonb DEFAULT '[]',
  weakest_stage text,
  strongest_stage text,
  projected_loop_acceleration numeric(8,4) DEFAULT 0,
  loop_status text DEFAULT 'STABLE',
  recommendations jsonb DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_closed_loop_tenant ON closed_loop_snapshots(tenant_id, measured_at DESC);
ALTER TABLE closed_loop_snapshots ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='closed_loop_snapshots' AND policyname='tenant_isolation') THEN CREATE POLICY tenant_isolation ON closed_loop_snapshots USING (tenant_id::text = current_setting('app.tenant_id', true)); END IF; END $$;

CREATE TABLE IF NOT EXISTS reinvestment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  generated_at timestamptz DEFAULT now(),
  total_revenue_eur_cents bigint DEFAULT 0,
  suggested_reinvestment_eur_cents bigint DEFAULT 0,
  reinvestment_pct numeric(5,2) DEFAULT 20,
  allocation jsonb DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_reinvestment_plans_tenant ON reinvestment_plans(tenant_id, generated_at DESC);
ALTER TABLE reinvestment_plans ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reinvestment_plans' AND policyname='tenant_isolation') THEN CREATE POLICY tenant_isolation ON reinvestment_plans USING (tenant_id::text = current_setting('app.tenant_id', true)); END IF; END $$;

CREATE TABLE IF NOT EXISTS growth_dashboard_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  generated_at timestamptz DEFAULT now(),
  capital_acquired_today_eur_cents bigint DEFAULT 0,
  capital_acquired_30d_eur_cents bigint DEFAULT 0,
  active_campaigns integer DEFAULT 0,
  growth_score numeric(5,2) DEFAULT 0,
  loop_status text DEFAULT 'STABLE',
  flywheel_velocity text DEFAULT 'STABLE',
  alerts jsonb DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_growth_dashboard_tenant ON growth_dashboard_snapshots(tenant_id, generated_at DESC);
ALTER TABLE growth_dashboard_snapshots ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='growth_dashboard_snapshots' AND policyname='tenant_isolation') THEN CREATE POLICY tenant_isolation ON growth_dashboard_snapshots USING (tenant_id::text = current_setting('app.tenant_id', true)); END IF; END $$;
