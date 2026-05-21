-- Agency Group — Global Infrastructure Tables
-- Migration: 20260522000016_global_infra.sql

-- ─── region_latency_metrics ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS region_latency_metrics (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid        NOT NULL REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001',
  region         text        NOT NULL,
  p50_latency_ms numeric,
  p95_latency_ms numeric,
  p99_latency_ms numeric,
  error_rate_pct numeric,
  sample_count   integer     NOT NULL DEFAULT 0,
  recorded_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_region_latency
  ON region_latency_metrics(region, recorded_at DESC);

-- ─── failover_executions ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS failover_executions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid        NOT NULL REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001',
  from_region         text        NOT NULL,
  to_region           text        NOT NULL,
  trigger             text        NOT NULL,
  steps               jsonb       NOT NULL DEFAULT '[]',
  started_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz,
  total_duration_ms   integer,
  steps_completed     integer     NOT NULL DEFAULT 0,
  steps_failed        integer     NOT NULL DEFAULT 0,
  traffic_migrated    boolean     NOT NULL DEFAULT false,
  events_replayed     integer     NOT NULL DEFAULT 0,
  rto_achieved_ms     integer,
  rpo_achieved_events integer,
  success             boolean     NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_failover_tenant
  ON failover_executions(tenant_id, started_at DESC);

-- ─── RLS — service_role only ──────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'region_latency_metrics'
      AND policyname = 'region_latency_metrics_service_role'
  ) THEN
    ALTER TABLE region_latency_metrics ENABLE ROW LEVEL SECURITY;
    CREATE POLICY region_latency_metrics_service_role ON region_latency_metrics
      USING (auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'failover_executions'
      AND policyname = 'failover_executions_service_role'
  ) THEN
    ALTER TABLE failover_executions ENABLE ROW LEVEL SECURITY;
    CREATE POLICY failover_executions_service_role ON failover_executions
      USING (auth.role() = 'service_role');
  END IF;
END $$;
