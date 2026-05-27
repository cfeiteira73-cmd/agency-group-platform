-- Agency Group — Provider Operations Mesh Store
-- Migration: 000116_provider_mesh.sql
-- Wave 49 Phase 1

CREATE TABLE IF NOT EXISTS provider_mesh_reports (
  report_id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID         NOT NULL,
  assessed_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  provider_truth_index    NUMERIC(5,2) NOT NULL DEFAULT 0,
  provider_truth_label    TEXT         NOT NULL DEFAULT 'UNCONFIGURED',
  providers_healthy       INTEGER      NOT NULL DEFAULT 0,
  providers_degraded      INTEGER      NOT NULL DEFAULT 0,
  providers_isolated      INTEGER      NOT NULL DEFAULT 0,
  providers_dead          INTEGER      NOT NULL DEFAULT 0,
  providers_unconfigured  INTEGER      NOT NULL DEFAULT 0,
  active_fallbacks        JSONB        NOT NULL DEFAULT '[]'::jsonb,
  issues                  TEXT[]       NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_provider_mesh_tenant ON provider_mesh_reports(tenant_id, assessed_at DESC);
ALTER TABLE provider_mesh_reports ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='provider_mesh_reports' AND policyname='service_role_full_access') THEN
    EXECUTE $pol$ CREATE POLICY service_role_full_access ON provider_mesh_reports FOR ALL TO service_role USING (true) WITH CHECK (true) $pol$;
  END IF;
END $$;

-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS provider_latency_samples (
  sample_id    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID         NOT NULL,
  provider_key TEXT         NOT NULL,
  latency_ms   NUMERIC      NOT NULL DEFAULT 0,
  sampled_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_provider_latency_tenant_key ON provider_latency_samples(tenant_id, provider_key, sampled_at DESC);
ALTER TABLE provider_latency_samples ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='provider_latency_samples' AND policyname='service_role_full_access') THEN
    EXECUTE $pol$ CREATE POLICY service_role_full_access ON provider_latency_samples FOR ALL TO service_role USING (true) WITH CHECK (true) $pol$;
  END IF;
END $$;

-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS provider_integrity_checks (
  check_id     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID         NOT NULL,
  provider_key TEXT         NOT NULL,
  passed       BOOLEAN      NOT NULL DEFAULT true,
  checked_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  detail       TEXT
);
CREATE INDEX IF NOT EXISTS idx_provider_integrity_tenant ON provider_integrity_checks(tenant_id, provider_key, checked_at DESC);
ALTER TABLE provider_integrity_checks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='provider_integrity_checks' AND policyname='service_role_full_access') THEN
    EXECUTE $pol$ CREATE POLICY service_role_full_access ON provider_integrity_checks FOR ALL TO service_role USING (true) WITH CHECK (true) $pol$;
  END IF;
END $$;
