-- Wave 51 Phase 10 — Final Absolute Certification Gate
-- table: final_absolute_certifications
-- 30 total gates: Wave 50 (24) + Wave 51 (6)

CREATE TABLE IF NOT EXISTS final_absolute_certifications (
  id                    bigserial PRIMARY KEY,
  report_id             uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL,
  final_system_status   text NOT NULL DEFAULT 'INSTITUTIONAL_BLOCKED',
  total_gates_passed    integer NOT NULL DEFAULT 0,
  total_gates           integer NOT NULL DEFAULT 30,
  gate_pass_pct         numeric(5,2) NOT NULL DEFAULT 0,
  blended_score         numeric(5,2) NOT NULL DEFAULT 0,
  go_live_authorized    boolean NOT NULL DEFAULT false,
  blocker_count         integer NOT NULL DEFAULT 0,
  final_truth_hash      text NOT NULL,
  certificate_hash      text NOT NULL,
  report_json           jsonb NOT NULL DEFAULT '{}',
  generated_at          timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (final_truth_hash)
);

ALTER TABLE final_absolute_certifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'final_absolute_certifications' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON final_absolute_certifications
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_final_cert_tenant      ON final_absolute_certifications (tenant_id);
CREATE INDEX IF NOT EXISTS idx_final_cert_status      ON final_absolute_certifications (final_system_status);
CREATE INDEX IF NOT EXISTS idx_final_cert_go_live     ON final_absolute_certifications (go_live_authorized);
CREATE INDEX IF NOT EXISTS idx_final_cert_date        ON final_absolute_certifications (generated_at DESC);
