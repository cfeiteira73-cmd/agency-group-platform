-- Agency Group — Production Chaos Grid Store
-- Migration: 000120_production_chaos.sql
-- Wave 49 Phase 5

CREATE TABLE IF NOT EXISTS production_chaos_reports (
  report_id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID         NOT NULL,
  assessed_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  chaos_grid_status       TEXT         NOT NULL DEFAULT 'NOT_TESTED',
  chaos_enabled           BOOLEAN      NOT NULL DEFAULT false,
  scenarios_passed        INTEGER      NOT NULL DEFAULT 0,
  scenarios_failed        INTEGER      NOT NULL DEFAULT 0,
  rto_hard_limit_met      BOOLEAN      NOT NULL DEFAULT false,
  rpo_verified            BOOLEAN      NOT NULL DEFAULT false,
  resilience_score        NUMERIC(5,2) NOT NULL DEFAULT 0,
  chaos_certification_hash TEXT        NOT NULL DEFAULT '',
  issues                  TEXT[]       NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_production_chaos_tenant ON production_chaos_reports(tenant_id, assessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_production_chaos_status ON production_chaos_reports(tenant_id, chaos_grid_status, assessed_at DESC);
ALTER TABLE production_chaos_reports ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='production_chaos_reports' AND policyname='service_role_full_access') THEN
    EXECUTE $pol$ CREATE POLICY service_role_full_access ON production_chaos_reports FOR ALL TO service_role USING (true) WITH CHECK (true) $pol$;
  END IF;
END $$;
