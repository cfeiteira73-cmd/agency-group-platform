-- Agency Group — DR Simulation Runs
-- Migration: 000101_dr_simulation.sql

CREATE TABLE IF NOT EXISTS dr_simulation_runs (
  simulation_id        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID         NOT NULL,
  simulated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  overall_dr_grade     TEXT         NOT NULL,
  rto_target_minutes   INTEGER      NOT NULL DEFAULT 10,
  rpo_target_minutes   INTEGER      NOT NULL DEFAULT 0,
  rto_achievable       BOOLEAN      NOT NULL DEFAULT FALSE,
  rpo_achievable       BOOLEAN      NOT NULL DEFAULT FALSE,
  scenarios            JSONB        NOT NULL DEFAULT '[]'::jsonb,
  dr_certification     JSONB,
  action_items         TEXT[]       NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_dr_sims_tenant
  ON dr_simulation_runs(tenant_id, simulated_at DESC);

ALTER TABLE dr_simulation_runs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'dr_simulation_runs'
      AND policyname = 'service_role_full_access'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY service_role_full_access ON dr_simulation_runs
        FOR ALL TO service_role USING (true) WITH CHECK (true)
    $pol$;
  END IF;
END $$;
