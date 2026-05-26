-- =============================================================================
-- Agency Group — Legal Execution Migration
-- 000067_legal_execution.sql
--
-- Creates tables for the Legal Execution Pipeline:
--   1. legal_workflows          — master workflow tracking with SHA-256 chain
--   2. notary_appointments      — Portuguese notary appointment scheduling
--   3. notary_documents         — documents submitted for notarial signing
--   4. eidas_signature_requests — eIDAS QES/AES/SES signature requests
--   5. land_registry_submissions — Conservatória do Registo Predial submissions
--
-- All tables: RLS enabled, tenant_isolation policy, indexes.
-- =============================================================================

-- ─── 1. legal_workflows ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS legal_workflows (
  id                        uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id               text            UNIQUE NOT NULL,
  tenant_id                 text            NOT NULL,
  deal_id                   text            NOT NULL,
  pipeline_id               text,
  current_stage             text            NOT NULL DEFAULT 'DRAFT_CPCV',
  status                    text            NOT NULL DEFAULT 'ACTIVE',
  notary_ref                text,
  escritura_doc_id          text,
  land_registry_ref         text,
  eidas_signature_ids       jsonb           NOT NULL DEFAULT '[]',
  property_value_eur_cents  bigint          NOT NULL,
  imt_eur_cents             bigint          NOT NULL,
  stamp_duty_eur_cents      bigint          NOT NULL,
  notary_fee_eur_cents      bigint          NOT NULL,
  external_refs             jsonb           NOT NULL DEFAULT '{}',
  sha256_chain              text            NOT NULL,
  started_at                timestamptz     NOT NULL,
  completed_at              timestamptz,
  blocking_reason           text,
  created_at                timestamptz     NOT NULL DEFAULT now()
);

ALTER TABLE legal_workflows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON legal_workflows;
CREATE POLICY tenant_isolation ON legal_workflows
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_legal_workflows_tenant_id   ON legal_workflows (tenant_id);
CREATE INDEX IF NOT EXISTS idx_legal_workflows_deal_id     ON legal_workflows (deal_id);
CREATE INDEX IF NOT EXISTS idx_legal_workflows_pipeline_id ON legal_workflows (pipeline_id);
CREATE INDEX IF NOT EXISTS idx_legal_workflows_status      ON legal_workflows (status);
CREATE INDEX IF NOT EXISTS idx_legal_workflows_stage       ON legal_workflows (current_stage);
CREATE INDEX IF NOT EXISTS idx_legal_workflows_started_at  ON legal_workflows (started_at DESC);

-- ─── 2. notary_appointments ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notary_appointments (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id   text        UNIQUE NOT NULL,
  tenant_id        text        NOT NULL,
  workflow_id      text        NOT NULL,
  notary_code      text        NOT NULL,
  scheduled_date   timestamptz NOT NULL,
  location         text        NOT NULL,
  status           text        NOT NULL DEFAULT 'REQUESTED',
  confirmation_ref text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notary_appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON notary_appointments;
CREATE POLICY tenant_isolation ON notary_appointments
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_notary_appointments_tenant_id   ON notary_appointments (tenant_id);
CREATE INDEX IF NOT EXISTS idx_notary_appointments_workflow_id ON notary_appointments (workflow_id);
CREATE INDEX IF NOT EXISTS idx_notary_appointments_status      ON notary_appointments (status);
CREATE INDEX IF NOT EXISTS idx_notary_appointments_scheduled   ON notary_appointments (scheduled_date);

-- ─── 3. notary_documents ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notary_documents (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id      text        UNIQUE NOT NULL,
  tenant_id   text        NOT NULL,
  workflow_id text        NOT NULL,
  doc_type    text        NOT NULL,  -- CPCV | ESCRITURA | PROCURACAO | CERTIDAO
  doc_url     text,
  signed      boolean     NOT NULL DEFAULT false,
  notary_ref  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notary_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON notary_documents;
CREATE POLICY tenant_isolation ON notary_documents
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_notary_documents_tenant_id   ON notary_documents (tenant_id);
CREATE INDEX IF NOT EXISTS idx_notary_documents_workflow_id ON notary_documents (workflow_id);
CREATE INDEX IF NOT EXISTS idx_notary_documents_doc_type    ON notary_documents (doc_type);
CREATE INDEX IF NOT EXISTS idx_notary_documents_signed      ON notary_documents (signed);

-- ─── 4. eidas_signature_requests ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS eidas_signature_requests (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  signature_id     text        UNIQUE NOT NULL,
  tenant_id        text        NOT NULL,
  workflow_id      text        NOT NULL,
  document_id      text        NOT NULL,
  signer_id        text        NOT NULL,
  signer_email     text        NOT NULL,
  signature_level  text        NOT NULL,  -- SES | AES | QES
  status           text        NOT NULL DEFAULT 'PENDING',  -- PENDING | SIGNED | REJECTED | EXPIRED
  provider         text        NOT NULL,
  provider_ref     text,
  signed_at        timestamptz,
  expires_at       timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE eidas_signature_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON eidas_signature_requests;
CREATE POLICY tenant_isolation ON eidas_signature_requests
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_eidas_sig_tenant_id   ON eidas_signature_requests (tenant_id);
CREATE INDEX IF NOT EXISTS idx_eidas_sig_workflow_id ON eidas_signature_requests (workflow_id);
CREATE INDEX IF NOT EXISTS idx_eidas_sig_document_id ON eidas_signature_requests (document_id);
CREATE INDEX IF NOT EXISTS idx_eidas_sig_signer_id   ON eidas_signature_requests (signer_id);
CREATE INDEX IF NOT EXISTS idx_eidas_sig_status      ON eidas_signature_requests (status);
CREATE INDEX IF NOT EXISTS idx_eidas_sig_expires_at  ON eidas_signature_requests (expires_at);

-- ─── 5. land_registry_submissions ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS land_registry_submissions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id  text        UNIQUE NOT NULL,
  tenant_id      text        NOT NULL,
  workflow_id    text        NOT NULL,
  property_id    text        NOT NULL,
  submission_ref text,
  status         text        NOT NULL DEFAULT 'PENDING',
  submitted_at   timestamptz NOT NULL DEFAULT now(),
  confirmed_at   timestamptz
);

ALTER TABLE land_registry_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON land_registry_submissions;
CREATE POLICY tenant_isolation ON land_registry_submissions
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_land_registry_tenant_id    ON land_registry_submissions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_land_registry_workflow_id  ON land_registry_submissions (workflow_id);
CREATE INDEX IF NOT EXISTS idx_land_registry_property_id  ON land_registry_submissions (property_id);
CREATE INDEX IF NOT EXISTS idx_land_registry_status       ON land_registry_submissions (status);
CREATE INDEX IF NOT EXISTS idx_land_registry_submitted_at ON land_registry_submissions (submitted_at DESC);
