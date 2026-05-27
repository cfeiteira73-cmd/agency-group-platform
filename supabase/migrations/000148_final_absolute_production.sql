-- Wave 52 Phase 9 — Final Absolute Production Certification
-- table: final_production_certifications
-- 39 total gates: Wave 50 (24) + Wave 51 (6) + Wave 52 (9)

CREATE TABLE IF NOT EXISTS final_production_certifications (
  id                    bigserial PRIMARY KEY,
  report_id             uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL,
  final_status          text NOT NULL DEFAULT 'PRODUCTION_CERTIFICATION_BLOCKED',
  total_gates           integer NOT NULL DEFAULT 39,
  gates_passed          integer NOT NULL DEFAULT 0,
  gates_failed          integer NOT NULL DEFAULT 39,
  gate_pass_pct         numeric(5,2) NOT NULL DEFAULT 0,
  w52_gates_passed      integer NOT NULL DEFAULT 0,
  blended_score         numeric(5,2) NOT NULL DEFAULT 0,
  go_live_authorized    boolean NOT NULL DEFAULT false,
  blockers              jsonb NOT NULL DEFAULT '[]',
  production_hash       text NOT NULL,
  cert_valid_until      timestamptz,
  report_json           jsonb NOT NULL DEFAULT '{}',
  generated_at          timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE final_production_certifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'final_production_certifications' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON final_production_certifications
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_final_prod_tenant   ON final_production_certifications (tenant_id);
CREATE INDEX IF NOT EXISTS idx_final_prod_status   ON final_production_certifications (final_status);
CREATE INDEX IF NOT EXISTS idx_final_prod_go_live  ON final_production_certifications (go_live_authorized);
CREATE INDEX IF NOT EXISTS idx_final_prod_score    ON final_production_certifications (blended_score DESC);
CREATE INDEX IF NOT EXISTS idx_final_prod_date     ON final_production_certifications (generated_at DESC);
