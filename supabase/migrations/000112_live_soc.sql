-- Agency Group — Live Security Operations Center Store
-- Migration: 000112_live_soc.sql
-- Wave 48 GAP 3 — SOC operational reports, forensic snapshots

CREATE TABLE IF NOT EXISTS live_soc_reports (
  report_id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID         NOT NULL,
  assessed_at                 TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  soc_operational_status      TEXT         NOT NULL DEFAULT 'NOT_CONFIGURED',
  active_incidents            INTEGER      NOT NULL DEFAULT 0,
  impossible_travel_events    INTEGER      NOT NULL DEFAULT 0,
  abnormal_capital_events     INTEGER      NOT NULL DEFAULT 0,
  keys_requiring_rotation     INTEGER      NOT NULL DEFAULT 0,
  forensic_snapshots_taken    INTEGER      NOT NULL DEFAULT 0,
  pagerduty_configured        BOOLEAN      NOT NULL DEFAULT false,
  slack_configured            BOOLEAN      NOT NULL DEFAULT false,
  threat_detections           JSONB        NOT NULL DEFAULT '[]'::jsonb,
  key_rotation_alerts         JSONB        NOT NULL DEFAULT '[]'::jsonb,
  incidents                   JSONB        NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_live_soc_tenant
  ON live_soc_reports(tenant_id, assessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_live_soc_status
  ON live_soc_reports(tenant_id, soc_operational_status, assessed_at DESC);

ALTER TABLE live_soc_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'live_soc_reports'
      AND policyname = 'service_role_full_access'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY service_role_full_access ON live_soc_reports
        FOR ALL TO service_role USING (true) WITH CHECK (true)
    $pol$;
  END IF;
END $$;

-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS forensic_snapshots (
  snapshot_id       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID         NOT NULL,
  trigger_event     TEXT         NOT NULL,
  severity          TEXT         NOT NULL DEFAULT 'SEV3',
  snapshot_hash     TEXT         NOT NULL,
  captured_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  context           JSONB        NOT NULL DEFAULT '{}'::jsonb,
  immutable         BOOLEAN      NOT NULL DEFAULT true
);

-- Forensic snapshots are immutable — no updates allowed after creation
CREATE INDEX IF NOT EXISTS idx_forensic_snapshots_tenant
  ON forensic_snapshots(tenant_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_forensic_snapshots_severity
  ON forensic_snapshots(tenant_id, severity, captured_at DESC);

ALTER TABLE forensic_snapshots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'forensic_snapshots'
      AND policyname = 'service_role_full_access'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY service_role_full_access ON forensic_snapshots
        FOR ALL TO service_role USING (true) WITH CHECK (true)
    $pol$;
  END IF;
END $$;
