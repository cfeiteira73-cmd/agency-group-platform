-- Wave 54 Phase 1+2 — Reality Monitor + System Health Dashboard

CREATE TABLE IF NOT EXISTS reality_monitor_snapshots (
  id bigserial PRIMARY KEY,
  report_id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  reality_score numeric(5,2) NOT NULL DEFAULT 0,
  system_health_score numeric(5,2) NOT NULL DEFAULT 0,
  operational_readiness_score numeric(5,2) NOT NULL DEFAULT 0,
  pass_count integer NOT NULL DEFAULT 0,
  warn_count integer NOT NULL DEFAULT 0,
  fail_count integer NOT NULL DEFAULT 0,
  total_checks integer NOT NULL DEFAULT 0,
  blockers jsonb NOT NULL DEFAULT '[]',
  monitor_hash text NOT NULL,
  report_json jsonb NOT NULL DEFAULT '{}',
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE reality_monitor_snapshots ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reality_monitor_snapshots' AND policyname='service_role_all') THEN CREATE POLICY service_role_all ON reality_monitor_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
CREATE INDEX IF NOT EXISTS idx_reality_mon_tenant ON reality_monitor_snapshots (tenant_id);
CREATE INDEX IF NOT EXISTS idx_reality_mon_score  ON reality_monitor_snapshots (operational_readiness_score DESC);
CREATE INDEX IF NOT EXISTS idx_reality_mon_date   ON reality_monitor_snapshots (generated_at DESC);

CREATE TABLE IF NOT EXISTS system_health_dashboards (
  id bigserial PRIMARY KEY,
  dashboard_id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  overall_health text NOT NULL DEFAULT 'UNKNOWN',
  health_score numeric(5,2) NOT NULL DEFAULT 0,
  reality_score numeric(5,2) NOT NULL DEFAULT 0,
  service_count integer NOT NULL DEFAULT 0,
  healthy_count integer NOT NULL DEFAULT 0,
  degraded_count integer NOT NULL DEFAULT 0,
  down_count integer NOT NULL DEFAULT 0,
  alert_score numeric(5,2) NOT NULL DEFAULT 0,
  dashboard_hash text NOT NULL,
  report_json jsonb NOT NULL DEFAULT '{}',
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE system_health_dashboards ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='system_health_dashboards' AND policyname='service_role_all') THEN CREATE POLICY service_role_all ON system_health_dashboards FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
CREATE INDEX IF NOT EXISTS idx_health_dash_tenant ON system_health_dashboards (tenant_id);
CREATE INDEX IF NOT EXISTS idx_health_dash_date   ON system_health_dashboards (generated_at DESC);
