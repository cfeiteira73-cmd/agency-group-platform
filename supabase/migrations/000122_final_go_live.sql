-- Agency Group — Final Go-Live Gate Certifications
-- Migration: 000122_final_go_live.sql
-- Wave 49 Phase 7

CREATE TABLE IF NOT EXISTS final_go_live_certifications (
  report_id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                    UUID         NOT NULL,
  generated_at                 TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  final_system_status          TEXT         NOT NULL DEFAULT 'INSTITUTIONAL_BLOCKED',
  go_live_authorized           BOOLEAN      NOT NULL DEFAULT false,
  institutional_capital_authorized BOOLEAN  NOT NULL DEFAULT false,
  gates_passed                 INTEGER      NOT NULL DEFAULT 0,
  gates_total                  INTEGER      NOT NULL DEFAULT 20,
  combined_score               NUMERIC(5,2) NOT NULL DEFAULT 0,
  go_live_truth_hash           TEXT         NOT NULL DEFAULT '',
  sha256_certification_hash    TEXT         NOT NULL DEFAULT '',
  blockers                     TEXT[]       NOT NULL DEFAULT '{}'
);

-- GO_LIVE_TRUTH_HASH is immutable proof — unique constraint enforced
CREATE UNIQUE INDEX IF NOT EXISTS idx_final_gate_truth_hash
  ON final_go_live_certifications(go_live_truth_hash);

CREATE INDEX IF NOT EXISTS idx_final_gate_tenant
  ON final_go_live_certifications(tenant_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_final_gate_authorized
  ON final_go_live_certifications(tenant_id, go_live_authorized, generated_at DESC);

ALTER TABLE final_go_live_certifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='final_go_live_certifications' AND policyname='service_role_full_access') THEN
    EXECUTE $pol$ CREATE POLICY service_role_full_access ON final_go_live_certifications FOR ALL TO service_role USING (true) WITH CHECK (true) $pol$;
  END IF;
END $$;
