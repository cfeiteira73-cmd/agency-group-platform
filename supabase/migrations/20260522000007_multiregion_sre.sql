-- Agency Group — Multi-Region SRE Infrastructure
-- Migration: 20260522000006_multiregion_sre.sql

-- ─── region_status ────────────────────────────────────────────────────────────
-- Real-time per-region health state

CREATE TABLE IF NOT EXISTS region_status (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  region           text        NOT NULL,
  role             text        NOT NULL DEFAULT 'secondary',
  status           text        NOT NULL DEFAULT 'healthy',
  latency_ms       numeric,
  last_heartbeat   timestamptz NOT NULL DEFAULT now(),
  capabilities     jsonb       NOT NULL DEFAULT '{}',
  load_pct         numeric     NOT NULL DEFAULT 0,
  error_rate_pct   numeric     NOT NULL DEFAULT 0,
  computed_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(region)
);

ALTER TABLE region_status ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'region_status' AND policyname = 'region_status_service_role'
  ) THEN
    CREATE POLICY region_status_service_role ON region_status
      USING (auth.role() = 'service_role');
  END IF;
END;
$$;

-- ─── self_healing_executions ──────────────────────────────────────────────────
-- Audit log of all automated healing actions

CREATE TABLE IF NOT EXISTS self_healing_executions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id        text        NOT NULL,
  action         text        NOT NULL,
  triggered_at   timestamptz NOT NULL DEFAULT now(),
  completed_at   timestamptz,
  success        boolean,
  auto_executed  boolean     NOT NULL DEFAULT true,
  result         jsonb       NOT NULL DEFAULT '{}',
  context        jsonb       NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_self_healing_rule_id
  ON self_healing_executions(rule_id, triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_self_healing_triggered_at
  ON self_healing_executions(triggered_at DESC);

ALTER TABLE self_healing_executions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'self_healing_executions' AND policyname = 'self_healing_service_role'
  ) THEN
    CREATE POLICY self_healing_service_role ON self_healing_executions
      USING (auth.role() = 'service_role');
  END IF;
END;
$$;

-- ─── rto_rpo_events ───────────────────────────────────────────────────────────
-- Actual measured incident recovery times

CREATE TABLE IF NOT EXISTS rto_rpo_events (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid        REFERENCES organizations(id) ON DELETE CASCADE,
  incident_id            text,
  event_type             text        NOT NULL CHECK (event_type IN ('rto', 'rpo')),
  service                text        NOT NULL,
  region                 text,

  -- RTO fields
  failure_detected_at    timestamptz,
  recovery_completed_at  timestamptz,

  -- RPO fields
  last_committed_at      timestamptz,
  recovery_point_at      timestamptz,

  -- Computed
  actual_seconds         numeric,
  sla_seconds            numeric,
  sla_met                boolean,
  recovery_method        text,
  playbook_used          text,
  data_loss_detected     boolean     NOT NULL DEFAULT false,
  recorded_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rto_rpo_service
  ON rto_rpo_events(service, failure_detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_rto_rpo_tenant_service
  ON rto_rpo_events(tenant_id, service, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_rto_rpo_sla_met
  ON rto_rpo_events(sla_met, recorded_at DESC);

ALTER TABLE rto_rpo_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'rto_rpo_events' AND policyname = 'rto_rpo_service_role'
  ) THEN
    CREATE POLICY rto_rpo_service_role ON rto_rpo_events
      USING (auth.role() = 'service_role');
  END IF;
END;
$$;

-- ─── chaos_gauntlet_results ───────────────────────────────────────────────────
-- Full gauntlet run summaries

CREATE TABLE IF NOT EXISTS chaos_gauntlet_results (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid        REFERENCES organizations(id) ON DELETE CASCADE,
  scenarios_run       integer     NOT NULL DEFAULT 0,
  scenarios_passed    integer     NOT NULL DEFAULT 0,
  resilience_score    numeric     NOT NULL DEFAULT 0,
  critical_failures   jsonb       NOT NULL DEFAULT '[]',
  recommendations     jsonb       NOT NULL DEFAULT '[]',
  run_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chaos_gauntlet_tenant_run_at
  ON chaos_gauntlet_results(tenant_id, run_at DESC);

ALTER TABLE chaos_gauntlet_results ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'chaos_gauntlet_results' AND policyname = 'chaos_gauntlet_service_role'
  ) THEN
    CREATE POLICY chaos_gauntlet_service_role ON chaos_gauntlet_results
      USING (auth.role() = 'service_role');
  END IF;
END;
$$;

-- ─── runtime_config ───────────────────────────────────────────────────────────
-- Used by self-healing engine to persist runtime flags (e.g. AI_FALLBACK_MODE)
-- Create only if not present (may exist from earlier migrations)

CREATE TABLE IF NOT EXISTS runtime_config (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text        NOT NULL UNIQUE,
  value       text        NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE runtime_config ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'runtime_config' AND policyname = 'runtime_config_service_role'
  ) THEN
    CREATE POLICY runtime_config_service_role ON runtime_config
      USING (auth.role() = 'service_role');
  END IF;
END;
$$;
