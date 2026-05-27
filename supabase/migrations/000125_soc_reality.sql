-- Wave 50 Phase 3: Live Operational SOC Reality
-- soc_reality_reports + key_rotation_schedules

CREATE TABLE IF NOT EXISTS soc_reality_reports (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id                   UUID        NOT NULL UNIQUE,
  tenant_id                   UUID        NOT NULL,
  assessed_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  soc_reality_status          TEXT        NOT NULL DEFAULT 'NOT_OPERATIONAL',
  soc_reality_score           SMALLINT    NOT NULL DEFAULT 0,
  open_sev1_count             SMALLINT    NOT NULL DEFAULT 0,
  sev1_sla_breached           SMALLINT    NOT NULL DEFAULT 0,
  rotations_overdue           SMALLINT    NOT NULL DEFAULT 0,
  plaintext_secret_violations SMALLINT    NOT NULL DEFAULT 0,
  soc_reality_hash            TEXT        NOT NULL,
  blockers                    JSONB       NOT NULL DEFAULT '[]',
  issues                      JSONB       NOT NULL DEFAULT '[]',
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE soc_reality_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'soc_reality_reports'
      AND policyname = 'service_role_all_soc_reality_reports'
  ) THEN
    CREATE POLICY service_role_all_soc_reality_reports
      ON soc_reality_reports FOR ALL
      TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS key_rotation_schedules (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID        NOT NULL,
  secret_name              TEXT        NOT NULL,
  rotation_category        TEXT        NOT NULL,
  last_rotated_at          TIMESTAMPTZ,
  next_rotation_due        TIMESTAMPTZ,
  auto_rotation_enabled    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, secret_name)
);

ALTER TABLE key_rotation_schedules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'key_rotation_schedules'
      AND policyname = 'service_role_all_key_rotation_schedules'
  ) THEN
    CREATE POLICY service_role_all_key_rotation_schedules
      ON key_rotation_schedules FOR ALL
      TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_soc_reality_tenant
  ON soc_reality_reports (tenant_id, assessed_at DESC);
