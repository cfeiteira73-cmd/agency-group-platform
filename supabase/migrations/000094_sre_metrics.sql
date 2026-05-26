-- 000094_sre_metrics.sql

CREATE TABLE IF NOT EXISTS slo_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  slo_id TEXT NOT NULL,
  current_value NUMERIC(6,3),
  status TEXT NOT NULL CHECK (status IN ('MEETING','AT_RISK','BREACHED','UNKNOWN')) DEFAULT 'UNKNOWN',
  error_budget_remaining_pct NUMERIC(6,2),
  measured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dr_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certification_id TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  certified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  overall_dr_grade TEXT NOT NULL DEFAULT 'DR_GAPS_FOUND',
  backup_check TEXT NOT NULL DEFAULT 'PENDING',
  dr_check TEXT NOT NULL DEFAULT 'PENDING',
  replay_check TEXT NOT NULL DEFAULT 'PENDING',
  multi_region_check TEXT NOT NULL DEFAULT 'PENDING',
  replay_events_total BIGINT NOT NULL DEFAULT 0,
  replay_rpo_minutes NUMERIC(6,2) NOT NULL DEFAULT 0,
  issues TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS alert_rule_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  metric TEXT NOT NULL,
  condition TEXT NOT NULL,
  threshold NUMERIC NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('INFO','WARNING','CRITICAL')) DEFAULT 'WARNING',
  notification_channels TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed essential alert rules
INSERT INTO alert_rule_definitions (rule_id, name, metric, condition, threshold, severity, notification_channels, is_active) VALUES
  ('api-error-rate-high', 'API Error Rate High', 'api_error_rate_pct', 'gt', 5.0, 'WARNING', '{"email","slack"}', true),
  ('api-error-rate-critical', 'API Error Rate Critical', 'api_error_rate_pct', 'gt', 15.0, 'CRITICAL', '{"pagerduty","email"}', true),
  ('anomaly-critical', 'Critical Anomaly Detected', 'active_anomalies', 'gt', 0, 'CRITICAL', '{"pagerduty"}', true),
  ('supply-stale', 'Supply Data Stale', 'supply_last_ingest_minutes_ago', 'gt', 1440, 'WARNING', '{"email"}', true),
  ('ml-drift-high', 'ML Drift High', 'ml_drift_score', 'gt', 0.2, 'WARNING', '{"email","slack"}', true),
  ('system-health-low', 'System Health Score Low', 'system_health_score', 'lt', 70, 'WARNING', '{"email","slack"}', true),
  ('system-health-critical', 'System Health Score Critical', 'system_health_score', 'lt', 50, 'CRITICAL', '{"pagerduty"}', true),
  ('escrow-integrity', 'Escrow Integrity Issue', 'escrow_state_violations', 'gt', 0, 'CRITICAL', '{"pagerduty","email"}', true)
ON CONFLICT (rule_id) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_slo_measurements_tenant ON slo_measurements(tenant_id, slo_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_dr_certifications_tenant ON dr_certifications(tenant_id, certified_at DESC);

-- RLS
ALTER TABLE slo_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE dr_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rule_definitions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='slo_measurements' AND policyname='service_role_slo') THEN
    CREATE POLICY "service_role_slo" ON slo_measurements FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='dr_certifications' AND policyname='service_role_dr_certs') THEN
    CREATE POLICY "service_role_dr_certs" ON dr_certifications FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='alert_rule_definitions' AND policyname='service_role_alert_rules') THEN
    CREATE POLICY "service_role_alert_rules" ON alert_rule_definitions FOR ALL USING (true);
  END IF;
END $$;
