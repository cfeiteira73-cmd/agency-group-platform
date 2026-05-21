-- 000046: Dashboard Health, Performance, Security and UX reports

CREATE TABLE IF NOT EXISTS system_health_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  issues JSONB NOT NULL DEFAULT '{"critical":[],"high":[],"medium":[],"low":[]}',
  counts JSONB NOT NULL DEFAULT '{}',
  health_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'CRITICAL',
  top_3_critical_actions JSONB NOT NULL DEFAULT '[]',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dashboard_security_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  vulnerabilities_found JSONB NOT NULL DEFAULT '{}',
  tenant_isolation_status JSONB NOT NULL DEFAULT '{}',
  rbac_integrity_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  security_posture TEXT NOT NULL DEFAULT 'WEAK',
  pentest_summary JSONB NOT NULL DEFAULT '{}',
  hardening_status JSONB NOT NULL DEFAULT '{}',
  overall_security_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ux_optimization_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  friction_points JSONB NOT NULL DEFAULT '[]',
  conversion_bottlenecks JSONB NOT NULL DEFAULT '[]',
  ui_simplifications JSONB NOT NULL DEFAULT '[]',
  dead_sections JSONB NOT NULL DEFAULT '[]',
  hot_sections JSONB NOT NULL DEFAULT '[]',
  ux_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS final_system_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  system_status TEXT NOT NULL DEFAULT 'CRITICAL',
  errors_count INTEGER NOT NULL DEFAULT 0,
  ready_for_scale BOOLEAN NOT NULL DEFAULT false,
  scores JSONB NOT NULL DEFAULT '{}',
  composite_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  blocking_issues JSONB NOT NULL DEFAULT '[]',
  immediate_actions JSONB NOT NULL DEFAULT '[]',
  next_sprint_actions JSONB NOT NULL DEFAULT '[]',
  assessment_version TEXT NOT NULL DEFAULT 'Wave 37',
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_system_health_reports_tenant ON system_health_reports(tenant_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_dashboard_security_reports_tenant ON dashboard_security_reports(tenant_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ux_optimization_reports_tenant ON ux_optimization_reports(tenant_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_final_status_history_tenant ON final_system_status_history(tenant_id, assessed_at DESC);

-- RLS
ALTER TABLE system_health_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_security_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE final_system_status_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='system_health_reports' AND policyname='tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON system_health_reports USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='final_system_status_history' AND policyname='tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON final_system_status_history USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;
