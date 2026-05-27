-- Wave 51 Phase 8 — Compliance Evidence Hardening
-- tables: compliance_evidence_reports, kyc_verifications, aml_alerts

CREATE TABLE IF NOT EXISTS compliance_evidence_reports (
  id                    bigserial PRIMARY KEY,
  report_id             uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL,
  evidence_status       text NOT NULL DEFAULT 'NO_EVIDENCE',
  compliance_score      numeric(5,2) NOT NULL DEFAULT 0,
  total_evidence_items  integer NOT NULL DEFAULT 0,
  big4_ready            boolean NOT NULL DEFAULT false,
  evidence_chain_hash   text,
  blocker_count         integer NOT NULL DEFAULT 0,
  compliance_hash       text NOT NULL,
  report_json           jsonb NOT NULL DEFAULT '{}',
  generated_at          timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kyc_verifications (
  id                bigserial PRIMARY KEY,
  tenant_id         uuid NOT NULL,
  contact_id        uuid,
  kyc_status        text NOT NULL DEFAULT 'PENDING',
  pep_checked       boolean NOT NULL DEFAULT false,
  sanctions_checked boolean NOT NULL DEFAULT false,
  verified_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS aml_alerts (
  id           uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    uuid NOT NULL,
  alert_type   text NOT NULL,
  severity     text NOT NULL DEFAULT 'MEDIUM',
  description  text,
  resolved     boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE compliance_evidence_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_verifications           ENABLE ROW LEVEL SECURITY;
ALTER TABLE aml_alerts                  ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'compliance_evidence_reports' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON compliance_evidence_reports
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'kyc_verifications' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON kyc_verifications
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'aml_alerts' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON aml_alerts
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_compliance_evidence_tenant ON compliance_evidence_reports (tenant_id);
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_tenant   ON kyc_verifications (tenant_id);
CREATE INDEX IF NOT EXISTS idx_aml_alerts_tenant          ON aml_alerts (tenant_id);
CREATE INDEX IF NOT EXISTS idx_aml_alerts_date            ON aml_alerts (created_at DESC);
