-- 000045: Portal Security Audits and RBAC Integrity tables

CREATE TABLE IF NOT EXISTS portal_security_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  auth_enforcement JSONB NOT NULL DEFAULT '{}',
  tenant_isolation JSONB NOT NULL DEFAULT '{}',
  api_exposure JSONB NOT NULL DEFAULT '{}',
  audit_trail JSONB NOT NULL DEFAULT '{}',
  vulnerabilities JSONB NOT NULL DEFAULT '[]',
  security_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rbac_integrity_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  section_permissions JSONB NOT NULL DEFAULT '[]',
  privilege_escalation_attempts JSONB NOT NULL DEFAULT '[]',
  role_distribution JSONB NOT NULL DEFAULT '[]',
  rbac_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  policies_active INTEGER NOT NULL DEFAULT 0,
  policies_missing INTEGER NOT NULL DEFAULT 0,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_portal_security_audits_tenant ON portal_security_audits(tenant_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_rbac_integrity_reports_tenant ON rbac_integrity_reports(tenant_id, generated_at DESC);

-- RLS
ALTER TABLE portal_security_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE rbac_integrity_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='portal_security_audits' AND policyname='tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON portal_security_audits USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rbac_integrity_reports' AND policyname='tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON rbac_integrity_reports USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;
