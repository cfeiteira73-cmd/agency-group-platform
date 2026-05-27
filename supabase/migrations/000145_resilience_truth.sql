-- Wave 52 Phase 6 — Absolute Resilience Truth
-- table: absolute_resilience_reports

CREATE TABLE IF NOT EXISTS absolute_resilience_reports (
  id                    bigserial PRIMARY KEY,
  report_id             uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL,
  resilience_grade      text NOT NULL DEFAULT 'DR_CRITICAL',
  overall_score         numeric(5,2) NOT NULL DEFAULT 0,
  total_scenarios       integer NOT NULL DEFAULT 0,
  proven_count          integer NOT NULL DEFAULT 0,
  rto_compliant_count   integer NOT NULL DEFAULT 0,
  rpo_compliant_count   integer NOT NULL DEFAULT 0,
  chaos_env_required    boolean NOT NULL DEFAULT true,
  blockers              jsonb NOT NULL DEFAULT '[]',
  resilience_hash       text NOT NULL,
  report_json           jsonb NOT NULL DEFAULT '{}',
  generated_at          timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE absolute_resilience_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'absolute_resilience_reports' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON absolute_resilience_reports
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_abs_res_tenant  ON absolute_resilience_reports (tenant_id);
CREATE INDEX IF NOT EXISTS idx_abs_res_grade   ON absolute_resilience_reports (resilience_grade);
CREATE INDEX IF NOT EXISTS idx_abs_res_score   ON absolute_resilience_reports (overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_abs_res_date    ON absolute_resilience_reports (generated_at DESC);
