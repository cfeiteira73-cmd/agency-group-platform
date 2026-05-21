-- =============================================================================
-- Agency Group — Disaster Recovery Engine tables (Wave 33)
-- Migration: 20260522000030_disaster_recovery.sql
-- Tables: recovery_runs, chaos_drill_reports, replay_sessions
-- =============================================================================

CREATE TABLE IF NOT EXISTS recovery_runs (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id             uuid NOT NULL,
  triggered_by          text NOT NULL DEFAULT 'manual',
  disaster_type         text NOT NULL,
  target_pitr_timestamp timestamptz,
  status                text NOT NULL DEFAULT 'idle'
    CHECK (status IN ('idle', 'running', 'completed', 'failed', 'partial')),
  steps                 jsonb NOT NULL DEFAULT '{}',
  rto_actual_minutes    numeric(8, 2),
  rpo_actual_minutes    numeric(8, 2),
  started_at            timestamptz NOT NULL DEFAULT now(),
  completed_at          timestamptz,
  notes                 text
);

CREATE TABLE IF NOT EXISTS chaos_drill_reports (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id            uuid NOT NULL,
  scenarios_run        text[] NOT NULL DEFAULT '{}',
  results              jsonb NOT NULL DEFAULT '[]',
  overall_grade        char(1) NOT NULL CHECK (overall_grade IN ('S', 'A', 'B', 'C', 'D')),
  critical_weaknesses  text[] NOT NULL DEFAULT '{}',
  recommendations      text[] NOT NULL DEFAULT '{}',
  drill_type           text NOT NULL DEFAULT 'manual'
    CHECK (drill_type IN ('scheduled', 'manual', 'triggered')),
  ran_at               timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS replay_sessions (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id            uuid NOT NULL,
  scope                text NOT NULL
    CHECK (scope IN ('full', 'topic', 'entity', 'time_range')),
  filter_topic         text,
  filter_entity_id     text,
  filter_from          timestamptz,
  filter_to            timestamptz,
  total_events         integer NOT NULL DEFAULT 0,
  replayed             integer NOT NULL DEFAULT 0,
  skipped_idempotent   integer NOT NULL DEFAULT 0,
  failed               integer NOT NULL DEFAULT 0,
  idempotency_key      text NOT NULL,
  status               text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  started_at           timestamptz NOT NULL DEFAULT now(),
  completed_at         timestamptz,
  UNIQUE (idempotency_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_recovery_runs_tenant
  ON recovery_runs (tenant_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_chaos_drills_tenant
  ON chaos_drill_reports (tenant_id, ran_at DESC);

CREATE INDEX IF NOT EXISTS idx_replay_sessions_tenant
  ON replay_sessions (tenant_id, started_at DESC);

-- Row Level Security
ALTER TABLE recovery_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE chaos_drill_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE replay_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'recovery_runs' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON recovery_runs
      TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'chaos_drill_reports' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON chaos_drill_reports
      TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'replay_sessions' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON replay_sessions
      TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
