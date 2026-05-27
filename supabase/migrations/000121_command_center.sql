-- Agency Group — Command Center Snapshots
-- Migration: 000121_command_center.sql
-- Wave 49 Phase 6

CREATE TABLE IF NOT EXISTS command_center_snapshots (
  snapshot_id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                  UUID         NOT NULL,
  captured_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  global_operational_score   NUMERIC(5,2) NOT NULL DEFAULT 0,
  operational_readiness      TEXT         NOT NULL DEFAULT 'PRE_OPERATIONAL',
  provider_truth_index       NUMERIC(5,2) NOT NULL DEFAULT 0,
  financial_truth_score      NUMERIC(5,2) NOT NULL DEFAULT 0,
  soc_grid_score             NUMERIC(5,2) NOT NULL DEFAULT 0,
  regulatory_score           NUMERIC(5,2) NOT NULL DEFAULT 0,
  resilience_score           NUMERIC(5,2) NOT NULL DEFAULT 0,
  investor_confidence_score  NUMERIC(5,2) NOT NULL DEFAULT 0,
  snapshot_hash              TEXT         NOT NULL DEFAULT '',
  issues                     TEXT[]       NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_command_center_tenant ON command_center_snapshots(tenant_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_command_center_score ON command_center_snapshots(tenant_id, global_operational_score DESC, captured_at DESC);
ALTER TABLE command_center_snapshots ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='command_center_snapshots' AND policyname='service_role_full_access') THEN
    EXECUTE $pol$ CREATE POLICY service_role_full_access ON command_center_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true) $pol$;
  END IF;
END $$;
