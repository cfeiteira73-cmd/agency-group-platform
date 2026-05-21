-- 000044: Performance Metrics and Dashboard Logging

CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'GET',
  response_time_ms INTEGER NOT NULL,
  status_code INTEGER NOT NULL DEFAULT 200,
  db_queries_count INTEGER,
  cache_hit BOOLEAN NOT NULL DEFAULT false,
  correlation_id TEXT,
  measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS performance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  period_hours INTEGER NOT NULL DEFAULT 24,
  by_endpoint JSONB NOT NULL DEFAULT '[]',
  overall JSONB NOT NULL DEFAULT '{}',
  db_efficiency JSONB NOT NULL DEFAULT '{}',
  performance_grade TEXT NOT NULL DEFAULT 'DEGRADED',
  recommendations JSONB NOT NULL DEFAULT '[]',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for time-series queries
CREATE INDEX IF NOT EXISTS idx_performance_metrics_tenant_time ON performance_metrics(tenant_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_endpoint ON performance_metrics(endpoint, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_performance_reports_tenant ON performance_reports(tenant_id, generated_at DESC);

-- RLS
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='performance_metrics' AND policyname='tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON performance_metrics USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='performance_reports' AND policyname='tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON performance_reports USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;
