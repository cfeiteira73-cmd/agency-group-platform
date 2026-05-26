-- Agency Group — Regulatory Assurance Store
-- Migration: 000107_regulatory_assurance.sql
-- Wave 47 GAP 4 — Regulatory Assurance Engine persistence

CREATE TABLE IF NOT EXISTS regulatory_assurance_reports (
  report_id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                    UUID         NOT NULL,
  assessed_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  -- SOC2
  soc2_overall_score           NUMERIC(5,2) NOT NULL DEFAULT 0,
  soc2_readiness               TEXT         NOT NULL DEFAULT 'NOT_READY',
  -- ISO27001
  iso27001_overall_score       NUMERIC(5,2) NOT NULL DEFAULT 0,
  iso27001_readiness           TEXT         NOT NULL DEFAULT 'NOT_READY',
  -- Gates
  gates_passed                 INTEGER      NOT NULL DEFAULT 0,
  gates_total                  INTEGER      NOT NULL DEFAULT 0,
  -- Audit bundle reference
  audit_bundle_id              UUID,
  -- Blocking
  institutional_access_blocked BOOLEAN      NOT NULL DEFAULT true,
  fund_access_blocked          BOOLEAN      NOT NULL DEFAULT true,
  blocking_issues              TEXT[]       NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_regulatory_reports_tenant
  ON regulatory_assurance_reports(tenant_id, assessed_at DESC);

ALTER TABLE regulatory_assurance_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'regulatory_assurance_reports'
      AND policyname = 'service_role_full_access'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY service_role_full_access ON regulatory_assurance_reports
        FOR ALL TO service_role USING (true) WITH CHECK (true)
    $pol$;
  END IF;
END $$;
