-- Wave 51 Phase 6 — DR/Chaos Truth
-- table: dr_chaos_truth_reports

CREATE TABLE IF NOT EXISTS dr_chaos_truth_reports (
  id                  bigserial PRIMARY KEY,
  report_id           uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL,
  dr_status           text NOT NULL DEFAULT 'DR_NOT_PROVEN',
  resilience_score    numeric(5,2) NOT NULL DEFAULT 0,
  rto_compliance_pct  numeric(5,2) NOT NULL DEFAULT 0,
  rpo_compliance_pct  numeric(5,2) NOT NULL DEFAULT 0,
  scenarios_proven    integer NOT NULL DEFAULT 0,
  chaos_enabled       boolean NOT NULL DEFAULT false,
  blocker_count       integer NOT NULL DEFAULT 0,
  dr_hash             text NOT NULL,
  report_json         jsonb NOT NULL DEFAULT '{}',
  generated_at        timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE dr_chaos_truth_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'dr_chaos_truth_reports' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON dr_chaos_truth_reports
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_dr_chaos_truth_tenant ON dr_chaos_truth_reports (tenant_id);
CREATE INDEX IF NOT EXISTS idx_dr_chaos_truth_status ON dr_chaos_truth_reports (dr_status);
CREATE INDEX IF NOT EXISTS idx_dr_chaos_truth_date   ON dr_chaos_truth_reports (generated_at DESC);
