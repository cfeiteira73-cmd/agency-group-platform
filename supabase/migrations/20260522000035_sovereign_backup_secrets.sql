-- 000035: Sovereign Backup & Secret Management tables
-- Wave 35 Phase 1+2 — Immutable backup orchestration, air-gap replication,
-- recovery manifests, credential registry, rotation log, secret scan results.

-- ---------------------------------------------------------------------------
-- Immutable backups registry
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS immutable_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('aws_s3', 'gcp_gcs', 'local')),
  bucket TEXT NOT NULL,
  object_key TEXT NOT NULL,
  retention_tier TEXT NOT NULL CHECK (retention_tier IN ('30d', '90d', '365d', 'permanent')),
  worm_enforced BOOLEAN NOT NULL DEFAULT false,
  content_sha256 TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  restore_verified BOOLEAN NOT NULL DEFAULT false,
  restore_verified_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Air-gap replication jobs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS air_gap_replication_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  source_backup_id UUID NOT NULL,
  target_id TEXT NOT NULL,
  target_provider TEXT NOT NULL,
  target_region TEXT NOT NULL,
  target_bucket TEXT NOT NULL,
  delay_hours INTEGER NOT NULL DEFAULT 12,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','failed')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  executed_at TIMESTAMPTZ,
  integrity_hash TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Recovery manifests (chained)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recovery_manifests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  version INTEGER NOT NULL,
  previous_manifest_hash TEXT,
  manifest_hash TEXT NOT NULL,
  db_snapshot_checksum TEXT NOT NULL DEFAULT '',
  db_row_counts JSONB NOT NULL DEFAULT '{}',
  kafka_replay_watermark TEXT NOT NULL DEFAULT '',
  event_count_total BIGINT NOT NULL DEFAULT 0,
  ml_artifact_hashes JSONB NOT NULL DEFAULT '{}',
  last_training_run_id UUID,
  audit_chain_last_hash TEXT NOT NULL DEFAULT '',
  audit_sequence_number BIGINT NOT NULL DEFAULT 0,
  recovery_tested BOOLEAN NOT NULL DEFAULT false,
  recovery_tested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, version)
);

-- ---------------------------------------------------------------------------
-- Credential registry
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS credential_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  credential_name TEXT NOT NULL,
  credential_type TEXT NOT NULL CHECK (credential_type IN ('api_key','db_password','jwt_secret','webhook_secret','service_account')),
  backend TEXT NOT NULL CHECK (backend IN ('vault','aws_secrets_manager','gcp_secret_manager','env')),
  last_rotated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  rotation_ttl_days INTEGER NOT NULL DEFAULT 90,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','rotating','revoked','expired')),
  auto_rotate BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, credential_name)
);

-- ---------------------------------------------------------------------------
-- Credential rotation log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS credential_rotation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  credential_id UUID NOT NULL,
  credential_name TEXT NOT NULL,
  rotated BOOLEAN NOT NULL,
  new_version TEXT,
  error_message TEXT,
  rotated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Secret scan results
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS secret_scan_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  scan_target TEXT NOT NULL,
  findings JSONB NOT NULL DEFAULT '[]',
  risk_level TEXT NOT NULL DEFAULT 'none',
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_immutable_backups_tenant ON immutable_backups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_immutable_backups_tier ON immutable_backups(tenant_id, retention_tier);
CREATE INDEX IF NOT EXISTS idx_air_gap_jobs_status ON air_gap_replication_jobs(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_air_gap_jobs_tenant ON air_gap_replication_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_recovery_manifests_tenant ON recovery_manifests(tenant_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_credential_registry_tenant ON credential_registry(tenant_id);
CREATE INDEX IF NOT EXISTS idx_credential_rotation_log_cred ON credential_rotation_log(credential_id);
CREATE INDEX IF NOT EXISTS idx_secret_scan_results_tenant ON secret_scan_results(tenant_id, scanned_at DESC);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE immutable_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE air_gap_replication_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE credential_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE credential_rotation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE secret_scan_results ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'immutable_backups' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON immutable_backups
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'air_gap_replication_jobs' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON air_gap_replication_jobs
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'recovery_manifests' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON recovery_manifests
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'credential_registry' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON credential_registry
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'credential_rotation_log' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON credential_rotation_log
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'secret_scan_results' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON secret_scan_results
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;
