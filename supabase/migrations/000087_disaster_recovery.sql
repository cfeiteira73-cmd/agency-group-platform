-- 000087_disaster_recovery.sql
-- Agency Group — Wave 44 Agent 2: Disaster Recovery + Backup Orchestrator + Event Replay Engine
-- RTO < 10 minutes, RPO = 0

CREATE TABLE IF NOT EXISTS backup_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_id TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  backup_type TEXT NOT NULL CHECK (backup_type IN ('DAILY_SNAPSHOT','HOURLY_DELTA','TRANSACTION_LOG','SCHEMA_BACKUP','FULL_RESTORE_POINT')),
  status TEXT NOT NULL CHECK (status IN ('SCHEDULED','IN_PROGRESS','COMPLETED','FAILED','VERIFIED')) DEFAULT 'SCHEDULED',
  source_region TEXT NOT NULL DEFAULT 'EU_WEST',
  replicated_regions TEXT[] NOT NULL DEFAULT '{}',
  size_bytes BIGINT,
  row_count BIGINT,
  tables_included TEXT[] NOT NULL DEFAULT '{}',
  storage_path TEXT NOT NULL DEFAULT '',
  worm_locked BOOLEAN NOT NULL DEFAULT false,
  encrypted BOOLEAN NOT NULL DEFAULT false,
  checksum_sha256 TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  retention_days INTEGER NOT NULL DEFAULT 90,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '90 days'
);

CREATE TABLE IF NOT EXISTS replication_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_id TEXT NOT NULL,
  region TEXT NOT NULL,
  succeeded BOOLEAN NOT NULL DEFAULT false,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (backup_id, region)
);

CREATE TABLE IF NOT EXISTS region_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('HEALTHY','DEGRADED','OFFLINE')) DEFAULT 'HEALTHY',
  latency_ms INTEGER,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (region)
);

CREATE TABLE IF NOT EXISTS dr_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dr_event_id TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  scenario TEXT NOT NULL,
  phase TEXT NOT NULL DEFAULT 'DETECTION',
  primary_region TEXT NOT NULL DEFAULT 'EU_WEST',
  failover_region TEXT NOT NULL DEFAULT 'EU_SOUTH',
  rto_target_minutes INTEGER NOT NULL DEFAULT 10,
  rpo_target_minutes INTEGER NOT NULL DEFAULT 0,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  failover_initiated_at TIMESTAMPTZ,
  recovered_at TIMESTAMPTZ,
  actual_rto_minutes INTEGER,
  actual_rpo_minutes INTEGER,
  success BOOLEAN,
  root_cause TEXT,
  actions_taken TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS dr_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  test_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('SCHEDULED','RUNNING','PASSED','FAILED','SKIPPED')) DEFAULT 'SCHEDULED',
  rto_measured_minutes INTEGER,
  rpo_measured_minutes INTEGER,
  data_integrity_score NUMERIC(5,2),
  issues_found TEXT[] NOT NULL DEFAULT '{}',
  recommendations TEXT[] NOT NULL DEFAULT '{}',
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  next_scheduled TIMESTAMPTZ NOT NULL DEFAULT now() + interval '30 days'
);

CREATE SEQUENCE IF NOT EXISTS replayable_events_seq START 1;

CREATE TABLE IF NOT EXISTS replayable_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  sequence_number BIGINT NOT NULL DEFAULT nextval('replayable_events_seq') UNIQUE,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  event_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  replayed BOOLEAN NOT NULL DEFAULT false,
  replay_count INTEGER NOT NULL DEFAULT 0
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_backup_records_type_status ON backup_records(backup_type, status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_records_tenant ON backup_records(tenant_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_dr_events_tenant ON dr_events(tenant_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_dr_test_results_tenant ON dr_test_results(tenant_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_replayable_events_seq ON replayable_events(sequence_number ASC);
CREATE INDEX IF NOT EXISTS idx_replayable_events_tenant ON replayable_events(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_replayable_events_aggregate ON replayable_events(aggregate_id, sequence_number ASC);

-- RLS
ALTER TABLE backup_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE replication_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE region_health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE dr_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE dr_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE replayable_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='backup_records' AND policyname='service_role_backup_records') THEN
    CREATE POLICY "service_role_backup_records" ON backup_records FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='replication_status' AND policyname='service_role_replication') THEN
    CREATE POLICY "service_role_replication" ON replication_status FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='region_health_checks' AND policyname='service_role_region_health') THEN
    CREATE POLICY "service_role_region_health" ON region_health_checks FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='dr_events' AND policyname='service_role_dr_events') THEN
    CREATE POLICY "service_role_dr_events" ON dr_events FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='dr_test_results' AND policyname='service_role_dr_tests') THEN
    CREATE POLICY "service_role_dr_tests" ON dr_test_results FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='replayable_events' AND policyname='service_role_replayable') THEN
    CREATE POLICY "service_role_replayable" ON replayable_events FOR ALL USING (true);
  END IF;
END $$;
