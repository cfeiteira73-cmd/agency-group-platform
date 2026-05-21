-- =============================================================================
-- 000040: Test Suite Results tables
-- Agency Group — Wave 36
-- =============================================================================

CREATE TABLE IF NOT EXISTS e2e_flow_results (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL,
  flow_stages             JSONB NOT NULL DEFAULT '[]',
  pipeline_completion_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  flow_health             TEXT NOT NULL DEFAULT 'broken',
  critical_breaks         JSONB NOT NULL DEFAULT '[]',
  executed_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS market_simulation_results (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,
  simulation_params JSONB NOT NULL DEFAULT '{}',
  stability_metrics JSONB NOT NULL DEFAULT '{}',
  stress_points     JSONB NOT NULL DEFAULT '{}',
  simulation_grade  TEXT NOT NULL DEFAULT 'UNSTABLE',
  warnings          JSONB NOT NULL DEFAULT '[]',
  executed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS failure_test_results (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL,
  scenarios                JSONB NOT NULL DEFAULT '[]',
  overall_resilience_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  critical_spofs           JSONB NOT NULL DEFAULT '[]',
  executed_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS financial_stress_results (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL,
  baseline                 JSONB NOT NULL DEFAULT '{}',
  stress_scenarios         JSONB NOT NULL DEFAULT '[]',
  system_financial_capacity JSONB NOT NULL DEFAULT '{}',
  stress_grade             TEXT NOT NULL DEFAULT 'FRAGILE',
  recommendations          JSONB NOT NULL DEFAULT '[]',
  executed_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS test_suite_runs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL,
  overall_score  NUMERIC(5,2) NOT NULL DEFAULT 0,
  all_passed     BOOLEAN NOT NULL DEFAULT false,
  e2e_result     JSONB,
  market_result  JSONB,
  failure_result JSONB,
  stress_result  JSONB,
  duration_ms    INTEGER NOT NULL DEFAULT 0,
  run_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_e2e_results_tenant
  ON e2e_flow_results(tenant_id, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_sim_tenant
  ON market_simulation_results(tenant_id, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_failure_tests_tenant
  ON failure_test_results(tenant_id, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_financial_stress_tenant
  ON financial_stress_results(tenant_id, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_test_suite_runs_tenant
  ON test_suite_runs(tenant_id, run_at DESC);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE e2e_flow_results          ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_simulation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE failure_test_results      ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_stress_results  ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_suite_runs           ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'test_suite_runs' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON test_suite_runs
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'e2e_flow_results' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON e2e_flow_results
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'market_simulation_results' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON market_simulation_results
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'failure_test_results' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON failure_test_results
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'financial_stress_results' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON financial_stress_results
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;
