-- =============================================================================
-- Agency Group — SH-ROS Migration 000038
-- Compliance and Sovereign Readiness tables
-- Wave 35 Phase 7+8+9+Final
-- =============================================================================

-- GDPR requests (Art.17 erasure + Art.20 portability)
CREATE TABLE IF NOT EXISTS gdpr_requests (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL,
  subject_type      TEXT        NOT NULL CHECK (subject_type IN ('contact','investor','user')),
  subject_id        TEXT        NOT NULL,
  request_type      TEXT        NOT NULL CHECK (request_type IN ('erasure','portability','access','rectification','restriction')),
  basis             TEXT,
  status            TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','rejected','on_hold')),
  legal_hold        BOOLEAN     NOT NULL DEFAULT false,
  legal_hold_reason TEXT,
  deadline_at       TIMESTAMPTZ NOT NULL,
  completed_at      TIMESTAMPTZ,
  response_package  TEXT,
  submitted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Retention policies
CREATE TABLE IF NOT EXISTS retention_policies (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL,
  data_category   TEXT        NOT NULL,
  retention_days  INTEGER     NOT NULL,
  legal_basis     TEXT        NOT NULL,
  auto_purge      BOOLEAN     NOT NULL DEFAULT false,
  last_purge_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, data_category)
);

-- Audit export packages (tamper-evident)
CREATE TABLE IF NOT EXISTS audit_export_packages (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL,
  period_start  TIMESTAMPTZ NOT NULL,
  period_end    TIMESTAMPTZ NOT NULL,
  package_data  JSONB       NOT NULL DEFAULT '{}',
  package_hash  TEXT        NOT NULL,
  signed_by     TEXT        NOT NULL DEFAULT 'local-hmac',
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sovereign readiness reports
CREATE TABLE IF NOT EXISTS sovereign_readiness_reports (
  id                              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                       UUID        NOT NULL,
  conditions                      JSONB       NOT NULL DEFAULT '[]',
  all_conditions_pass             BOOLEAN     NOT NULL DEFAULT false,
  fail_count                      INTEGER     NOT NULL DEFAULT 0,
  warn_count                      INTEGER     NOT NULL DEFAULT 0,
  security_score                  INTEGER     NOT NULL DEFAULT 0,
  recovery_score                  INTEGER     NOT NULL DEFAULT 0,
  ransomware_survivability_score  INTEGER     NOT NULL DEFAULT 0,
  institutional_readiness_score   INTEGER     NOT NULL DEFAULT 0,
  overall_grade                   TEXT        NOT NULL DEFAULT 'NOT_READY',
  system_validated                BOOLEAN     NOT NULL DEFAULT false,
  validated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SOC2 Type II evidence reports
CREATE TABLE IF NOT EXISTS soc2_reports (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL,
  period_start            TIMESTAMPTZ   NOT NULL,
  period_end              TIMESTAMPTZ   NOT NULL,
  report_data             JSONB         NOT NULL DEFAULT '{}',
  overall_compliance_pct  NUMERIC(5,2)  NOT NULL DEFAULT 0,
  critical_gaps           JSONB         NOT NULL DEFAULT '[]',
  generated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Tenant isolation violations (sovereign condition 10)
CREATE TABLE IF NOT EXISTS tenant_isolation_violations (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  violating_tenant_id UUID        NOT NULL,
  exposed_tenant_id   UUID        NOT NULL,
  violation_type      TEXT        NOT NULL,
  resource_type       TEXT,
  resource_id         TEXT,
  detected_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved            BOOLEAN     NOT NULL DEFAULT false
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_gdpr_requests_tenant
  ON gdpr_requests(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_gdpr_requests_deadline
  ON gdpr_requests(deadline_at)
  WHERE status NOT IN ('completed','rejected');

CREATE INDEX IF NOT EXISTS idx_gdpr_requests_subject
  ON gdpr_requests(tenant_id, subject_type, subject_id);

CREATE INDEX IF NOT EXISTS idx_retention_policies_tenant
  ON retention_policies(tenant_id, data_category);

CREATE INDEX IF NOT EXISTS idx_audit_export_packages_tenant
  ON audit_export_packages(tenant_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_sovereign_readiness_tenant
  ON sovereign_readiness_reports(tenant_id, validated_at DESC);

CREATE INDEX IF NOT EXISTS idx_soc2_reports_tenant
  ON soc2_reports(tenant_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_isolation_violations_active
  ON tenant_isolation_violations(detected_at DESC)
  WHERE resolved = false;

CREATE INDEX IF NOT EXISTS idx_tenant_isolation_violations_tenant
  ON tenant_isolation_violations(violating_tenant_id, detected_at DESC);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE gdpr_requests                ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_policies           ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_export_packages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sovereign_readiness_reports  ENABLE ROW LEVEL SECURITY;
ALTER TABLE soc2_reports                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_isolation_violations  ENABLE ROW LEVEL SECURITY;

-- Service role has full access
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'gdpr_requests' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON gdpr_requests
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'retention_policies' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON retention_policies
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audit_export_packages' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON audit_export_packages
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sovereign_readiness_reports' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON sovereign_readiness_reports
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'soc2_reports' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON soc2_reports
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tenant_isolation_violations' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON tenant_isolation_violations
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Tenant-scoped read via app.tenant_id setting
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'gdpr_requests' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON gdpr_requests
      FOR SELECT USING (
        tenant_id::text = current_setting('app.tenant_id', true)
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sovereign_readiness_reports' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON sovereign_readiness_reports
      FOR SELECT USING (
        tenant_id::text = current_setting('app.tenant_id', true)
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'soc2_reports' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON soc2_reports
      FOR SELECT USING (
        tenant_id::text = current_setting('app.tenant_id', true)
      );
  END IF;
END $$;
