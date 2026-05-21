-- 000037: Zero-Trust Access and Session Recording tables

-- Zero-trust policies
CREATE TABLE IF NOT EXISTS zero_trust_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  resource_pattern TEXT NOT NULL,
  required_trust_level TEXT NOT NULL DEFAULT 'basic' CHECK (required_trust_level IN ('none','basic','elevated','privileged')),
  require_mfa BOOLEAN NOT NULL DEFAULT false,
  require_hardware_mfa BOOLEAN NOT NULL DEFAULT false,
  max_session_age_minutes INTEGER NOT NULL DEFAULT 480,
  require_jit_approval BOOLEAN NOT NULL DEFAULT false,
  approvers_required INTEGER NOT NULL DEFAULT 0,
  geo_restrictions JSONB NOT NULL DEFAULT '[]',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, resource_pattern)
);

-- Access evaluations log
CREATE TABLE IF NOT EXISTS access_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  tenant_id UUID NOT NULL,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  trust_level TEXT NOT NULL,
  mfa_verified BOOLEAN NOT NULL DEFAULT false,
  hardware_mfa_verified BOOLEAN NOT NULL DEFAULT false,
  session_age_minutes INTEGER NOT NULL DEFAULT 0,
  geo_location TEXT,
  decision TEXT NOT NULL CHECK (decision IN ('allow','deny','require_elevation','require_approval')),
  policy_matched TEXT,
  denial_reason TEXT,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- JIT elevation requests
CREATE TABLE IF NOT EXISTS jit_elevation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  tenant_id UUID NOT NULL,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  justification TEXT NOT NULL,
  approvers JSONB NOT NULL DEFAULT '[]',
  approved_by JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','denied','expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  elevation_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Privileged session log (immutable — no RLS UPDATE/DELETE)
CREATE TABLE IF NOT EXISTS privileged_session_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  tenant_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  action_detail TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  payload_hash TEXT NOT NULL,
  previous_record_hash TEXT,
  record_hash TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  approved_by TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User sessions (for revocation tracking)
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  tenant_id UUID NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Access risk flags
CREATE TABLE IF NOT EXISTS access_risk_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  tenant_id UUID NOT NULL,
  reason TEXT NOT NULL,
  risk_score INTEGER NOT NULL DEFAULT 50,
  active BOOLEAN NOT NULL DEFAULT true,
  resolved_at TIMESTAMPTZ,
  flagged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Region recovery audit
CREATE TABLE IF NOT EXISTS region_recovery_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  scenario TEXT NOT NULL,
  recovery_report JSONB NOT NULL,
  rto_met BOOLEAN NOT NULL,
  rpo_met BOOLEAN NOT NULL,
  recovery_grade TEXT NOT NULL,
  dry_run BOOLEAN NOT NULL DEFAULT true,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_zero_trust_policies_tenant ON zero_trust_policies(tenant_id, active);
CREATE INDEX IF NOT EXISTS idx_access_evaluations_user ON access_evaluations(user_id, tenant_id, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_jit_requests_user ON jit_elevation_requests(user_id, tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_privileged_session_log_session ON privileged_session_log(session_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_privileged_session_log_user ON privileged_session_log(user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id, tenant_id, active);
CREATE INDEX IF NOT EXISTS idx_access_risk_flags_tenant ON access_risk_flags(tenant_id, active);

-- RLS
ALTER TABLE zero_trust_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE jit_elevation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE privileged_session_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_risk_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE region_recovery_audit ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='privileged_session_log' AND policyname='tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON privileged_session_log USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='access_evaluations' AND policyname='tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON access_evaluations USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='jit_elevation_requests' AND policyname='tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON jit_elevation_requests USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;
