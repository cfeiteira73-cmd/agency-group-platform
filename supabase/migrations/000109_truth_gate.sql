-- Agency Group — Institutional Truth Gate Store
-- Migration: 000109_truth_gate.sql
-- Wave 47 Final Gate — Institutional truth gate persistence

CREATE TABLE IF NOT EXISTS institutional_truth_gates (
  report_id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                    UUID         NOT NULL,
  assessed_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  system_truth_status          TEXT         NOT NULL DEFAULT 'INSTITUTIONAL_BLOCKED',
  overall_score                NUMERIC(5,2) NOT NULL DEFAULT 0,
  gates_passed                 INTEGER      NOT NULL DEFAULT 0,
  gates_total                  INTEGER      NOT NULL DEFAULT 9,
  gates_failed_blocking        INTEGER      NOT NULL DEFAULT 0,
  sha256_truth_hash            TEXT         NOT NULL DEFAULT '',
  institutional_access_granted BOOLEAN      NOT NULL DEFAULT false,
  fund_access_granted          BOOLEAN      NOT NULL DEFAULT false,
  wave47_complete              BOOLEAN      NOT NULL DEFAULT false
);

-- The sha256_truth_hash is the immutable proof of gate verdicts
-- Once inserted, it should not be updated
CREATE INDEX IF NOT EXISTS idx_truth_gates_tenant
  ON institutional_truth_gates(tenant_id, assessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_truth_gates_access
  ON institutional_truth_gates(tenant_id, institutional_access_granted, assessed_at DESC);

ALTER TABLE institutional_truth_gates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'institutional_truth_gates'
      AND policyname = 'service_role_full_access'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY service_role_full_access ON institutional_truth_gates
        FOR ALL TO service_role USING (true) WITH CHECK (true)
    $pol$;
  END IF;
END $$;
