-- =============================================================================
-- Agency Group — SH-ROS | AMI: 22506
-- Migration 000086: Zero Trust Security Layer
-- Wave 44 Agent 1 — Production Lock
-- =============================================================================

-- 000086_security_zero_trust.sql

CREATE TABLE IF NOT EXISTS security_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  roles TEXT[] NOT NULL DEFAULT '{}',
  permissions TEXT[] NOT NULL DEFAULT '{}',
  ip_address TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  mfa_verified BOOLEAN NOT NULL DEFAULT false,
  jit_elevated BOOLEAN NOT NULL DEFAULT false,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '8 hours',
  last_seen_at TIMESTAMPTZ,
  revoked BOOLEAN NOT NULL DEFAULT false,
  revoke_reason TEXT
);

CREATE TABLE IF NOT EXISTS jit_access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  permission TEXT NOT NULL,
  approved_by TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS threat_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('INFO','LOW','MEDIUM','HIGH','CRITICAL')),
  source_ip TEXT NOT NULL DEFAULT '',
  user_id TEXT,
  session_id TEXT,
  endpoint TEXT,
  description TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}',
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  auto_blocked BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS secret_rotation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_name TEXT NOT NULL UNIQUE,
  version INTEGER NOT NULL DEFAULT 1,
  rotated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  rotated_by TEXT NOT NULL DEFAULT 'system',
  expires_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'ENV' CHECK (source IN ('ENV','VAULT','AWS_SECRETS_MANAGER')),
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_security_sessions_token ON security_sessions(token_hash) WHERE revoked = false;
CREATE INDEX IF NOT EXISTS idx_security_sessions_user ON security_sessions(user_id, expires_at DESC) WHERE revoked = false;
CREATE INDEX IF NOT EXISTS idx_security_sessions_tenant ON security_sessions(tenant_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_jit_grants_user ON jit_access_grants(user_id, expires_at DESC) WHERE revoked = false;
CREATE INDEX IF NOT EXISTS idx_threat_events_tenant_time ON threat_events(tenant_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_threat_events_severity ON threat_events(severity, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_threat_events_ip ON threat_events(source_ip, detected_at DESC);

-- RLS
ALTER TABLE security_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE jit_access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE threat_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE secret_rotation_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='security_sessions' AND policyname='service_role_security_sessions') THEN
    CREATE POLICY "service_role_security_sessions" ON security_sessions FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='jit_access_grants' AND policyname='service_role_jit_access_grants') THEN
    CREATE POLICY "service_role_jit_access_grants" ON jit_access_grants FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='threat_events' AND policyname='service_role_threat_events') THEN
    CREATE POLICY "service_role_threat_events" ON threat_events FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='secret_rotation_log' AND policyname='service_role_secret_rotation') THEN
    CREATE POLICY "service_role_secret_rotation" ON secret_rotation_log FOR ALL USING (true);
  END IF;
END $$;
