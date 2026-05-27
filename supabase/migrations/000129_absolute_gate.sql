-- Wave 50 Phase 7: Absolute Institutional Reality Gate
-- absolute_reality_certifications

CREATE TABLE IF NOT EXISTS absolute_reality_certifications (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id                 UUID        NOT NULL UNIQUE,
  tenant_id                 UUID        NOT NULL,
  generated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  absolute_status           TEXT        NOT NULL DEFAULT 'PRE_OPERATIONAL',
  go_live_authorized        BOOLEAN     NOT NULL DEFAULT FALSE,
  gates_passed              SMALLINT    NOT NULL DEFAULT 0,
  gates_total               SMALLINT    NOT NULL DEFAULT 24,
  combined_score            SMALLINT    NOT NULL DEFAULT 0,
  final_go_live_hash        TEXT        NOT NULL,
  absolute_reality_hash     TEXT        NOT NULL UNIQUE,
  blockers                  JSONB       NOT NULL DEFAULT '[]',
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE absolute_reality_certifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'absolute_reality_certifications'
      AND policyname = 'service_role_all_absolute_reality_certifications'
  ) THEN
    CREATE POLICY service_role_all_absolute_reality_certifications
      ON absolute_reality_certifications FOR ALL
      TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_absolute_gate_tenant
  ON absolute_reality_certifications (tenant_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_absolute_gate_hash
  ON absolute_reality_certifications (absolute_reality_hash);
CREATE INDEX IF NOT EXISTS idx_absolute_gate_status
  ON absolute_reality_certifications (absolute_status, generated_at DESC);
