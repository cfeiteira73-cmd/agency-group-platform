-- Agency Group — Legal Execution Infrastructure
-- Migration: 000098_legal_execution.sql

-- Notary appointments (Portugal + Spain)
CREATE TABLE IF NOT EXISTS notary_appointments (
  appointment_id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID         NOT NULL,
  deal_id                  UUID         NOT NULL,
  idempotency_key          TEXT         NOT NULL UNIQUE,
  country                  TEXT         NOT NULL,  -- 'PT' | 'ES'
  transaction_type         TEXT         NOT NULL,
  provider                 TEXT         NOT NULL,
  status                   TEXT         NOT NULL DEFAULT 'REQUESTED',
  notary_name              TEXT,
  notary_address           TEXT,
  appointment_date         DATE,
  appointment_time         TEXT,
  estimated_fees_eur       NUMERIC(10,2),
  provider_appointment_id  TEXT,
  deed_number              TEXT,
  deed_signed_at           TIMESTAMPTZ,
  created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Land registry submissions (Portugal)
CREATE TABLE IF NOT EXISTS land_registry_submissions (
  submission_id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                        UUID         NOT NULL,
  deal_id                          UUID         NOT NULL,
  idempotency_key                  TEXT         NOT NULL UNIQUE,
  country                          TEXT         NOT NULL,  -- 'PT' | 'ES'
  submission_type                  TEXT         NOT NULL,
  provider                         TEXT         NOT NULL,
  status                           TEXT         NOT NULL DEFAULT 'SUBMITTED',
  provisional_registration_number  TEXT,
  final_registration_number        TEXT,
  final_registration_date          DATE,
  registration_fee_eur             NUMERIC(10,2),
  rejection_reason                 TEXT,
  certificate_url                  TEXT,
  created_at                       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Digital signature envelopes
CREATE TABLE IF NOT EXISTS digital_signatures (
  signature_id      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID         NOT NULL,
  deal_id           UUID         NOT NULL,
  idempotency_key   TEXT         NOT NULL UNIQUE,
  document_type     TEXT         NOT NULL,
  document_name     TEXT         NOT NULL,
  provider          TEXT         NOT NULL DEFAULT 'DOCUSIGN',
  envelope_id       TEXT         NOT NULL,
  status            TEXT         NOT NULL DEFAULT 'SENT',
  signature_level   TEXT         NOT NULL DEFAULT 'QES',
  signers_count     INTEGER      NOT NULL DEFAULT 1,
  completed_at      TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ,
  signed_document_url TEXT,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Legal execution event log
CREATE TABLE IF NOT EXISTS legal_execution_log (
  log_id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID         NOT NULL,
  deal_id           UUID,
  action_type       TEXT         NOT NULL,
  system            TEXT         NOT NULL,
  status            TEXT         NOT NULL,
  reference         TEXT,
  detail            TEXT,
  logged_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notary_appointments_deal ON notary_appointments(deal_id, country);
CREATE INDEX IF NOT EXISTS idx_land_registry_deal ON land_registry_submissions(deal_id, country);
CREATE INDEX IF NOT EXISTS idx_digital_signatures_deal ON digital_signatures(deal_id);
CREATE INDEX IF NOT EXISTS idx_legal_log_tenant ON legal_execution_log(tenant_id, logged_at DESC);

-- RLS
ALTER TABLE notary_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE land_registry_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_execution_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notary_appointments' AND policyname = 'service_role_notary') THEN
    CREATE POLICY service_role_notary ON notary_appointments FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'land_registry_submissions' AND policyname = 'service_role_land_registry') THEN
    CREATE POLICY service_role_land_registry ON land_registry_submissions FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'digital_signatures' AND policyname = 'service_role_signatures') THEN
    CREATE POLICY service_role_signatures ON digital_signatures FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'legal_execution_log' AND policyname = 'service_role_legal_log') THEN
    CREATE POLICY service_role_legal_log ON legal_execution_log FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
