-- Wave 51 Phase 5 — Live Security Hardening
-- tables: security_hardening_reports, security_incidents

CREATE TABLE IF NOT EXISTS security_hardening_reports (
  id                        bigserial PRIMARY KEY,
  report_id                 uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id                 uuid NOT NULL,
  security_status           text NOT NULL DEFAULT 'NOT_CONFIGURED',
  security_score            numeric(5,2) NOT NULL DEFAULT 0,
  owasp_pass_count          integer NOT NULL DEFAULT 0,
  incident_chain_length     integer NOT NULL DEFAULT 0,
  incident_chain_head_hash  text,
  blocker_count             integer NOT NULL DEFAULT 0,
  security_hash             text NOT NULL,
  report_json               jsonb NOT NULL DEFAULT '{}',
  generated_at              timestamptz NOT NULL DEFAULT now(),
  created_at                timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS security_incidents (
  id          uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   uuid NOT NULL,
  severity    text NOT NULL DEFAULT 'LOW',
  category    text,
  description text,
  resolved    boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE security_hardening_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_incidents         ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'security_hardening_reports' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON security_hardening_reports
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'security_incidents' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON security_incidents
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_security_hardening_tenant   ON security_hardening_reports (tenant_id);
CREATE INDEX IF NOT EXISTS idx_security_incidents_tenant   ON security_incidents (tenant_id);
CREATE INDEX IF NOT EXISTS idx_security_incidents_severity ON security_incidents (severity);
CREATE INDEX IF NOT EXISTS idx_security_incidents_date     ON security_incidents (created_at DESC);
