-- =============================================================================
-- Agency Group — System Validation Tables v1.0
-- Migration: 000071_system_validation.sql
-- Wave 41 — Full Gap Closure — Real European Capital Infrastructure
--
-- Creates:
--   - production_readiness_reports  (5-gate production readiness gate results)
--   - reality_test_suite_runs       (7-test end-to-end reality test suite runs)
--
-- All tables have RLS enabled with service_role full access.
-- Tenant isolation enforced on all queries.
-- =============================================================================

-- ─── production_readiness_reports ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS production_readiness_reports (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id             text NOT NULL,
  tenant_id             text NOT NULL,
  system_status         text NOT NULL DEFAULT 'BLOCKED'
                          CHECK (system_status IN (
                            'REAL_EUROPEAN_CAPITAL_MARKET_INFRASTRUCTURE',
                            'SIMULATION_ONLY',
                            'PARTIAL_REAL',
                            'BLOCKED'
                          )),
  overall_ready         boolean NOT NULL DEFAULT false,
  gates                 jsonb NOT NULL DEFAULT '[]',
  blocking_gates        jsonb NOT NULL DEFAULT '[]',
  pass_count            integer NOT NULL DEFAULT 0,
  fail_count            integer NOT NULL DEFAULT 0,
  partial_count         integer NOT NULL DEFAULT 0,
  readiness_score_pct   numeric(5,2) NOT NULL DEFAULT 0,
  generated_at          timestamptz NOT NULL DEFAULT now(),
  valid_until           timestamptz
);

-- Unique constraint on report_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_production_readiness_reports_report_id
  ON production_readiness_reports (report_id);

-- Tenant + time index for latest-by-tenant queries
CREATE INDEX IF NOT EXISTS idx_production_readiness_reports_tenant_time
  ON production_readiness_reports (tenant_id, generated_at DESC);

-- Status index for filtering by system_status
CREATE INDEX IF NOT EXISTS idx_production_readiness_reports_status
  ON production_readiness_reports (system_status);

-- RLS
ALTER TABLE production_readiness_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_production_readiness_reports"
  ON production_readiness_reports
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── reality_test_suite_runs ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reality_test_suite_runs (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id             text NOT NULL,
  tenant_id          text NOT NULL,
  total_tests        integer NOT NULL DEFAULT 0,
  passed             integer NOT NULL DEFAULT 0,
  failed             integer NOT NULL DEFAULT 0,
  warnings           integer NOT NULL DEFAULT 0,
  skipped            integer NOT NULL DEFAULT 0,
  critical_failures  integer NOT NULL DEFAULT 0,
  suite_passed       boolean NOT NULL DEFAULT false,
  tests              jsonb NOT NULL DEFAULT '[]',
  run_at             timestamptz NOT NULL DEFAULT now(),
  duration_ms        integer NOT NULL DEFAULT 0
);

-- Unique constraint on run_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_reality_test_suite_runs_run_id
  ON reality_test_suite_runs (run_id);

-- Tenant + time index for latest-by-tenant queries
CREATE INDEX IF NOT EXISTS idx_reality_test_suite_runs_tenant_time
  ON reality_test_suite_runs (tenant_id, run_at DESC);

-- Suite pass/fail index
CREATE INDEX IF NOT EXISTS idx_reality_test_suite_runs_suite_passed
  ON reality_test_suite_runs (suite_passed, run_at DESC);

-- RLS
ALTER TABLE reality_test_suite_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_reality_test_suite_runs"
  ON reality_test_suite_runs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON TABLE production_readiness_reports IS
  'Wave 41 — 5-gate production readiness reports for REAL_EUROPEAN_CAPITAL_MARKET_INFRASTRUCTURE status';

COMMENT ON TABLE reality_test_suite_runs IS
  'Wave 41 — 7-test full system reality test suite runs validating capital infrastructure end-to-end';

COMMENT ON COLUMN production_readiness_reports.system_status IS
  'REAL_EUROPEAN_CAPITAL_MARKET_INFRASTRUCTURE = all 5 gates PASS | PARTIAL_REAL = 3+ PASS no FAIL | BLOCKED = any blocking gate FAIL | SIMULATION_ONLY = all FAIL';

COMMENT ON COLUMN production_readiness_reports.gates IS
  'Array of ValidationGate objects: gate_id, gate_name, description, status, details, blocking, checked_at';

COMMENT ON COLUMN reality_test_suite_runs.tests IS
  'Array of RealityTest objects: test_id, category, test_name, description, result, duration_ms, details, critical';
