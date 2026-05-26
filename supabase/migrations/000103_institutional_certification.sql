-- Agency Group — Institutional Certification Store
-- Migration: 000103_institutional_certification.sql
-- Wave 46 final certification gate

CREATE TABLE IF NOT EXISTS institutional_certifications (
  certification_id   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID         NOT NULL,
  certified_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  system_status      TEXT         NOT NULL,
  overall_score      NUMERIC(6,2) NOT NULL DEFAULT 0,
  conditions         JSONB        NOT NULL DEFAULT '[]'::jsonb,
  blocking_failures  TEXT[]       NOT NULL DEFAULT '{}',
  warnings           TEXT[]       NOT NULL DEFAULT '{}',
  certification_hash TEXT,
  wave               INTEGER      NOT NULL DEFAULT 46
);

CREATE INDEX IF NOT EXISTS idx_institutional_cert_tenant
  ON institutional_certifications(tenant_id, certified_at DESC);

ALTER TABLE institutional_certifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'institutional_certifications'
      AND policyname = 'service_role_full_access'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY service_role_full_access ON institutional_certifications
        FOR ALL TO service_role USING (true) WITH CHECK (true)
    $pol$;
  END IF;
END $$;
