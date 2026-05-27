-- Agency Group — Regulatory Reality System Store
-- Migration: 000119_regulatory_reality.sql
-- Wave 49 Phase 4

CREATE TABLE IF NOT EXISTS regulatory_reality_reports (
  report_id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID         NOT NULL,
  assessed_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  regulatory_readiness   TEXT         NOT NULL DEFAULT 'NOT_READY',
  regulatory_score       NUMERIC(5,2) NOT NULL DEFAULT 0,
  soc2_score             NUMERIC(5,2) NOT NULL DEFAULT 0,
  iso27001_score         NUMERIC(5,2) NOT NULL DEFAULT 0,
  pentest_blocker        BOOLEAN      NOT NULL DEFAULT false,
  chain_of_custody_hash  TEXT         NOT NULL DEFAULT '',
  issues                 TEXT[]       NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_regulatory_reality_tenant ON regulatory_reality_reports(tenant_id, assessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_regulatory_reality_readiness ON regulatory_reality_reports(tenant_id, regulatory_readiness, assessed_at DESC);
ALTER TABLE regulatory_reality_reports ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='regulatory_reality_reports' AND policyname='service_role_full_access') THEN
    EXECUTE $pol$ CREATE POLICY service_role_full_access ON regulatory_reality_reports FOR ALL TO service_role USING (true) WITH CHECK (true) $pol$;
  END IF;
END $$;
