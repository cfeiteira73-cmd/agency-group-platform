-- Wave 51 Phase 2 — Dashboard Hardening
-- tables: dashboard_hardening_reports, dashboard_panel_health

CREATE TABLE IF NOT EXISTS dashboard_hardening_reports (
  id                    bigserial PRIMARY KEY,
  report_id             uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL,
  hardening_status      text NOT NULL DEFAULT 'NOT_HARDENED',
  overall_score         numeric(5,2) NOT NULL DEFAULT 0,
  error_boundary_pct    numeric(5,2) NOT NULL DEFAULT 0,
  stale_rate_pct        numeric(5,2) NOT NULL DEFAULT 0,
  reconnect_pct         numeric(5,2) NOT NULL DEFAULT 0,
  critical_issue_count  integer NOT NULL DEFAULT 0,
  hardening_hash        text NOT NULL,
  report_json           jsonb NOT NULL DEFAULT '{}',
  generated_at          timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dashboard_panel_health (
  id                 bigserial PRIMARY KEY,
  panel_name         text NOT NULL,
  tenant_id          uuid NOT NULL,
  last_rendered_at   timestamptz,
  render_duration_ms integer,
  error_count        integer NOT NULL DEFAULT 0,
  status             text NOT NULL DEFAULT 'OPERATIONAL',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (panel_name, tenant_id)
);

ALTER TABLE dashboard_hardening_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_panel_health      ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'dashboard_hardening_reports' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON dashboard_hardening_reports
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'dashboard_panel_health' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON dashboard_panel_health
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_dashboard_hardening_tenant ON dashboard_hardening_reports (tenant_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_panel_health_name ON dashboard_panel_health (panel_name);
