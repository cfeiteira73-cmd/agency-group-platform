-- Wave 51 Phase 4 — Provider Reality Hardening
-- tables: provider_reality_reports, provider_fallback_log

CREATE TABLE IF NOT EXISTS provider_reality_reports (
  id                    bigserial PRIMARY KEY,
  report_id             uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL,
  reality_status        text NOT NULL DEFAULT 'PROVIDER_REALITY_UNCONFIGURED',
  provider_truth_index  numeric(5,2) NOT NULL DEFAULT 0,
  providers_live        integer NOT NULL DEFAULT 0,
  circuit_breakers_open integer NOT NULL DEFAULT 0,
  fallbacks_proven      integer NOT NULL DEFAULT 0,
  report_hash           text NOT NULL,
  report_json           jsonb NOT NULL DEFAULT '{}',
  generated_at          timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS provider_fallback_log (
  id                bigserial PRIMARY KEY,
  tenant_id         uuid NOT NULL,
  primary_provider  text NOT NULL,
  fallback_provider text NOT NULL,
  trigger_reason    text,
  success           boolean NOT NULL DEFAULT false,
  latency_ms        integer,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE provider_reality_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_fallback_log    ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'provider_reality_reports' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON provider_reality_reports
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'provider_fallback_log' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON provider_fallback_log
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_provider_reality_tenant   ON provider_reality_reports (tenant_id);
CREATE INDEX IF NOT EXISTS idx_provider_fallback_primary ON provider_fallback_log (primary_provider);
CREATE INDEX IF NOT EXISTS idx_provider_fallback_date    ON provider_fallback_log (created_at DESC);
