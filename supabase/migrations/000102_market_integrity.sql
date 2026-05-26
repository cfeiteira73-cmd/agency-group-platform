-- Agency Group — Market Integrity Checks
-- Migration: 000102_market_integrity.sql

CREATE TABLE IF NOT EXISTS market_integrity_checks (
  report_id                     UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                     UUID          NOT NULL,
  validated_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  total_active_listings         INTEGER       NOT NULL DEFAULT 0,
  stale_listings_count          INTEGER       NOT NULL DEFAULT 0,
  stale_listings_pct            NUMERIC(5,2)  NOT NULL DEFAULT 0,
  staleness_check               TEXT          NOT NULL,
  properties_with_external_data INTEGER       NOT NULL DEFAULT 0,
  deviations_above_threshold    INTEGER       NOT NULL DEFAULT 0,
  max_deviation_pct             NUMERIC(8,4)  NOT NULL DEFAULT 0,
  avg_deviation_pct             NUMERIC(8,4)  NOT NULL DEFAULT 0,
  price_integrity_check         TEXT          NOT NULL,
  sync_check                    TEXT          NOT NULL,
  overall_integrity             TEXT          NOT NULL,
  integrity_score               INTEGER       NOT NULL DEFAULT 0,
  issues                        TEXT[]        NOT NULL DEFAULT '{}',
  deviation_sample              JSONB         NOT NULL DEFAULT '[]'::jsonb,
  provider_sync_statuses        JSONB         NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_market_integrity_tenant
  ON market_integrity_checks(tenant_id, validated_at DESC);

ALTER TABLE market_integrity_checks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'market_integrity_checks'
      AND policyname = 'service_role_full_access'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY service_role_full_access ON market_integrity_checks
        FOR ALL TO service_role USING (true) WITH CHECK (true)
    $pol$;
  END IF;
END $$;
