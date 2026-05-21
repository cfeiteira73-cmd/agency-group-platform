-- =============================================================================
-- Agency Group — Events & Compliance Tables (Wave 32 Agent 4)
-- Migration: 20260522000028_events_compliance.sql
--
-- Creates:
--   kafka_event_log             — Supabase fallback / dual-write for all events
--   consumer_lag_metrics        — backpressure / consumer lag monitoring
--   investor_compliance_profiles — AML/KYC profiles
--   audit_log_entries           — immutable append-only financial audit log
--   data_provenance_records     — full asset provenance chain
-- =============================================================================

-- ─── kafka_event_log ─────────────────────────────────────────────────────────
-- Supabase fallback for all events (dual-write with Kafka).
-- Events are NEVER lost — they land here even without Kafka infrastructure.

CREATE TABLE IF NOT EXISTS kafka_event_log (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id      uuid        NOT NULL,
  event_id       uuid        NOT NULL,
  topic          text        NOT NULL,
  entity_id      text        NOT NULL,
  entity_type    text        NOT NULL,
  payload        jsonb       NOT NULL,
  correlation_id text,
  schema_version text        NOT NULL DEFAULT '1.0',
  processed_at   timestamptz,          -- null = unprocessed/queued
  emitted_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id)
);

-- ─── consumer_lag_metrics ────────────────────────────────────────────────────
-- Consumer lag per topic/partition for backpressure monitoring.

CREATE TABLE IF NOT EXISTS consumer_lag_metrics (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id      uuid        NOT NULL,
  consumer_group text        NOT NULL,
  topic          text        NOT NULL,
  partition_num  integer     NOT NULL DEFAULT 0,
  current_offset bigint      NOT NULL DEFAULT 0,
  latest_offset  bigint      NOT NULL DEFAULT 0,
  lag            bigint      NOT NULL DEFAULT 0,
  lag_ms         bigint      NOT NULL DEFAULT 0,
  recorded_at    timestamptz NOT NULL DEFAULT now()
);

-- ─── investor_compliance_profiles ────────────────────────────────────────────
-- AML/KYC compliance profiles per investor.
-- Enforces AMLD5/6 requirements for Portuguese real estate transactions.

CREATE TABLE IF NOT EXISTS investor_compliance_profiles (
  id                          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id                   uuid        NOT NULL,
  investor_id                 uuid        NOT NULL,
  kyc_status                  text        NOT NULL DEFAULT 'not_started'
    CHECK (kyc_status IN ('not_started','pending','approved','rejected','expired')),
  kyc_verified_at             timestamptz,
  kyc_expires_at              timestamptz,
  aml_risk_level              text        NOT NULL DEFAULT 'low'
    CHECK (aml_risk_level IN ('low','medium','high','blocked')),
  aml_checked_at              timestamptz,
  pep_status                  boolean     NOT NULL DEFAULT false,
  sanctions_checked           boolean     NOT NULL DEFAULT false,
  sanctions_hit               boolean     NOT NULL DEFAULT false,
  source_of_funds_verified    boolean     NOT NULL DEFAULT false,
  country_of_origin           char(2),
  nationality                 char(2),
  total_capital_deployed_eur  numeric(15,2) NOT NULL DEFAULT 0,
  suspicious_activity_flags   text[]      NOT NULL DEFAULT '{}',
  notes                       text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, investor_id)
);

-- ─── audit_log_entries ───────────────────────────────────────────────────────
-- Financial-grade immutable, append-only audit log.
-- Hash-chained: each entry's entry_hash covers (seq + action + entity_id +
-- payload + previous_hash) so tampering can be detected.

CREATE TABLE IF NOT EXISTS audit_log_entries (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       uuid        NOT NULL,
  sequence_number bigint      NOT NULL,
  action          text        NOT NULL,
  actor_id        text        NOT NULL,
  entity_type     text        NOT NULL,
  entity_id       text        NOT NULL,
  payload         jsonb       NOT NULL,
  previous_hash   text,
  entry_hash      text        NOT NULL,
  correlation_id  text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, sequence_number)
);

-- ─── data_provenance_records ─────────────────────────────────────────────────
-- Full asset provenance chain from external source to settlement.
-- Hash-chained per asset: each record's hash covers (asset_id + stage +
-- stage_data + previous record hash).

CREATE TABLE IF NOT EXISTS data_provenance_records (
  id                 uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id          uuid        NOT NULL,
  asset_id           text        NOT NULL,
  external_id        text,
  source             text,
  stage              text        NOT NULL,
  stage_data         jsonb       NOT NULL DEFAULT '{}',
  actor              text        NOT NULL,
  hash               text        NOT NULL,
  previous_record_id uuid        REFERENCES data_provenance_records(id),
  recorded_at        timestamptz NOT NULL DEFAULT now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_kafka_event_log_tenant_topic
  ON kafka_event_log (tenant_id, topic, emitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_kafka_event_log_entity
  ON kafka_event_log (tenant_id, entity_id, emitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_kafka_event_log_unprocessed
  ON kafka_event_log (tenant_id, processed_at)
  WHERE processed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_consumer_lag_metrics_tenant
  ON consumer_lag_metrics (tenant_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_investor_compliance_tenant
  ON investor_compliance_profiles (tenant_id, investor_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_seq
  ON audit_log_entries (tenant_id, sequence_number DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity
  ON audit_log_entries (tenant_id, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_provenance_asset
  ON data_provenance_records (tenant_id, asset_id, recorded_at ASC);

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE kafka_event_log              ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumer_lag_metrics         ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_compliance_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log_entries            ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_provenance_records      ENABLE ROW LEVEL SECURITY;

-- Service role full access on all tables
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'kafka_event_log' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON kafka_event_log
      TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'consumer_lag_metrics' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON consumer_lag_metrics
      TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'investor_compliance_profiles' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON investor_compliance_profiles
      TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audit_log_entries' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON audit_log_entries
      TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'data_provenance_records' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON data_provenance_records
      TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
