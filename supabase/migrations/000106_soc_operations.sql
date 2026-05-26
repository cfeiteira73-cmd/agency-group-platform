-- Agency Group — Security Operations Center Store
-- Migration: 000106_soc_operations.sql
-- Wave 47 GAP 3 — SOC Layer persistence

-- SOC incidents
CREATE TABLE IF NOT EXISTS soc_incidents (
  incident_id       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID         NOT NULL,
  severity          TEXT         NOT NULL DEFAULT 'SEV4',
  incident_type     TEXT         NOT NULL,
  description       TEXT         NOT NULL,
  affected_systems  TEXT[]       NOT NULL DEFAULT '{}',
  evidence          JSONB        NOT NULL DEFAULT '{}'::jsonb,
  status            TEXT         NOT NULL DEFAULT 'OPEN',
  playbook_type     TEXT,
  playbook_steps    JSONB        NOT NULL DEFAULT '[]'::jsonb,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  resolved_at       TIMESTAMPTZ,
  resolution_notes  TEXT
);

CREATE INDEX IF NOT EXISTS idx_soc_incidents_tenant_severity
  ON soc_incidents(tenant_id, severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_soc_incidents_open
  ON soc_incidents(tenant_id, status)
  WHERE status = 'OPEN';

-- SOC reports (summary reports for institutional auditors)
CREATE TABLE IF NOT EXISTS soc_reports (
  report_id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID         NOT NULL,
  generated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  soc_readiness_score   NUMERIC(5,2) NOT NULL DEFAULT 0,
  security_grade        TEXT         NOT NULL DEFAULT 'F',
  open_incidents        INTEGER      NOT NULL DEFAULT 0,
  sev1_count            INTEGER      NOT NULL DEFAULT 0,
  sev2_count            INTEGER      NOT NULL DEFAULT 0,
  key_rotation_overdue  BOOLEAN      NOT NULL DEFAULT false,
  owasp_simulations     JSONB        NOT NULL DEFAULT '[]'::jsonb,
  issues                TEXT[]       NOT NULL DEFAULT '{}',
  recommendations       TEXT[]       NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_soc_reports_tenant
  ON soc_reports(tenant_id, generated_at DESC);

-- RLS
ALTER TABLE soc_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE soc_reports   ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'soc_incidents'
      AND policyname = 'service_role_full_access'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY service_role_full_access ON soc_incidents
        FOR ALL TO service_role USING (true) WITH CHECK (true)
    $pol$;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'soc_reports'
      AND policyname = 'service_role_full_access'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY service_role_full_access ON soc_reports
        FOR ALL TO service_role USING (true) WITH CHECK (true)
    $pol$;
  END IF;
END $$;
