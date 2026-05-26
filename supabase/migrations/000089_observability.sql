-- 000089_observability.sql
-- Wave 44 Agent 4 — Advanced Observability + Control Plane
-- Distributed tracing, anomaly detection, root cause analysis, performance snapshots

CREATE TABLE IF NOT EXISTS trace_spans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  span_id TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  trace_id TEXT NOT NULL,
  parent_span_id TEXT,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  layer TEXT NOT NULL DEFAULT 'API',
  operation TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('STARTED','COMPLETED','FAILED','TIMEOUT')) DEFAULT 'STARTED',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_ms INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}',
  error_message TEXT,
  http_status INTEGER
);

CREATE TABLE IF NOT EXISTS metric_datapoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  metric_name TEXT NOT NULL,
  value NUMERIC NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS anomaly_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  metric_name TEXT NOT NULL,
  observed_value NUMERIC NOT NULL,
  baseline_mean NUMERIC NOT NULL DEFAULT 0,
  baseline_stddev NUMERIC NOT NULL DEFAULT 0,
  z_score NUMERIC NOT NULL DEFAULT 0,
  level TEXT NOT NULL CHECK (level IN ('NORMAL','WATCH','WARNING','CRITICAL')) DEFAULT 'WATCH',
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS root_cause_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rca_id TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  trigger_alert_ids TEXT[] NOT NULL DEFAULT '{}',
  probable_cause TEXT NOT NULL DEFAULT 'UNKNOWN',
  confidence NUMERIC(3,2) NOT NULL DEFAULT 0,
  evidence TEXT[] NOT NULL DEFAULT '{}',
  recommended_actions TEXT[] NOT NULL DEFAULT '{}',
  auto_recoverable BOOLEAN NOT NULL DEFAULT false,
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS performance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  api_p50_ms NUMERIC NOT NULL DEFAULT 0,
  api_p95_ms NUMERIC NOT NULL DEFAULT 0,
  api_p99_ms NUMERIC NOT NULL DEFAULT 0,
  api_error_rate_pct NUMERIC NOT NULL DEFAULT 0,
  supply_ingestion_rate_per_hour NUMERIC NOT NULL DEFAULT 0,
  supply_last_ingest_minutes_ago NUMERIC NOT NULL DEFAULT 0,
  supply_active_connectors INTEGER NOT NULL DEFAULT 0,
  capital_pipeline_active_count INTEGER NOT NULL DEFAULT 0,
  capital_avg_stage_duration_hours NUMERIC NOT NULL DEFAULT 0,
  escrow_total_held_cents BIGINT NOT NULL DEFAULT 0,
  ml_drift_score NUMERIC NOT NULL DEFAULT 0,
  ml_last_trained_hours_ago NUMERIC NOT NULL DEFAULT 0,
  ml_prediction_accuracy NUMERIC NOT NULL DEFAULT 0,
  opportunities_generated_24h INTEGER NOT NULL DEFAULT 0,
  opportunities_avg_score NUMERIC NOT NULL DEFAULT 0,
  matches_sent_24h INTEGER NOT NULL DEFAULT 0,
  system_health_score NUMERIC NOT NULL DEFAULT 0,
  degraded_services TEXT[] NOT NULL DEFAULT '{}',
  active_anomalies INTEGER NOT NULL DEFAULT 0
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trace_spans_trace ON trace_spans(trace_id, started_at ASC);
CREATE INDEX IF NOT EXISTS idx_trace_spans_tenant_time ON trace_spans(tenant_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_trace_spans_operation ON trace_spans(operation, duration_ms DESC) WHERE duration_ms IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_metric_datapoints_name ON metric_datapoints(tenant_id, metric_name, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_anomaly_alerts_active ON anomaly_alerts(tenant_id, resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_anomaly_alerts_time ON anomaly_alerts(tenant_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_rca_tenant ON root_cause_analyses(tenant_id, analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_performance_snapshots_tenant ON performance_snapshots(tenant_id, captured_at DESC);

-- RLS
ALTER TABLE trace_spans ENABLE ROW LEVEL SECURITY;
ALTER TABLE metric_datapoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomaly_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE root_cause_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_snapshots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trace_spans' AND policyname='service_role_trace_spans') THEN
    CREATE POLICY "service_role_trace_spans" ON trace_spans FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='metric_datapoints' AND policyname='service_role_metrics') THEN
    CREATE POLICY "service_role_metrics" ON metric_datapoints FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='anomaly_alerts' AND policyname='service_role_anomalies') THEN
    CREATE POLICY "service_role_anomalies" ON anomaly_alerts FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='root_cause_analyses' AND policyname='service_role_rca') THEN
    CREATE POLICY "service_role_rca" ON root_cause_analyses FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='performance_snapshots' AND policyname='service_role_perf_snapshots') THEN
    CREATE POLICY "service_role_perf_snapshots" ON performance_snapshots FOR ALL USING (true);
  END IF;
END $$;
