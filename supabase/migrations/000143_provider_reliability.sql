-- Wave 52 Phase 4 — Live Provider Reliability Certification
-- table: provider_reliability_reports

CREATE TABLE IF NOT EXISTS provider_reliability_reports (
  id                      bigserial PRIMARY KEY,
  report_id               uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id               uuid NOT NULL,
  reliability_grade       text NOT NULL DEFAULT 'CRITICAL_PROVIDER_FAILURE',
  overall_score           numeric(5,2) NOT NULL DEFAULT 0,
  total_providers         integer NOT NULL DEFAULT 0,
  certified_count         integer NOT NULL DEFAULT 0,
  degraded_count          integer NOT NULL DEFAULT 0,
  failed_count            integer NOT NULL DEFAULT 0,
  unconfigured_count      integer NOT NULL DEFAULT 0,
  avg_trust_score         numeric(5,2) NOT NULL DEFAULT 0,
  blockers                jsonb NOT NULL DEFAULT '[]',
  certification_hash      text NOT NULL,
  report_json             jsonb NOT NULL DEFAULT '{}',
  generated_at            timestamptz NOT NULL DEFAULT now(),
  created_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE provider_reliability_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'provider_reliability_reports' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON provider_reliability_reports
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_prov_rel_tenant  ON provider_reliability_reports (tenant_id);
CREATE INDEX IF NOT EXISTS idx_prov_rel_grade   ON provider_reliability_reports (reliability_grade);
CREATE INDEX IF NOT EXISTS idx_prov_rel_score   ON provider_reliability_reports (overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_prov_rel_date    ON provider_reliability_reports (generated_at DESC);
