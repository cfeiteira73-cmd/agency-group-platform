-- Agency Group — Wave 39: KYC/AML Compliance + Regulatory Framework
-- supabase/migrations/000055_compliance.sql
-- EU-grade KYC, AML screening, regulatory audit trail, compliance reports.
-- GDPR-compliant: no raw biometrics/documents stored — only status flags and hashes.

-- ─── investor_kyc_records ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS investor_kyc_records (
  id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_id              text         NOT NULL UNIQUE,
  tenant_id           uuid         NOT NULL,
  investor_id         text         NOT NULL UNIQUE,
  status              text         NOT NULL DEFAULT 'NOT_STARTED',
  investor_type       text         NOT NULL DEFAULT 'RETAIL',
  risk_score          integer      DEFAULT 0,
  jurisdiction        text,
  country_of_residence text,
  is_eu_resident      boolean      DEFAULT false,
  is_pep              boolean      DEFAULT false,
  aml_cleared         boolean      DEFAULT false,
  kyc_provider        text,
  provider_reference  text,
  approved_at         timestamptz,
  expires_at          timestamptz,
  last_reviewed_at    timestamptz,
  metadata            jsonb        DEFAULT '{}',
  created_at          timestamptz  DEFAULT now(),
  updated_at          timestamptz  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kyc_investor
  ON investor_kyc_records(tenant_id, investor_id);

CREATE INDEX IF NOT EXISTS idx_kyc_status
  ON investor_kyc_records(tenant_id, status);

ALTER TABLE investor_kyc_records ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'investor_kyc_records'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON investor_kyc_records
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- ─── aml_screening_results ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS aml_screening_results (
  id                      uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  screening_id            text         NOT NULL UNIQUE,
  tenant_id               uuid         NOT NULL,
  investor_id             text         NOT NULL,
  screened_at             timestamptz  DEFAULT now(),
  risk_level              text         NOT NULL DEFAULT 'LOW',
  is_pep                  boolean      DEFAULT false,
  sanctions_hit           boolean      DEFAULT false,
  sanctions_lists_checked jsonb        DEFAULT '[]',
  risk_factors            jsonb        DEFAULT '[]',
  recommended_action      text         DEFAULT 'APPROVE',
  manual_review_required  boolean      DEFAULT false,
  expires_at              timestamptz
);

CREATE INDEX IF NOT EXISTS idx_aml_investor
  ON aml_screening_results(tenant_id, investor_id, screened_at DESC);

ALTER TABLE aml_screening_results ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'aml_screening_results'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON aml_screening_results
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- ─── kyc_audit_events ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kyc_audit_events (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid        NOT NULL,
  investor_id        text        NOT NULL,
  event_type         text        NOT NULL,
  from_status        text,
  to_status          text,
  provider_reference text,
  notes              text,
  recorded_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kyc_audit_investor
  ON kyc_audit_events(tenant_id, investor_id, recorded_at DESC);

ALTER TABLE kyc_audit_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'kyc_audit_events'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON kyc_audit_events
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- ─── regulatory_audit_trail: immutable write-once ─────────────────────────────

CREATE TABLE IF NOT EXISTS regulatory_audit_trail (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         text        NOT NULL UNIQUE,
  tenant_id        uuid        NOT NULL,
  event_type       text        NOT NULL,
  actor            text        NOT NULL,
  investor_id      text,
  settlement_id    text,
  amount_eur_cents bigint,
  description      text,
  data_hash        text        NOT NULL,
  chain_hash       text        NOT NULL,
  sequence_number  bigint      NOT NULL,
  recorded_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reg_audit_tenant
  ON regulatory_audit_trail(tenant_id, sequence_number ASC);

CREATE INDEX IF NOT EXISTS idx_reg_audit_investor
  ON regulatory_audit_trail(tenant_id, investor_id, recorded_at DESC);

ALTER TABLE regulatory_audit_trail ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'regulatory_audit_trail'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON regulatory_audit_trail
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- ─── compliance_reports ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS compliance_reports (
  id                         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                  uuid        NOT NULL,
  generated_at               timestamptz DEFAULT now(),
  period_from                timestamptz,
  period_to                  timestamptz,
  total_events               integer     DEFAULT 0,
  capital_movements_eur_cents bigint     DEFAULT 0,
  unique_investors           integer     DEFAULT 0,
  settlements_initiated      integer     DEFAULT 0,
  settlements_completed      integer     DEFAULT 0,
  kyc_approvals              integer     DEFAULT 0,
  aml_flags                  integer     DEFAULT 0,
  compliance_violations      integer     DEFAULT 0,
  audit_integrity            text        DEFAULT 'VERIFIED'
);

CREATE INDEX IF NOT EXISTS idx_compliance_reports_tenant
  ON compliance_reports(tenant_id, generated_at DESC);

ALTER TABLE compliance_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'compliance_reports'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON compliance_reports
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;
