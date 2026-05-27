-- Wave 51 Phase 1 — System Reality Audit
-- table: system_reality_graphs

CREATE TABLE IF NOT EXISTS system_reality_graphs (
  id                   bigserial PRIMARY KEY,
  graph_id             uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL,
  total_domains        integer NOT NULL DEFAULT 0,
  fully_real_domains   integer NOT NULL DEFAULT 0,
  unconfigured_domains integer NOT NULL DEFAULT 0,
  reality_coverage_pct numeric(5,2) NOT NULL DEFAULT 0,
  reality_grade        text NOT NULL DEFAULT 'REALITY_UNKNOWN',
  system_truth_score   numeric(5,2) NOT NULL DEFAULT 0,
  issue_count          integer NOT NULL DEFAULT 0,
  graph_hash           text NOT NULL,
  report_json          jsonb NOT NULL DEFAULT '{}',
  generated_at         timestamptz NOT NULL DEFAULT now(),
  created_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE system_reality_graphs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'system_reality_graphs' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON system_reality_graphs
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_system_reality_graphs_tenant ON system_reality_graphs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_system_reality_graphs_grade  ON system_reality_graphs (reality_grade);
CREATE INDEX IF NOT EXISTS idx_system_reality_graphs_date   ON system_reality_graphs (generated_at DESC);
