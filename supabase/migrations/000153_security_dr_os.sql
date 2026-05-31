-- Wave 57 — Global Security & DR Operating System
-- Tables: forensic_audit_log, security_defense_runs

CREATE TABLE IF NOT EXISTS forensic_audit_log (
  id bigserial PRIMARY KEY,
  log_id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  actor text NOT NULL,
  action text NOT NULL,
  payload_hash text NOT NULL,
  chain_hash text NOT NULL,
  prev_hash text NOT NULL DEFAULT '0000000000000000000000000000000000000000000000000000000000000000',
  correlation_id uuid,
  payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE forensic_audit_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='forensic_audit_log' AND policyname='service_role_all') THEN CREATE POLICY service_role_all ON forensic_audit_log FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
CREATE INDEX IF NOT EXISTS idx_forensic_tenant  ON forensic_audit_log (tenant_id);
CREATE INDEX IF NOT EXISTS idx_forensic_action  ON forensic_audit_log (action);
CREATE INDEX IF NOT EXISTS idx_forensic_date    ON forensic_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forensic_actor   ON forensic_audit_log (actor);

CREATE TABLE IF NOT EXISTS security_defense_runs (
  id bigserial PRIMARY KEY,
  defense_id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  waf_status text NOT NULL DEFAULT 'MISCONFIGURED',
  vault_status text NOT NULL DEFAULT 'CRITICAL',
  logs_integrity boolean NOT NULL DEFAULT false,
  dr_status text NOT NULL DEFAULT 'CRITICAL',
  any_failure boolean NOT NULL DEFAULT true,
  escalated boolean NOT NULL DEFAULT false,
  report_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE security_defense_runs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='security_defense_runs' AND policyname='service_role_all') THEN CREATE POLICY service_role_all ON security_defense_runs FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
CREATE INDEX IF NOT EXISTS idx_sec_def_tenant  ON security_defense_runs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_sec_def_failure ON security_defense_runs (any_failure);
CREATE INDEX IF NOT EXISTS idx_sec_def_date    ON security_defense_runs (created_at DESC);
