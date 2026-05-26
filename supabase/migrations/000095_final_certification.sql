-- Agency Group — Final Production Certification
-- 000095_final_certification.sql
-- Wave 45 Agent 6 — Apex certification gate persistence
-- Idempotent: all statements use IF NOT EXISTS / ON CONFLICT DO NOTHING

CREATE TABLE IF NOT EXISTS final_production_certifications (
  certification_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,
  system_status     TEXT NOT NULL,
  overall_score     NUMERIC(5,2) NOT NULL,
  conditions        JSONB NOT NULL DEFAULT '[]',
  blocking_failures TEXT[] NOT NULL DEFAULT '{}',
  warnings          TEXT[] NOT NULL DEFAULT '{}',
  certification_hash TEXT,
  certified_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_final_certifications_tenant_certified
  ON final_production_certifications(tenant_id, certified_at DESC);

ALTER TABLE final_production_certifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'final_production_certifications'
    AND policyname = 'service_role_full_access_final_certifications'
  ) THEN
    CREATE POLICY service_role_full_access_final_certifications
      ON final_production_certifications
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
