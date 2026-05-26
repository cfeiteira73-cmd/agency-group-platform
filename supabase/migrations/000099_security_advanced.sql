-- Agency Group — Advanced Security Infrastructure
-- Migration: 000099_security_advanced.sql

-- Security simulation results
CREATE TABLE IF NOT EXISTS security_simulation_runs (
  run_id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID         NOT NULL,
  run_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  total_simulations       INTEGER      NOT NULL,
  passed                  INTEGER      NOT NULL,
  failed                  INTEGER      NOT NULL,
  overall_defense_score   INTEGER      NOT NULL,
  security_grade          TEXT         NOT NULL,
  results                 JSONB        NOT NULL DEFAULT '[]'::jsonb
);

-- Secret rotation log (audit trail for secrets management)
CREATE TABLE IF NOT EXISTS secret_rotation_log (
  rotation_id     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID         NOT NULL,
  secret_key      TEXT         NOT NULL,
  provider        TEXT         NOT NULL,
  rotated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  rotated_by      TEXT         NOT NULL,
  success         BOOLEAN      NOT NULL DEFAULT TRUE,
  error_message   TEXT
);

-- SIEM forwarding audit (track what was sent to external SIEMs)
CREATE TABLE IF NOT EXISTS siem_forwarding_log (
  log_id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID         NOT NULL,
  event_type      TEXT         NOT NULL,
  severity        TEXT         NOT NULL,
  forwarded_to    TEXT[]       NOT NULL DEFAULT '{}',
  forwarded_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  source_event_id UUID
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_security_sims_tenant ON security_simulation_runs(tenant_id, run_at DESC);
CREATE INDEX IF NOT EXISTS idx_secret_rotation_tenant ON secret_rotation_log(tenant_id, rotated_at DESC);
CREATE INDEX IF NOT EXISTS idx_siem_forwarding_tenant ON siem_forwarding_log(tenant_id, forwarded_at DESC);

-- RLS
ALTER TABLE security_simulation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE secret_rotation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE siem_forwarding_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'security_simulation_runs' AND policyname = 'service_role_security_sims') THEN
    CREATE POLICY service_role_security_sims ON security_simulation_runs FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'secret_rotation_log' AND policyname = 'service_role_secret_rotation') THEN
    CREATE POLICY service_role_secret_rotation ON secret_rotation_log FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'siem_forwarding_log' AND policyname = 'service_role_siem_forwarding') THEN
    CREATE POLICY service_role_siem_forwarding ON siem_forwarding_log FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
