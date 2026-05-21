-- =============================================================================
-- Agency Group — Kafka Enterprise Backbone Tables
-- Migration: 20260522000015_kafka_enterprise.sql
--
-- Creates:
--   consumer_backpressure_metrics  — live backpressure state per topic/group
--   partition_rebalance_log        — audit log of rebalance actions
--   schema_evolution_log           — schema migration audit trail
-- =============================================================================

-- ---------------------------------------------------------------------------
-- consumer_backpressure_metrics
-- Upserted by ConsumerBackpressure.persistMetrics()
-- Conflict key: (tenant_id, topic, group_id)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS consumer_backpressure_metrics (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid        NOT NULL REFERENCES organizations(id),
  topic               text        NOT NULL,
  group_id            text        NOT NULL,
  current_lag         integer     NOT NULL DEFAULT 0,
  is_paused           boolean     NOT NULL DEFAULT false,
  messages_in_flight  integer     NOT NULL DEFAULT 0,
  pause_count         integer     NOT NULL DEFAULT 0,
  paused_at           timestamptz,
  recorded_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, topic, group_id)
);

CREATE INDEX IF NOT EXISTS idx_backpressure_tenant
  ON consumer_backpressure_metrics (tenant_id, recorded_at DESC);

-- RLS — service_role only
ALTER TABLE consumer_backpressure_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_only_backpressure" ON consumer_backpressure_metrics;
CREATE POLICY "service_role_only_backpressure"
  ON consumer_backpressure_metrics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- partition_rebalance_log
-- Inserted by logRebalanceEvent()
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partition_rebalance_log (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                uuid        NOT NULL REFERENCES organizations(id),
  topic                    text        NOT NULL,
  partitions_rebalanced    integer     NOT NULL DEFAULT 0,
  before_max_lag           integer,
  after_estimated_max_lag  integer,
  actions_taken            jsonb       NOT NULL DEFAULT '[]',
  executed_at              timestamptz NOT NULL DEFAULT now()
);

-- RLS — service_role only
ALTER TABLE partition_rebalance_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_only_rebalance_log" ON partition_rebalance_log;
CREATE POLICY "service_role_only_rebalance_log"
  ON partition_rebalance_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- schema_evolution_log
-- Audit trail for schema migrations registered via registerSchemaEvolution()
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_evolution_log (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001',
  event_type      text        NOT NULL,
  from_version    text        NOT NULL,
  to_version      text        NOT NULL,
  breaking_change boolean     NOT NULL DEFAULT false,
  applied_at      timestamptz NOT NULL DEFAULT now(),
  applied_by      text        NOT NULL DEFAULT 'system'
);

-- RLS — service_role only
ALTER TABLE schema_evolution_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_only_schema_evolution" ON schema_evolution_log;
CREATE POLICY "service_role_only_schema_evolution"
  ON schema_evolution_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
