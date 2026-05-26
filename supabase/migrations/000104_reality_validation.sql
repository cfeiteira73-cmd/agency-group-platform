-- Agency Group — Reality Validation Store
-- Migration: 000104_reality_validation.sql
-- Wave 47 GAP 1 — External Reality Validator persistence

CREATE TABLE IF NOT EXISTS reality_validation_runs (
  run_id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id               TEXT         NOT NULL,
  tenant_id               UUID         NOT NULL,
  validated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  overall_reality_score   NUMERIC(5,2) NOT NULL DEFAULT 0,
  system_reality_state    TEXT         NOT NULL DEFAULT 'ARCHITECTURE_ONLY',
  simulation_flags        TEXT[]       NOT NULL DEFAULT '{}',
  fallback_log            TEXT[]       NOT NULL DEFAULT '{}',
  sources                 JSONB        NOT NULL DEFAULT '[]'::jsonb,
  recommendation          TEXT
);

CREATE INDEX IF NOT EXISTS idx_reality_runs_tenant
  ON reality_validation_runs(tenant_id, validated_at DESC);

ALTER TABLE reality_validation_runs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'reality_validation_runs'
      AND policyname = 'service_role_full_access'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY service_role_full_access ON reality_validation_runs
        FOR ALL TO service_role USING (true) WITH CHECK (true)
    $pol$;
  END IF;
END $$;
