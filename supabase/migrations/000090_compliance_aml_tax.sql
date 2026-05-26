-- =============================================================================
-- Agency Group — Compliance, AML/KYC, Tax Engine, Immutable Audit Trail
-- Migration: 000090_compliance_aml_tax.sql
-- Wave 44 Agent 5
-- =============================================================================

-- ─── GDPR Requests ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gdpr_requests (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id     TEXT        NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  tenant_id      UUID        NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  subject_id     TEXT        NOT NULL,
  subject_email  TEXT        NOT NULL,
  request_type   TEXT        NOT NULL CHECK (request_type IN ('ERASURE','PORTABILITY','RECTIFICATION','ACCESS','RESTRICTION','OBJECTION')),
  status         TEXT        NOT NULL CHECK (status IN ('RECEIVED','IN_PROGRESS','COMPLETED','REJECTED','PARTIALLY_COMPLETED')) DEFAULT 'RECEIVED',
  legal_basis    TEXT        NOT NULL DEFAULT '',
  tables_affected TEXT[]     NOT NULL DEFAULT '{}',
  completed_fields TEXT[]    NOT NULL DEFAULT '{}',
  rejection_reason TEXT,
  received_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deadline_at    TIMESTAMPTZ NOT NULL DEFAULT now() + interval '30 days',
  completed_at   TIMESTAMPTZ,
  evidence_hash  TEXT
);

-- ─── GDPR Erasure Log ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gdpr_erasure_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id   TEXT        NOT NULL,
  tenant_id    UUID        NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  table_name   TEXT        NOT NULL,
  rows_affected INTEGER     NOT NULL DEFAULT 0,
  action_taken TEXT        NOT NULL DEFAULT 'ANONYMIZED',
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── GDPR Purge Log ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gdpr_purge_log (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID        NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  category   TEXT        NOT NULL,
  rows_purged INTEGER     NOT NULL DEFAULT 0,
  purged_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── GDPR Portability Exports ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gdpr_portability_exports (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  export_id       TEXT        NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  tenant_id       UUID        NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  subject_id      TEXT        NOT NULL,
  data_categories TEXT[]      NOT NULL DEFAULT '{}',
  record_count    INTEGER     NOT NULL DEFAULT 0,
  export_hash     TEXT        NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT now() + interval '7 days'
);

-- ─── KYC Records ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kyc_records (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_id               TEXT        NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  tenant_id            UUID        NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  subject_id           TEXT        NOT NULL,
  subject_type         TEXT        NOT NULL CHECK (subject_type IN ('INVESTOR','BUYER','SELLER','BROKER')),
  provider             TEXT        NOT NULL CHECK (provider IN ('SUMSUB','ONFIDO','MANUAL')) DEFAULT 'MANUAL',
  provider_reference   TEXT,
  status               TEXT        NOT NULL CHECK (status IN ('NOT_STARTED','PENDING','APPROVED','REJECTED','MANUAL_REVIEW','EXPIRED')) DEFAULT 'PENDING',
  aml_risk             TEXT        NOT NULL CHECK (aml_risk IN ('LOW','MEDIUM','HIGH','UNACCEPTABLE')) DEFAULT 'MEDIUM',
  nationality          TEXT,
  country_of_residence TEXT,
  is_pep               BOOLEAN     NOT NULL DEFAULT false,
  is_sanctioned        BOOLEAN     NOT NULL DEFAULT false,
  mifid_tier           TEXT        NOT NULL CHECK (mifid_tier IN ('RETAIL','PROFESSIONAL','ELIGIBLE_COUNTERPARTY')) DEFAULT 'RETAIL',
  documents_verified   TEXT[]      NOT NULL DEFAULT '{}',
  initiated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at          TIMESTAMPTZ,
  expires_at           TIMESTAMPTZ,
  risk_factors         TEXT[]      NOT NULL DEFAULT '{}',
  check_notes          TEXT
);

-- ─── Tax Assessments ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tax_assessments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  transaction_id  TEXT        NOT NULL UNIQUE,
  country         TEXT        NOT NULL CHECK (country IN ('PT','ES')),
  sale_price_cents BIGINT     NOT NULL,
  total_tax_cents  BIGINT     NOT NULL DEFAULT 0,
  breakdown        JSONB      NOT NULL DEFAULT '{}',
  assessed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Audit Trail (Immutable SHA-256 Chain) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_trail (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id            TEXT        NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  tenant_id           UUID        NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  sequence            BIGINT      NOT NULL,
  action              TEXT        NOT NULL,
  actor_id            TEXT        NOT NULL DEFAULT 'system',
  actor_type          TEXT        NOT NULL CHECK (actor_type IN ('USER','SYSTEM','API_KEY','CRON')) DEFAULT 'SYSTEM',
  resource_type       TEXT        NOT NULL DEFAULT '',
  resource_id         TEXT        NOT NULL DEFAULT '',
  metadata            JSONB       NOT NULL DEFAULT '{}',
  ip_address          TEXT        NOT NULL DEFAULT '',
  occurred_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  entry_hash          TEXT        NOT NULL DEFAULT '',
  chain_hash          TEXT        NOT NULL DEFAULT '',
  previous_chain_hash TEXT,
  UNIQUE (tenant_id, sequence)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_gdpr_requests_subject
  ON gdpr_requests(subject_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_gdpr_requests_status
  ON gdpr_requests(tenant_id, status, deadline_at ASC);

CREATE INDEX IF NOT EXISTS idx_kyc_records_subject
  ON kyc_records(subject_id, initiated_at DESC);

CREATE INDEX IF NOT EXISTS idx_kyc_records_status
  ON kyc_records(tenant_id, status, expires_at ASC);

CREATE INDEX IF NOT EXISTS idx_kyc_records_provider_ref
  ON kyc_records(provider_reference)
  WHERE provider_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_trail_sequence
  ON audit_trail(tenant_id, sequence DESC);

CREATE INDEX IF NOT EXISTS idx_audit_trail_action
  ON audit_trail(tenant_id, action, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_trail_actor
  ON audit_trail(actor_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_trail_resource
  ON audit_trail(resource_type, resource_id, occurred_at DESC);

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE gdpr_requests          ENABLE ROW LEVEL SECURITY;
ALTER TABLE gdpr_erasure_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE gdpr_purge_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE gdpr_portability_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_records            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_assessments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_trail            ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'gdpr_requests' AND policyname = 'service_role_gdpr_requests'
  ) THEN
    CREATE POLICY "service_role_gdpr_requests"
      ON gdpr_requests FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'gdpr_erasure_log' AND policyname = 'service_role_gdpr_erasure'
  ) THEN
    CREATE POLICY "service_role_gdpr_erasure"
      ON gdpr_erasure_log FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'gdpr_purge_log' AND policyname = 'service_role_gdpr_purge'
  ) THEN
    CREATE POLICY "service_role_gdpr_purge"
      ON gdpr_purge_log FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'gdpr_portability_exports' AND policyname = 'service_role_gdpr_exports'
  ) THEN
    CREATE POLICY "service_role_gdpr_exports"
      ON gdpr_portability_exports FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'kyc_records' AND policyname = 'service_role_kyc'
  ) THEN
    CREATE POLICY "service_role_kyc"
      ON kyc_records FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tax_assessments' AND policyname = 'service_role_tax'
  ) THEN
    CREATE POLICY "service_role_tax"
      ON tax_assessments FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audit_trail' AND policyname = 'service_role_audit_trail'
  ) THEN
    CREATE POLICY "service_role_audit_trail"
      ON audit_trail FOR ALL USING (true);
  END IF;
END $$;
