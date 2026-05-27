-- Wave 51 Phase 9 — Full System Operational Command Center
-- table: full_system_command_reports

CREATE TABLE IF NOT EXISTS full_system_command_reports (
  id               bigserial PRIMARY KEY,
  command_id       uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL,
  command_status   text NOT NULL DEFAULT 'SYSTEM_OFFLINE',
  blended_score    numeric(5,2) NOT NULL DEFAULT 0,
  w51_score        numeric(5,2) NOT NULL DEFAULT 0,
  w50_score        numeric(5,2) NOT NULL DEFAULT 0,
  total_blockers   integer NOT NULL DEFAULT 0,
  risk_level       text NOT NULL DEFAULT 'CRITICAL',
  hardening_status text NOT NULL DEFAULT 'NOT_HARDENED',
  command_hash     text NOT NULL,
  report_json      jsonb NOT NULL DEFAULT '{}',
  generated_at     timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE full_system_command_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'full_system_command_reports' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON full_system_command_reports
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_full_system_command_tenant ON full_system_command_reports (tenant_id);
CREATE INDEX IF NOT EXISTS idx_full_system_command_status ON full_system_command_reports (command_status);
CREATE INDEX IF NOT EXISTS idx_full_system_command_date   ON full_system_command_reports (generated_at DESC);
