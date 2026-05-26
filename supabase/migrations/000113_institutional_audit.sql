-- Agency Group — Institutional Audit Reality Layer Store
-- Migration: 000113_institutional_audit.sql
-- Wave 48 GAP 4 — OWASP coverage, pentest readiness, signed evidence chain

CREATE TABLE IF NOT EXISTS institutional_audit_reports (
  report_id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID         NOT NULL,
  assessed_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  audit_readiness_status  TEXT         NOT NULL DEFAULT 'NOT_READY',
  owasp_coverage_pct      NUMERIC(5,2) NOT NULL DEFAULT 0,
  pentest_readiness       TEXT         NOT NULL DEFAULT 'NOT_SCHEDULED',
  critical_vulnerabilities INTEGER     NOT NULL DEFAULT 0,
  high_vulnerabilities    INTEGER      NOT NULL DEFAULT 0,
  medium_vulnerabilities  INTEGER      NOT NULL DEFAULT 0,
  low_vulnerabilities     INTEGER      NOT NULL DEFAULT 0,
  evidence_items          INTEGER      NOT NULL DEFAULT 0,
  chain_of_custody_hash   TEXT         NOT NULL DEFAULT '',
  owasp_map               JSONB        NOT NULL DEFAULT '{}'::jsonb,
  evidence_chain          JSONB        NOT NULL DEFAULT '[]'::jsonb,
  vulnerabilities         JSONB        NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_institutional_audit_tenant
  ON institutional_audit_reports(tenant_id, assessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_institutional_audit_status
  ON institutional_audit_reports(tenant_id, audit_readiness_status, assessed_at DESC);

ALTER TABLE institutional_audit_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'institutional_audit_reports'
      AND policyname = 'service_role_full_access'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY service_role_full_access ON institutional_audit_reports
        FOR ALL TO service_role USING (true) WITH CHECK (true)
    $pol$;
  END IF;
END $$;

-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_evidence_chain (
  evidence_id       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID         NOT NULL,
  evidence_type     TEXT         NOT NULL,
  evidence_ref      TEXT         NOT NULL,
  fingerprint       TEXT         NOT NULL,
  chain_position    INTEGER      NOT NULL DEFAULT 0,
  captured_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  immutable         BOOLEAN      NOT NULL DEFAULT true
);

-- Evidence chain is append-only / immutable
CREATE INDEX IF NOT EXISTS idx_evidence_chain_tenant
  ON audit_evidence_chain(tenant_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_evidence_chain_position
  ON audit_evidence_chain(tenant_id, chain_position);

ALTER TABLE audit_evidence_chain ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audit_evidence_chain'
      AND policyname = 'service_role_full_access'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY service_role_full_access ON audit_evidence_chain
        FOR ALL TO service_role USING (true) WITH CHECK (true)
    $pol$;
  END IF;
END $$;

-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pentest_vulnerabilities (
  vuln_id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID         NOT NULL,
  owasp_category    TEXT         NOT NULL,
  title             TEXT         NOT NULL,
  severity          TEXT         NOT NULL DEFAULT 'LOW',
  status            TEXT         NOT NULL DEFAULT 'OPEN',
  sla_days          INTEGER      NOT NULL DEFAULT 30,
  discovered_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  due_date          TIMESTAMPTZ,
  resolved_at       TIMESTAMPTZ,
  description       TEXT
);

CREATE INDEX IF NOT EXISTS idx_pentest_vulns_tenant
  ON pentest_vulnerabilities(tenant_id, discovered_at DESC);

CREATE INDEX IF NOT EXISTS idx_pentest_vulns_open
  ON pentest_vulnerabilities(tenant_id, severity) WHERE status = 'OPEN';

ALTER TABLE pentest_vulnerabilities ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pentest_vulnerabilities'
      AND policyname = 'service_role_full_access'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY service_role_full_access ON pentest_vulnerabilities
        FOR ALL TO service_role USING (true) WITH CHECK (true)
    $pol$;
  END IF;
END $$;
