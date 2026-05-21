-- =============================================================================
-- Agency Group — Backup & Recovery Tables
-- Migration: 20260522000029_backup_recovery.sql
--
-- Creates: backup_snapshots, event_archive_log, ml_artifact_log
-- =============================================================================

CREATE TABLE IF NOT EXISTS backup_snapshots (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id        uuid NOT NULL,
  snapshot_type    text NOT NULL CHECK (snapshot_type IN ('daily_full','pitr_marker','pre_migration','manual')),
  status           text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','completed','failed','verified')),
  size_bytes       bigint,
  table_count      integer,
  row_counts       jsonb NOT NULL DEFAULT '{}',
  pitr_timestamp   timestamptz NOT NULL,
  storage_path     text,
  checksum         text,
  retention_days   integer NOT NULL DEFAULT 30,
  expires_at       timestamptz NOT NULL,
  started_at       timestamptz NOT NULL DEFAULT now(),
  completed_at     timestamptz,
  error_message    text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_archive_log (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id        uuid NOT NULL,
  topic            text,
  events_archived  integer NOT NULL DEFAULT 0,
  events_failed    integer NOT NULL DEFAULT 0,
  archive_path     text NOT NULL,
  size_bytes       bigint NOT NULL DEFAULT 0,
  from_timestamp   timestamptz NOT NULL,
  to_timestamp     timestamptz NOT NULL,
  status           text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed')),
  started_at       timestamptz NOT NULL DEFAULT now(),
  completed_at     timestamptz,
  error_message    text
);

CREATE TABLE IF NOT EXISTS ml_artifact_log (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id           uuid NOT NULL,
  artifact_type       text NOT NULL CHECK (artifact_type IN ('model','feature_snapshot','training_run','evaluation_log')),
  name                text NOT NULL,
  version             text NOT NULL,
  storage_path        text NOT NULL,
  size_bytes          bigint,
  model_id            uuid,
  training_run_id     uuid,
  performance_metrics jsonb NOT NULL DEFAULT '{}',
  is_active           boolean NOT NULL DEFAULT false,
  checksum            text,
  backed_up_at        timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz
);

CREATE INDEX IF NOT EXISTS idx_backup_snapshots_tenant ON backup_snapshots (tenant_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_archive_log_tenant ON event_archive_log (tenant_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ml_artifact_log_tenant ON ml_artifact_log (tenant_id, artifact_type, backed_up_at DESC);

ALTER TABLE backup_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_archive_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_artifact_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='backup_snapshots' AND policyname='service_role_all') THEN
    CREATE POLICY service_role_all ON backup_snapshots TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='event_archive_log' AND policyname='service_role_all') THEN
    CREATE POLICY service_role_all ON event_archive_log TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ml_artifact_log' AND policyname='service_role_all') THEN
    CREATE POLICY service_role_all ON ml_artifact_log TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
