-- Agency Group — Wave 38: Real Observability Stack
-- supabase/migrations/000048_observability.sql
-- Tables: trace_spans, error_cluster_reports, root_cause_reports, anomaly_alerts

-- ─── trace_spans: distributed trace spans ────────────────────────────────────
CREATE TABLE IF NOT EXISTS trace_spans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  trace_id text NOT NULL,
  span_id text NOT NULL,
  parent_span_id text,
  operation text NOT NULL,
  service text NOT NULL DEFAULT 'api',
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  duration_ms integer,
  status text NOT NULL DEFAULT 'ok',
  error_message text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trace_spans_trace_id ON trace_spans(trace_id);
CREATE INDEX IF NOT EXISTS idx_trace_spans_tenant_started ON trace_spans(tenant_id, started_at DESC);
ALTER TABLE trace_spans ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trace_spans' AND policyname='tenant_isolation') THEN CREATE POLICY tenant_isolation ON trace_spans USING (tenant_id::text = current_setting('app.tenant_id', true)); END IF; END $$;

-- ─── error_cluster_reports ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS error_cluster_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  generated_at timestamptz DEFAULT now(),
  window_hours integer,
  total_errors integer,
  clusters jsonb DEFAULT '[]',
  error_storm_detected boolean DEFAULT false,
  most_affected_component text
);
CREATE INDEX IF NOT EXISTS idx_error_cluster_reports_tenant ON error_cluster_reports(tenant_id, generated_at DESC);
ALTER TABLE error_cluster_reports ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='error_cluster_reports' AND policyname='tenant_isolation') THEN CREATE POLICY tenant_isolation ON error_cluster_reports USING (tenant_id::text = current_setting('app.tenant_id', true)); END IF; END $$;

-- ─── root_cause_reports ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS root_cause_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  generated_at timestamptz DEFAULT now(),
  analysis_window_minutes integer,
  chains_found integer DEFAULT 0,
  chains jsonb DEFAULT '[]',
  top_root_cause text
);
CREATE INDEX IF NOT EXISTS idx_root_cause_reports_tenant ON root_cause_reports(tenant_id, generated_at DESC);
ALTER TABLE root_cause_reports ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='root_cause_reports' AND policyname='tenant_isolation') THEN CREATE POLICY tenant_isolation ON root_cause_reports USING (tenant_id::text = current_setting('app.tenant_id', true)); END IF; END $$;

-- ─── anomaly_alerts ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS anomaly_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  alert_id text NOT NULL,
  metric_name text,
  component text,
  observed_value numeric,
  baseline_mean numeric,
  baseline_stddev numeric,
  z_score numeric,
  severity text NOT NULL DEFAULT 'MEDIUM',
  detected_at timestamptz DEFAULT now(),
  acknowledged boolean DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_anomaly_alerts_tenant ON anomaly_alerts(tenant_id, detected_at DESC);
ALTER TABLE anomaly_alerts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='anomaly_alerts' AND policyname='tenant_isolation') THEN CREATE POLICY tenant_isolation ON anomaly_alerts USING (tenant_id::text = current_setting('app.tenant_id', true)); END IF; END $$;
