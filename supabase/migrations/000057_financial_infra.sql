-- Agency Group — Financial Infrastructure
-- Migration: 000057_financial_infra.sql
-- Wave 39 — System 6: Financial Event Bus + Multi-Region Replication + Capital System Tests
--
-- Tables:
--   financial_events        — immutable event log (event sourcing / Kafka-like)
--   consumer_offsets        — per-consumer-group cursor tracking
--   replication_audit_log   — dual-write replication audit trail
--   capital_system_test_reports — 9 mandatory test results
--
-- All tables: RLS enabled with tenant_isolation policy.
-- All indexes optimised for append-heavy workloads.

-- =============================================================================
-- financial_events: immutable event log (event sourcing)
-- =============================================================================
CREATE TABLE IF NOT EXISTS financial_events (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        text        NOT NULL UNIQUE,
  tenant_id       uuid        NOT NULL,
  event_type      text        NOT NULL,
  aggregate_id    text        NOT NULL,
  aggregate_type  text        NOT NULL,
  payload         jsonb       DEFAULT '{}',
  sequence        bigint      NOT NULL,
  published_at    timestamptz DEFAULT now(),
  idempotency_key text        NOT NULL,
  partition_key   text        NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_events_idempotency
  ON financial_events(idempotency_key);

CREATE INDEX IF NOT EXISTS idx_financial_events_aggregate
  ON financial_events(tenant_id, aggregate_id, sequence ASC);

CREATE INDEX IF NOT EXISTS idx_financial_events_tenant_published
  ON financial_events(tenant_id, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_financial_events_partition_sequence
  ON financial_events(partition_key, sequence ASC);

ALTER TABLE financial_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'financial_events' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON financial_events
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- Prevent any UPDATE or DELETE on the immutable event log
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'financial_events' AND policyname = 'immutable_no_update'
  ) THEN
    CREATE POLICY immutable_no_update ON financial_events
      FOR UPDATE USING (false);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'financial_events' AND policyname = 'immutable_no_delete'
  ) THEN
    CREATE POLICY immutable_no_delete ON financial_events
      FOR DELETE USING (false);
  END IF;
END $$;

-- =============================================================================
-- consumer_offsets: tracks consumer group progress per partition
-- =============================================================================
CREATE TABLE IF NOT EXISTS consumer_offsets (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL,
  consumer_group  text        NOT NULL,
  partition_key   text        NOT NULL,
  last_sequence   bigint      DEFAULT 0,
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(tenant_id, consumer_group, partition_key)
);

CREATE INDEX IF NOT EXISTS idx_consumer_offsets_group
  ON consumer_offsets(tenant_id, consumer_group);

ALTER TABLE consumer_offsets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'consumer_offsets' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON consumer_offsets
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- =============================================================================
-- replication_audit_log: dual-write replication status per event
-- =============================================================================
CREATE TABLE IF NOT EXISTS replication_audit_log (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            text        NOT NULL,
  tenant_id           uuid        NOT NULL,
  primary_region      text,
  standby_regions     jsonb       DEFAULT '[]',
  primary_written     boolean     DEFAULT true,
  standby_written     jsonb       DEFAULT '{}',
  replication_lag_ms  integer,
  fully_replicated    boolean     DEFAULT false,
  recorded_at         timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_replication_audit_tenant
  ON replication_audit_log(tenant_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_replication_audit_fully_replicated
  ON replication_audit_log(tenant_id, fully_replicated, recorded_at DESC);

ALTER TABLE replication_audit_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'replication_audit_log' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON replication_audit_log
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- =============================================================================
-- capital_system_test_reports: results of 9 mandatory capital system tests
-- =============================================================================
CREATE TABLE IF NOT EXISTS capital_system_test_reports (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid        NOT NULL,
  generated_at            timestamptz DEFAULT now(),
  tests_passed            integer     DEFAULT 0,
  tests_failed            integer     DEFAULT 0,
  critical_failures       integer     DEFAULT 0,
  all_critical_passed     boolean     DEFAULT false,
  capital_execution_ready boolean     DEFAULT false,
  overall_score           numeric(5,2) DEFAULT 0,
  results                 jsonb       DEFAULT '[]',
  blocking_issues         jsonb       DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_capital_test_reports_tenant
  ON capital_system_test_reports(tenant_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_capital_test_reports_ready
  ON capital_system_test_reports(tenant_id, capital_execution_ready, generated_at DESC);

ALTER TABLE capital_system_test_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'capital_system_test_reports' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON capital_system_test_reports
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- =============================================================================
-- Comments
-- =============================================================================
COMMENT ON TABLE financial_events IS
  'Immutable financial event log. Append-only — UPDATE and DELETE are blocked by RLS. Supports Kafka-like event sourcing with sequence-ordered replay.';

COMMENT ON TABLE consumer_offsets IS
  'Per-consumer-group cursor tracking for the financial event bus. Enables at-least-once delivery semantics.';

COMMENT ON TABLE replication_audit_log IS
  'Audit trail for dual-write replication operations. Used to compute RPO/RTO metrics and detect replication lag.';

COMMENT ON TABLE capital_system_test_reports IS
  'Results of the 9 mandatory capital system tests. capital_execution_ready = true only when all 6 critical tests pass.';
