-- Wave 50 Phase 1: Live Production Activation Engine
-- provider_activation_reports

CREATE TABLE IF NOT EXISTS provider_activation_reports (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id             UUID        NOT NULL UNIQUE,
  tenant_id             UUID        NOT NULL,
  assessed_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  activation_score      SMALLINT    NOT NULL DEFAULT 0,
  providers_activated   SMALLINT    NOT NULL DEFAULT 0,
  providers_failed      SMALLINT    NOT NULL DEFAULT 0,
  providers_unconfigured SMALLINT   NOT NULL DEFAULT 0,
  sla_compliant         BOOLEAN     NOT NULL DEFAULT FALSE,
  activation_proof_hash TEXT        NOT NULL,
  issues                JSONB       NOT NULL DEFAULT '[]',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE provider_activation_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'provider_activation_reports'
      AND policyname = 'service_role_all_provider_activation_reports'
  ) THEN
    CREATE POLICY service_role_all_provider_activation_reports
      ON provider_activation_reports FOR ALL
      TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_provider_activation_tenant
  ON provider_activation_reports (tenant_id, assessed_at DESC);
