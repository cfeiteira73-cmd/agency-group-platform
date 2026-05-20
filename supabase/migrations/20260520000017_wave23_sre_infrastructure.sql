-- =============================================================================
-- Agency Group — Wave 23 SRE Infrastructure
-- Migration: 20260520000017_wave23_sre_infrastructure.sql
--
-- Tables:
--   slo_measurements      — rolling SLO windows per service
--   chaos_test_results    — chaos engineering run history
--   recovery_timelines    — DR incident event log
-- =============================================================================

-- ─── slo_measurements ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS slo_measurements (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid        NOT NULL REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001',
  service             text        NOT NULL,
  window_start        timestamptz NOT NULL,
  window_end          timestamptz NOT NULL,
  window_type         text        NOT NULL CHECK (window_type IN ('1m','5m','1h','24h','7d','30d')),
  total_requests      integer     NOT NULL DEFAULT 0,
  successful_requests integer     NOT NULL DEFAULT 0,
  error_requests      integer     NOT NULL DEFAULT 0,
  p50_latency_ms      numeric,
  p95_latency_ms      numeric,
  p99_latency_ms      numeric,
  slo_target_pct      numeric     NOT NULL DEFAULT 99.95,
  computed_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, service, window_type, window_start)
);

CREATE INDEX IF NOT EXISTS idx_slo_service
  ON slo_measurements (tenant_id, service, window_start DESC);

-- ─── chaos_test_results ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chaos_test_results (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid        NOT NULL REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001',
  test_name        text        NOT NULL,
  test_type        text        NOT NULL CHECK (test_type IN (
                     'db_failure','redis_outage','ai_provider_outage',
                     'worker_saturation','latency_injection',
                     'network_partition','queue_overflow'
                   )),
  status           text        NOT NULL CHECK (status IN ('running','passed','failed','skipped')),
  started_at       timestamptz NOT NULL DEFAULT now(),
  completed_at     timestamptz,
  duration_ms      integer,
  system_recovered boolean,
  recovery_time_ms integer,
  impact_observed  text,
  findings         jsonb       NOT NULL DEFAULT '{}',
  remediation      text
);

CREATE INDEX IF NOT EXISTS idx_chaos_type
  ON chaos_test_results (tenant_id, test_type, started_at DESC);

-- ─── recovery_timelines ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS recovery_timelines (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001',
  incident_id text,
  event_type  text        NOT NULL,
  service     text        NOT NULL,
  region      text        NOT NULL DEFAULT 'eu-north-1',
  description text        NOT NULL,
  operator    text,
  automated   boolean     NOT NULL DEFAULT false,
  metadata    jsonb       NOT NULL DEFAULT '{}',
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recovery_incident
  ON recovery_timelines (tenant_id, incident_id, occurred_at);

-- ─── RLS — service_role bypass (admin-only write from API) ──────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'slo_measurements' AND policyname = 'service_role_slo'
  ) THEN
    ALTER TABLE slo_measurements ENABLE ROW LEVEL SECURITY;
    CREATE POLICY service_role_slo ON slo_measurements
      USING (auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'chaos_test_results' AND policyname = 'service_role_chaos'
  ) THEN
    ALTER TABLE chaos_test_results ENABLE ROW LEVEL SECURITY;
    CREATE POLICY service_role_chaos ON chaos_test_results
      USING (auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'recovery_timelines' AND policyname = 'service_role_recovery'
  ) THEN
    ALTER TABLE recovery_timelines ENABLE ROW LEVEL SECURITY;
    CREATE POLICY service_role_recovery ON recovery_timelines
      USING (auth.role() = 'service_role');
  END IF;
END $$;
