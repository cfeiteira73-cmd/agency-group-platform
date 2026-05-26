-- =============================================================================
-- Agency Group — Wave 41 Regulatory Compliance Migration
-- supabase/migrations/000070_regulatory.sql
--
-- Tables: compliance_reports, compliance_check_results,
--         compliance_evidence_records, mifid_classifications,
--         mifid_transaction_reports, best_execution_reports,
--         audit_engagements, audit_findings, compliance_evidence_packages
-- =============================================================================

-- ─── compliance_reports ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS compliance_reports (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id              TEXT NOT NULL UNIQUE,
  tenant_id              TEXT NOT NULL,
  frameworks_assessed    JSONB NOT NULL DEFAULT '[]',
  total_controls         INT NOT NULL DEFAULT 0,
  compliant_controls     INT NOT NULL DEFAULT 0,
  non_compliant_controls INT NOT NULL DEFAULT 0,
  partial_controls       INT NOT NULL DEFAULT 0,
  overall_score_pct      NUMERIC(5,2) NOT NULL DEFAULT 0,
  critical_gaps          JSONB NOT NULL DEFAULT '[]',
  ready_for_institutional BOOLEAN NOT NULL DEFAULT false,
  generated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until            TIMESTAMPTZ
);

ALTER TABLE compliance_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY compliance_reports_tenant_isolation
  ON compliance_reports
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_compliance_reports_tenant_generated
  ON compliance_reports (tenant_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_compliance_reports_report_id
  ON compliance_reports (report_id);

-- ─── compliance_check_results ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS compliance_check_results (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id             TEXT NOT NULL UNIQUE,
  tenant_id            TEXT NOT NULL,
  framework            TEXT NOT NULL,
  control_id           TEXT NOT NULL,
  control_name         TEXT NOT NULL,
  status               TEXT NOT NULL,
  evidence_refs        JSONB NOT NULL DEFAULT '[]',
  gap_description      TEXT,
  remediation_required BOOLEAN NOT NULL DEFAULT false,
  remediation_deadline TIMESTAMPTZ,
  assessed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  assessed_by          TEXT NOT NULL DEFAULT 'SYSTEM'
);

ALTER TABLE compliance_check_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY compliance_check_results_tenant_isolation
  ON compliance_check_results
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_compliance_check_results_tenant
  ON compliance_check_results (tenant_id, framework, control_id);

CREATE INDEX IF NOT EXISTS idx_compliance_check_results_status
  ON compliance_check_results (tenant_id, status);

-- ─── compliance_evidence_records ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS compliance_evidence_records (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      TEXT NOT NULL,
  control_id     TEXT NOT NULL,
  evidence_type  TEXT NOT NULL,
  evidence_ref   TEXT NOT NULL,
  description    TEXT NOT NULL,
  recorded_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE compliance_evidence_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY compliance_evidence_records_tenant_isolation
  ON compliance_evidence_records
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_compliance_evidence_records_tenant_type
  ON compliance_evidence_records (tenant_id, evidence_type);

CREATE INDEX IF NOT EXISTS idx_compliance_evidence_records_control
  ON compliance_evidence_records (tenant_id, control_id);

-- ─── mifid_classifications ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mifid_classifications (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classification_id          TEXT NOT NULL UNIQUE,
  tenant_id                  TEXT NOT NULL,
  investor_id                TEXT NOT NULL,
  tier                       TEXT NOT NULL,
  classification_basis       JSONB NOT NULL DEFAULT '[]',
  portfolio_value_eur_cents  BIGINT NOT NULL DEFAULT 0,
  professional_experience_years INT,
  opt_up_requested           BOOLEAN NOT NULL DEFAULT false,
  opt_down_requested         BOOLEAN NOT NULL DEFAULT false,
  valid_from                 TIMESTAMPTZ NOT NULL,
  valid_until                TIMESTAMPTZ NOT NULL,
  classified_by              TEXT NOT NULL DEFAULT 'SYSTEM',
  classified_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE mifid_classifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY mifid_classifications_tenant_isolation
  ON mifid_classifications
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_mifid_classifications_investor
  ON mifid_classifications (tenant_id, investor_id, classified_at DESC);

CREATE INDEX IF NOT EXISTS idx_mifid_classifications_tier
  ON mifid_classifications (tenant_id, tier);

-- ─── mifid_transaction_reports ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mifid_transaction_reports (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           TEXT NOT NULL,
  deal_id             TEXT NOT NULL,
  investor_id         TEXT NOT NULL,
  amount_eur_cents    BIGINT NOT NULL DEFAULT 0,
  instrument_type     TEXT NOT NULL,
  reported_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE mifid_transaction_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY mifid_transaction_reports_tenant_isolation
  ON mifid_transaction_reports
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_mifid_transaction_reports_tenant
  ON mifid_transaction_reports (tenant_id, reported_at DESC);

CREATE INDEX IF NOT EXISTS idx_mifid_transaction_reports_deal
  ON mifid_transaction_reports (tenant_id, deal_id);

-- ─── best_execution_reports ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS best_execution_reports (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                     TEXT NOT NULL,
  period_start                  TIMESTAMPTZ NOT NULL,
  period_end                    TIMESTAMPTZ NOT NULL,
  deals_assessed                INT NOT NULL DEFAULT 0,
  best_execution_achieved_pct   NUMERIC(5,2) NOT NULL DEFAULT 0,
  generated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE best_execution_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY best_execution_reports_tenant_isolation
  ON best_execution_reports
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_best_execution_reports_tenant
  ON best_execution_reports (tenant_id, generated_at DESC);

-- ─── audit_engagements ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_engagements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id     TEXT NOT NULL UNIQUE,
  tenant_id         TEXT NOT NULL,
  auditor_firm      TEXT NOT NULL,
  audit_type        TEXT NOT NULL,
  scope             JSONB NOT NULL DEFAULT '[]',
  status            TEXT NOT NULL DEFAULT 'PLANNED',
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  findings_count    INT NOT NULL DEFAULT 0,
  critical_findings INT NOT NULL DEFAULT 0,
  report_url        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE audit_engagements ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_engagements_tenant_isolation
  ON audit_engagements
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_audit_engagements_tenant_status
  ON audit_engagements (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_audit_engagements_engagement_id
  ON audit_engagements (engagement_id);

-- ─── audit_findings ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_findings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id            TEXT NOT NULL UNIQUE,
  engagement_id         TEXT NOT NULL,
  tenant_id             TEXT NOT NULL,
  severity              TEXT NOT NULL,
  category              TEXT NOT NULL,
  title                 TEXT NOT NULL,
  description           TEXT NOT NULL,
  affected_component    TEXT NOT NULL,
  remediation_status    TEXT NOT NULL DEFAULT 'OPEN',
  remediation_deadline  TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE audit_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_findings_tenant_isolation
  ON audit_findings
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_audit_findings_engagement
  ON audit_findings (engagement_id, severity);

CREATE INDEX IF NOT EXISTS idx_audit_findings_tenant_status
  ON audit_findings (tenant_id, remediation_status);

CREATE INDEX IF NOT EXISTS idx_audit_findings_finding_id
  ON audit_findings (finding_id);

-- ─── compliance_evidence_packages ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS compliance_evidence_packages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id       TEXT NOT NULL UNIQUE,
  tenant_id        TEXT NOT NULL,
  package_type     TEXT NOT NULL,
  period_start     TIMESTAMPTZ NOT NULL,
  period_end       TIMESTAMPTZ NOT NULL,
  evidence_items   JSONB NOT NULL DEFAULT '[]',
  completeness_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  generated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until      TIMESTAMPTZ,
  sha256_hash      TEXT NOT NULL
);

ALTER TABLE compliance_evidence_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY compliance_evidence_packages_tenant_isolation
  ON compliance_evidence_packages
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_compliance_evidence_packages_tenant_type
  ON compliance_evidence_packages (tenant_id, package_type, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_compliance_evidence_packages_package_id
  ON compliance_evidence_packages (package_id);
