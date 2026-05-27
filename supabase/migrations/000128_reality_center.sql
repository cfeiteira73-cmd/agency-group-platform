-- Wave 50 Phase 6: Live Institutional Reality Center
-- reality_center_reports

CREATE TABLE IF NOT EXISTS reality_center_reports (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id               UUID        NOT NULL UNIQUE,
  tenant_id               UUID        NOT NULL,
  assessed_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  reality_center_status   TEXT        NOT NULL DEFAULT 'OFFLINE',
  global_reality_score    SMALLINT    NOT NULL DEFAULT 0,
  operational_readiness   TEXT        NOT NULL DEFAULT 'PRE_OPERATIONAL',
  investor_confidence     SMALLINT    NOT NULL DEFAULT 0,
  liquidity_confidence    SMALLINT    NOT NULL DEFAULT 0,
  reality_center_hash     TEXT        NOT NULL,
  issues                  JSONB       NOT NULL DEFAULT '[]',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE reality_center_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'reality_center_reports'
      AND policyname = 'service_role_all_reality_center_reports'
  ) THEN
    CREATE POLICY service_role_all_reality_center_reports
      ON reality_center_reports FOR ALL
      TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_reality_center_tenant
  ON reality_center_reports (tenant_id, assessed_at DESC);
