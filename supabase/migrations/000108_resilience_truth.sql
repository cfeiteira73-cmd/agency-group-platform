-- Agency Group — Resilience Truth Store
-- Migration: 000108_resilience_truth.sql
-- Wave 47 GAP 5 — Resilience Truth Engine persistence

CREATE TABLE IF NOT EXISTS resilience_truth_reports (
  report_id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID         NOT NULL,
  assessed_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  dr_truth_status          TEXT         NOT NULL DEFAULT 'UNVERIFIED',
  chaos_gauntlet_score     NUMERIC(5,2) NOT NULL DEFAULT 0,
  chaos_scenarios_passed   INTEGER      NOT NULL DEFAULT 0,
  chaos_scenarios_total    INTEGER      NOT NULL DEFAULT 0,
  rto_target_seconds       INTEGER      NOT NULL DEFAULT 600,
  rto_worst_case_seconds   INTEGER      NOT NULL DEFAULT 0,
  rto_target_met           BOOLEAN      NOT NULL DEFAULT false,
  rpo_target_seconds       INTEGER      NOT NULL DEFAULT 0,
  rpo_verified             BOOLEAN      NOT NULL DEFAULT false,
  resilience_score         NUMERIC(5,2) NOT NULL DEFAULT 0,
  resilience_grade         TEXT         NOT NULL DEFAULT 'F',
  institutional_dr_ready   BOOLEAN      NOT NULL DEFAULT false,
  critical_failures        TEXT[]       NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_resilience_reports_tenant
  ON resilience_truth_reports(tenant_id, assessed_at DESC);

ALTER TABLE resilience_truth_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'resilience_truth_reports'
      AND policyname = 'service_role_full_access'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY service_role_full_access ON resilience_truth_reports
        FOR ALL TO service_role USING (true) WITH CHECK (true)
    $pol$;
  END IF;
END $$;
