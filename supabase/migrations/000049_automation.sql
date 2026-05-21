-- Agency Group — Wave 38: Full Automation Layer
-- 000049_automation.sql
-- Tables: circuit_breaker_states, provider_health_log,
--         ml_retraining_signals, ml_rollback_signals, ml_healing_reports

-- ─── circuit_breaker_states ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS circuit_breaker_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  state text NOT NULL DEFAULT 'CLOSED',
  failure_count integer DEFAULT 0,
  success_count integer DEFAULT 0,
  last_failure_at timestamptz,
  opened_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, name)
);

ALTER TABLE circuit_breaker_states ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'circuit_breaker_states'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON circuit_breaker_states
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- ─── provider_health_log ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS provider_health_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  provider text NOT NULL,
  success boolean NOT NULL,
  latency_ms integer,
  recorded_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_health_log_tenant_provider
  ON provider_health_log(tenant_id, provider, recorded_at DESC);

ALTER TABLE provider_health_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'provider_health_log'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON provider_health_log
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- ─── ml_retraining_signals ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ml_retraining_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  pipeline_name text NOT NULL,
  reason text,
  priority text DEFAULT 'NORMAL',
  emitted_at timestamptz DEFAULT now(),
  consumed_at timestamptz
);

ALTER TABLE ml_retraining_signals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ml_retraining_signals'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON ml_retraining_signals
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- ─── ml_rollback_signals ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ml_rollback_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  pipeline_name text NOT NULL,
  target_checkpoint text,
  reason text,
  emitted_at timestamptz DEFAULT now(),
  consumed_at timestamptz
);

ALTER TABLE ml_rollback_signals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ml_rollback_signals'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON ml_rollback_signals
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- ─── ml_healing_reports ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ml_healing_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  generated_at timestamptz DEFAULT now(),
  pipelines_checked integer DEFAULT 0,
  pipelines_healed integer DEFAULT 0,
  overall_ml_health text,
  statuses jsonb DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_ml_healing_reports_tenant
  ON ml_healing_reports(tenant_id, generated_at DESC);

ALTER TABLE ml_healing_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ml_healing_reports'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON ml_healing_reports
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;
