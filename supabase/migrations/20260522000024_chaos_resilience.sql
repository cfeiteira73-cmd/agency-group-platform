-- =============================================================================
-- Agency Group — Chaos Resilience Tables
-- 20260522000024_chaos_resilience.sql
--
-- Creates:
--   public.chaos_gauntlet_results   — measurement-based chaos scenario runs
--   public.resilience_reports       — composite SRE resilience grade reports
--   public.feedback_loop_runs       — liquidity feedback loop convergence runs
-- =============================================================================

-- ─── chaos_gauntlet_results ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.chaos_gauntlet_results (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 uuid        NOT NULL,
  total_scenarios           integer     NOT NULL DEFAULT 0,
  passed                    integer     NOT NULL DEFAULT 0,
  degraded                  integer     NOT NULL DEFAULT 0,
  failed                    integer     NOT NULL DEFAULT 0,
  overall_resilience_score  numeric(6,2) NOT NULL DEFAULT 0,
  critical_vulnerabilities  jsonb       NOT NULL DEFAULT '[]',
  system_readiness          text        NOT NULL DEFAULT 'degraded_resilience'
    CHECK (system_readiness IN ('production_ready', 'degraded_resilience', 'critical_gaps')),
  scenarios                 jsonb       NOT NULL DEFAULT '[]',
  ran_at                    timestamptz NOT NULL DEFAULT now(),
  duration_ms               integer     NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_chaos_gauntlet_tenant
  ON public.chaos_gauntlet_results (tenant_id, ran_at DESC);

CREATE INDEX IF NOT EXISTS idx_chaos_gauntlet_readiness
  ON public.chaos_gauntlet_results (system_readiness, ran_at DESC);

-- Row-level security
ALTER TABLE public.chaos_gauntlet_results ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'chaos_gauntlet_results'
      AND policyname = 'chaos_gauntlet_results_tenant_isolation'
  ) THEN
    CREATE POLICY chaos_gauntlet_results_tenant_isolation
      ON public.chaos_gauntlet_results
      USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
  END IF;
END $$;

-- ─── resilience_reports ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.resilience_reports (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   uuid        NOT NULL,
  report_date                 date        NOT NULL,
  chaos_resilience_score      numeric(6,2) NOT NULL DEFAULT 0,
  partition_resilience_score  numeric(6,2) NOT NULL DEFAULT 0,
  failover_readiness_score    numeric(6,2) NOT NULL DEFAULT 0,
  state_consistency_score     numeric(6,2) NOT NULL DEFAULT 0,
  overall_resilience_score    numeric(6,2) NOT NULL DEFAULT 0,
  sre_grade                   text        NOT NULL DEFAULT 'C'
    CHECK (sre_grade IN ('S', 'A', 'B', 'C', 'D')),
  critical_actions            jsonb       NOT NULL DEFAULT '[]',
  passed_checks               jsonb       NOT NULL DEFAULT '[]',
  total_duration_ms           integer     NOT NULL DEFAULT 0,
  generated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resilience_reports_tenant
  ON public.resilience_reports (tenant_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_resilience_reports_date
  ON public.resilience_reports (tenant_id, report_date DESC);

CREATE INDEX IF NOT EXISTS idx_resilience_reports_grade
  ON public.resilience_reports (sre_grade, generated_at DESC);

-- Row-level security
ALTER TABLE public.resilience_reports ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'resilience_reports'
      AND policyname = 'resilience_reports_tenant_isolation'
  ) THEN
    CREATE POLICY resilience_reports_tenant_isolation
      ON public.resilience_reports
      USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
  END IF;
END $$;

-- ─── feedback_loop_runs ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.feedback_loop_runs (
  id                                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                           uuid        NOT NULL,
  total_iterations                    integer     NOT NULL DEFAULT 0,
  converged                           boolean     NOT NULL DEFAULT false,
  convergence_iteration               integer,
  final_state                         jsonb       NOT NULL DEFAULT '{}',
  cumulative_price_adjustment_pct     numeric(8,4) NOT NULL DEFAULT 0,
  cumulative_capital_reallocation_eur numeric(15,2) NOT NULL DEFAULT 0,
  equilibrium_market_temperature      numeric(6,2) NOT NULL DEFAULT 0,
  loop_duration_ms                    integer     NOT NULL DEFAULT 0,
  ran_at                              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_loop_tenant
  ON public.feedback_loop_runs (tenant_id, ran_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_loop_converged
  ON public.feedback_loop_runs (tenant_id, converged, ran_at DESC);

-- Row-level security
ALTER TABLE public.feedback_loop_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'feedback_loop_runs'
      AND policyname = 'feedback_loop_runs_tenant_isolation'
  ) THEN
    CREATE POLICY feedback_loop_runs_tenant_isolation
      ON public.feedback_loop_runs
      USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
  END IF;
END $$;

-- ─── Comments ─────────────────────────────────────────────────────────────────

COMMENT ON TABLE public.chaos_gauntlet_results IS
  'Measurement-based chaos scenario evaluation results. NEVER injects real failures — models blast radius from current DB state.';

COMMENT ON TABLE public.resilience_reports IS
  'Composite SRE resilience reports combining chaos, partition, failover, and state consistency scores.';

COMMENT ON TABLE public.feedback_loop_runs IS
  'Liquidity feedback loop convergence runs: capital inflow → price shift → demand shift → reallocation → equilibrium.';
