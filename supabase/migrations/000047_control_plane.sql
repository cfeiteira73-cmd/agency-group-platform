-- Agency Group — Control Plane Autónomo
-- supabase/migrations/000047_control_plane.sql
-- Wave 38: SH-ROS Control Plane tables
-- Idempotent: uses CREATE TABLE IF NOT EXISTS + DO $$ guard for policies

-- ─────────────────────────────────────────────────────────────────────────────
-- control_plane_cycles: each diagnostic run
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS control_plane_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  cycle_id text NOT NULL,
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  overall_score numeric(5,2),
  status text NOT NULL DEFAULT 'UNKNOWN',
  issues_found integer DEFAULT 0,
  auto_corrections_applied integer DEFAULT 0,
  dimensions jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_control_plane_cycles_tenant_created
  ON control_plane_cycles(tenant_id, created_at DESC);

ALTER TABLE control_plane_cycles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'control_plane_cycles'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON control_plane_cycles
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- correction_actions: each auto-correction applied
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS correction_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  action_id text NOT NULL,
  issue_severity text,
  component text,
  action_type text NOT NULL,
  description text,
  applied_at timestamptz DEFAULT now(),
  success boolean DEFAULT true,
  error_message text
);

CREATE INDEX IF NOT EXISTS idx_correction_actions_tenant
  ON correction_actions(tenant_id, applied_at DESC);

ALTER TABLE correction_actions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'correction_actions'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON correction_actions
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- component_health_overrides: component status registry
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS component_health_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  component text NOT NULL,
  status text NOT NULL DEFAULT 'HEALTHY',
  reason text,
  isolation_started_at timestamptz,
  last_seen_healthy_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, component)
);

ALTER TABLE component_health_overrides ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'component_health_overrides'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON component_health_overrides
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- pipeline_restart_signals: signals for pipeline restart (consumed by workers)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pipeline_restart_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  pipeline_name text NOT NULL,
  signal_type text DEFAULT 'RESTART',
  reason text,
  emitted_at timestamptz DEFAULT now(),
  consumed_at timestamptz,
  consumed_by text
);

CREATE INDEX IF NOT EXISTS idx_pipeline_restart_signals_tenant
  ON pipeline_restart_signals(tenant_id, emitted_at DESC);

ALTER TABLE pipeline_restart_signals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pipeline_restart_signals'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON pipeline_restart_signals
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- throttle_overrides: temporary rate limiting flags
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS throttle_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  endpoint_pattern text NOT NULL,
  max_rps integer NOT NULL DEFAULT 10,
  reason text,
  active boolean DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE throttle_overrides ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'throttle_overrides'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON throttle_overrides
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- refresh_signals: data refresh requests
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  entity_type text NOT NULL,
  reason text,
  emitted_at timestamptz DEFAULT now(),
  consumed_at timestamptz
);

ALTER TABLE refresh_signals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'refresh_signals'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON refresh_signals
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;
