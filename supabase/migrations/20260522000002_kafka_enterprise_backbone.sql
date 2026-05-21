-- =============================================================================
-- Agency Group — Kafka Enterprise Backbone
-- Migration: 20260522000002_kafka_enterprise_backbone.sql
--
-- Creates four tables for Phase 1 of the European Real Estate Liquidity
-- Infrastructure event backbone:
--
--   kafka_consumer_offsets   — committed offsets per consumer group/topic/partition
--   event_schema_registry    — persisted schema versions (mirrors in-memory registry)
--   replay_runs              — active and historical replay job tracking
--   kafka_transaction_log    — exactly-once transaction audit log
--
-- All tables have RLS enabled with service_role bypass.
-- Idempotent: all DDL uses IF NOT EXISTS or DO $$ blocks.
-- =============================================================================

-- ─── 1. kafka_consumer_offsets ────────────────────────────────────────────────
-- Tracks the last committed offset per consumer group, topic, and partition.
-- Consumers write here after successful processing to enable replay-from-offset.

CREATE TABLE IF NOT EXISTS kafka_consumer_offsets (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  consumer_group  text        NOT NULL,
  topic           text        NOT NULL,
  partition       integer     NOT NULL,
  committed_offset bigint     NOT NULL,
  metadata        jsonb       NOT NULL DEFAULT '{}',
  committed_at    timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT kafka_consumer_offsets_pkey
    PRIMARY KEY (id),
  CONSTRAINT kafka_consumer_offsets_group_topic_partition_unique
    UNIQUE (consumer_group, topic, partition)
);

COMMENT ON TABLE  kafka_consumer_offsets IS
  'Last committed Kafka offsets per consumer group / topic / partition. Updated by IdempotentKafkaConsumer on successful batch processing.';

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_kafka_consumer_offsets_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kafka_consumer_offsets_updated_at ON kafka_consumer_offsets;
CREATE TRIGGER trg_kafka_consumer_offsets_updated_at
  BEFORE UPDATE ON kafka_consumer_offsets
  FOR EACH ROW EXECUTE FUNCTION update_kafka_consumer_offsets_updated_at();

-- Index for fast lookups by group
CREATE INDEX IF NOT EXISTS idx_kafka_consumer_offsets_group
  ON kafka_consumer_offsets (consumer_group, topic);

-- RLS
ALTER TABLE kafka_consumer_offsets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'kafka_consumer_offsets' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON kafka_consumer_offsets
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;


-- ─── 2. event_schema_registry ─────────────────────────────────────────────────
-- Persists schema versions from the in-memory EventSchemaRegistry.
-- Allows cold-start hydration and version history audit.

CREATE TABLE IF NOT EXISTS event_schema_registry (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  topic           text        NOT NULL,
  event_type      text        NOT NULL,
  version         integer     NOT NULL,
  schema          jsonb       NOT NULL,
  is_breaking     boolean     NOT NULL DEFAULT false,
  registered_at   timestamptz NOT NULL DEFAULT now(),
  registered_by   text,       -- user email or service name that registered the schema

  CONSTRAINT event_schema_registry_pkey
    PRIMARY KEY (id),
  CONSTRAINT event_schema_registry_topic_type_version_unique
    UNIQUE (topic, event_type, version),
  CONSTRAINT event_schema_registry_version_positive
    CHECK (version > 0)
);

COMMENT ON TABLE  event_schema_registry IS
  'Persisted event schema versions. Mirrors the in-memory EventSchemaRegistry. Used for cold-start hydration and audit.';

COMMENT ON COLUMN event_schema_registry.is_breaking IS
  'True when this version introduced a backward-incompatible change to the event shape.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_event_schema_registry_topic_type
  ON event_schema_registry (topic, event_type);

CREATE INDEX IF NOT EXISTS idx_event_schema_registry_registered_at
  ON event_schema_registry (registered_at DESC);

-- RLS
ALTER TABLE event_schema_registry ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'event_schema_registry' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON event_schema_registry
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Read-only policy for authenticated users (schema introspection)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'event_schema_registry' AND policyname = 'authenticated_read'
  ) THEN
    CREATE POLICY authenticated_read ON event_schema_registry
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;


-- ─── 3. replay_runs ───────────────────────────────────────────────────────────
-- Tracks active and historical replay jobs.
-- Written by replayEngine.ts startReplay() / abortReplay() / getReplayProgress().

CREATE TABLE IF NOT EXISTS replay_runs (
  id                uuid        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id         uuid        NOT NULL,
  replay_id         text        NOT NULL,
  status            text        NOT NULL DEFAULT 'running',
  options           jsonb       NOT NULL DEFAULT '{}',
  events_processed  integer     NOT NULL DEFAULT 0,
  events_total      integer,
  current_timestamp timestamptz,
  errors            jsonb       NOT NULL DEFAULT '[]',
  started_at        timestamptz NOT NULL DEFAULT now(),
  completed_at      timestamptz,

  CONSTRAINT replay_runs_pkey
    PRIMARY KEY (id),
  CONSTRAINT replay_runs_replay_id_unique
    UNIQUE (replay_id),
  CONSTRAINT replay_runs_status_check
    CHECK (status IN ('running', 'completed', 'failed', 'aborted')),
  CONSTRAINT replay_runs_tenant_fk
    FOREIGN KEY (tenant_id) REFERENCES organizations (id) ON DELETE CASCADE
);

COMMENT ON TABLE  replay_runs IS
  'Event replay job tracking. Each row represents one replay run, updated atomically by the replay engine.';

COMMENT ON COLUMN replay_runs.current_timestamp IS
  'The occurred_at of the last successfully processed event in this run.';

COMMENT ON COLUMN replay_runs.errors IS
  'JSON array of error strings accumulated during the replay run.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_replay_runs_tenant_id
  ON replay_runs (tenant_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_replay_runs_status
  ON replay_runs (status)
  WHERE status = 'running';

-- RLS
ALTER TABLE replay_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'replay_runs' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON replay_runs
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Tenants can read their own replay runs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'replay_runs' AND policyname = 'tenant_select'
  ) THEN
    CREATE POLICY tenant_select ON replay_runs
      FOR SELECT TO authenticated
      USING (
        tenant_id IN (
          SELECT id FROM organizations
          WHERE id = tenant_id
        )
      );
  END IF;
END $$;


-- ─── 4. kafka_transaction_log ─────────────────────────────────────────────────
-- Exactly-once transaction audit log.
-- The UNIQUE(transaction_id) constraint is the idempotency anchor —
-- duplicate commit attempts hit a unique violation rather than double-inserting.

CREATE TABLE IF NOT EXISTS kafka_transaction_log (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  transaction_id  text        NOT NULL,
  tenant_id       uuid,
  topic           text,
  events_count    integer     NOT NULL DEFAULT 0,
  status          text        NOT NULL,
  started_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  offsets         jsonb       NOT NULL DEFAULT '{}',

  CONSTRAINT kafka_transaction_log_pkey
    PRIMARY KEY (id),
  CONSTRAINT kafka_transaction_log_transaction_id_unique
    UNIQUE (transaction_id),
  CONSTRAINT kafka_transaction_log_status_check
    CHECK (status IN ('open', 'committed', 'aborted')),
  CONSTRAINT kafka_transaction_log_tenant_fk
    FOREIGN KEY (tenant_id) REFERENCES organizations (id) ON DELETE SET NULL
);

COMMENT ON TABLE  kafka_transaction_log IS
  'Exactly-once transaction audit log. UNIQUE(transaction_id) is the idempotency anchor — duplicate commits are rejected by the DB constraint.';

COMMENT ON COLUMN kafka_transaction_log.offsets IS
  'JSON object mapping topic name → highest committed offset. Populated on commit.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_kafka_txn_log_tenant_id
  ON kafka_transaction_log (tenant_id, started_at DESC)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kafka_txn_log_status
  ON kafka_transaction_log (status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_kafka_txn_log_topic
  ON kafka_transaction_log (topic)
  WHERE topic IS NOT NULL;

-- RLS
ALTER TABLE kafka_transaction_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'kafka_transaction_log' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON kafka_transaction_log
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;


-- ─── 5. Ensure event_history has topic column ─────────────────────────────────
-- The replayEngine.ts queries event_history.topic for filtering.
-- Add column if the prior migration didn't include it.

ALTER TABLE event_history
  ADD COLUMN IF NOT EXISTS topic text;

ALTER TABLE event_history
  ADD COLUMN IF NOT EXISTS occurred_at timestamptz;

-- Back-fill occurred_at from created_at where null
UPDATE event_history
SET occurred_at = created_at
WHERE occurred_at IS NULL;

-- Index for replay windowed queries
CREATE INDEX IF NOT EXISTS idx_event_history_tenant_occurred
  ON event_history (tenant_id, occurred_at ASC)
  WHERE occurred_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_event_history_topic
  ON event_history (topic)
  WHERE topic IS NOT NULL;
