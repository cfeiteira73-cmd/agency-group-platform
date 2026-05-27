-- Wave 50 Phase 5: Live Failure Reality Grid
-- failure_reality_reports

CREATE TABLE IF NOT EXISTS failure_reality_reports (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id               UUID        NOT NULL UNIQUE,
  tenant_id               UUID        NOT NULL,
  assessed_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  failure_reality_grade   TEXT        NOT NULL DEFAULT 'NOT_PROVEN',
  resilience_score        SMALLINT    NOT NULL DEFAULT 0,
  rto_hard_limit_met      BOOLEAN     NOT NULL DEFAULT FALSE,
  rpo_verified            BOOLEAN     NOT NULL DEFAULT FALSE,
  region_failover_proven  BOOLEAN     NOT NULL DEFAULT FALSE,
  failure_reality_hash    TEXT        NOT NULL,
  blockers                JSONB       NOT NULL DEFAULT '[]',
  issues                  JSONB       NOT NULL DEFAULT '[]',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE failure_reality_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'failure_reality_reports'
      AND policyname = 'service_role_all_failure_reality_reports'
  ) THEN
    CREATE POLICY service_role_all_failure_reality_reports
      ON failure_reality_reports FOR ALL
      TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_failure_reality_tenant
  ON failure_reality_reports (tenant_id, assessed_at DESC);
