-- Agency Group — Live Institutional Truth Gate Store
-- Migration: 000115_go_live_gate.sql
-- Wave 48 GAP 6 — 15-condition gate, truth certifications, go-live reports

CREATE TABLE IF NOT EXISTS truth_certifications (
  cert_id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID         NOT NULL,
  issued_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  valid_until           TIMESTAMPTZ  NOT NULL,
  certification_hash    TEXT         NOT NULL,
  overall_score         NUMERIC(5,2) NOT NULL DEFAULT 0,
  gates_passed          INTEGER      NOT NULL DEFAULT 0,
  gates_total           INTEGER      NOT NULL DEFAULT 15,
  go_live_authorized    BOOLEAN      NOT NULL DEFAULT false,
  institutional_capital_authorized BOOLEAN NOT NULL DEFAULT false,
  issued_by             TEXT         NOT NULL DEFAULT 'INSTITUTIONAL_TRUTH_ENGINE_v2',
  revoked               BOOLEAN      NOT NULL DEFAULT false,
  revoked_at            TIMESTAMPTZ,
  revocation_reason     TEXT
);

-- certification_hash is immutable proof — should never be updated
CREATE UNIQUE INDEX IF NOT EXISTS idx_truth_certifications_hash
  ON truth_certifications(certification_hash);

CREATE INDEX IF NOT EXISTS idx_truth_certifications_tenant
  ON truth_certifications(tenant_id, issued_at DESC);

CREATE INDEX IF NOT EXISTS idx_truth_certifications_valid
  ON truth_certifications(tenant_id, valid_until DESC) WHERE revoked = false;

ALTER TABLE truth_certifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'truth_certifications'
      AND policyname = 'service_role_full_access'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY service_role_full_access ON truth_certifications
        FOR ALL TO service_role USING (true) WITH CHECK (true)
    $pol$;
  END IF;
END $$;

-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS institutional_go_live_reports (
  report_id                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                       UUID         NOT NULL,
  assessed_at                     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  system_live_status              TEXT         NOT NULL DEFAULT 'INSTITUTIONAL_BLOCKED',
  overall_score                   NUMERIC(5,2) NOT NULL DEFAULT 0,
  gates_passed                    INTEGER      NOT NULL DEFAULT 0,
  gates_total                     INTEGER      NOT NULL DEFAULT 15,
  gates_failed_blocking           INTEGER      NOT NULL DEFAULT 0,
  go_live_authorized              BOOLEAN      NOT NULL DEFAULT false,
  institutional_capital_authorized BOOLEAN     NOT NULL DEFAULT false,
  wave47_complete                 BOOLEAN      NOT NULL DEFAULT false,
  wave48_complete                 BOOLEAN      NOT NULL DEFAULT false,
  truth_certification_hash        TEXT         NOT NULL DEFAULT '',
  gate_results                    JSONB        NOT NULL DEFAULT '[]'::jsonb,
  blockers                        TEXT[]       NOT NULL DEFAULT '{}',
  warnings                        TEXT[]       NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_go_live_reports_tenant
  ON institutional_go_live_reports(tenant_id, assessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_go_live_reports_authorized
  ON institutional_go_live_reports(tenant_id, go_live_authorized, assessed_at DESC);

ALTER TABLE institutional_go_live_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'institutional_go_live_reports'
      AND policyname = 'service_role_full_access'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY service_role_full_access ON institutional_go_live_reports
        FOR ALL TO service_role USING (true) WITH CHECK (true)
    $pol$;
  END IF;
END $$;
