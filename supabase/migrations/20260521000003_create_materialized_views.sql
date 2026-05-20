-- =============================================================================
-- Agency Group — SH-ROS Graph Materialized Views + Anomaly Baselines
-- Migration: 20260521000003
-- Applied: manually via Supabase Dashboard SQL editor
-- URL: https://supabase.com/dashboard/project/isbfiofwpxqqpgxoftph/sql/new
--
-- Creates:
--   1. anomaly_baselines          — persistent EMA state (survives cold starts)
--   2. causal_trace               — distributed trace records (required by mat views)
--   3. mv_agent_revenue           — per-agent revenue aggregates
--   4. mv_deal_flow_paths         — per-correlation-id step sequences
--   5. mv_tenant_graph_stats      — per-tenant summary stats
--   6. refresh_graph_views()      — SECURITY DEFINER RPC for concurrent refresh
--
-- NOTE: Uses DROP MATERIALIZED VIEW ... CASCADE to handle stale definitions
-- from any partial prior runs. Safe on fresh DBs (IF EXISTS guard).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. anomaly_baselines
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS anomaly_baselines (
  baseline_key    TEXT PRIMARY KEY,
  ema_value       NUMERIC      NOT NULL DEFAULT 0,
  sample_count    INTEGER      NOT NULL DEFAULT 0,
  last_updated    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE anomaly_baselines IS
  'Persistent EMA baselines for AnomalyMonitor. Write-through cache: '
  'updated on every recordMetric() call, loaded on cold start.';

ALTER TABLE anomaly_baselines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anomaly_baselines_service_role" ON anomaly_baselines;
CREATE POLICY "anomaly_baselines_service_role" ON anomaly_baselines
  FOR ALL USING (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 2. causal_trace — distributed trace records
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS causal_trace (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id  TEXT         NOT NULL,
  tenant_id       TEXT,
  step_type       TEXT         NOT NULL DEFAULT 'distributed_trace',
  agent_id        TEXT,
  entity_id       TEXT,
  entity_type     TEXT,
  action          TEXT,
  latency_ms      INTEGER,
  success         BOOLEAN      NOT NULL DEFAULT true,
  error_message   TEXT,
  revenue_delta   NUMERIC,
  metadata        JSONB        NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_causal_trace_correlation ON causal_trace (correlation_id);
CREATE INDEX IF NOT EXISTS idx_causal_trace_tenant      ON causal_trace (tenant_id);
CREATE INDEX IF NOT EXISTS idx_causal_trace_agent       ON causal_trace (agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_causal_trace_created     ON causal_trace (created_at DESC);

ALTER TABLE causal_trace ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "causal_trace_service_role" ON causal_trace;
CREATE POLICY "causal_trace_service_role" ON causal_trace
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 3–5. Materialized views — DROP first to handle stale definitions
-- ---------------------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS mv_tenant_graph_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_deal_flow_paths CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_agent_revenue CASCADE;

-- mv_agent_revenue
CREATE MATERIALIZED VIEW mv_agent_revenue AS
SELECT
  ct.agent_id,
  ct.tenant_id,
  COUNT(DISTINCT ct.correlation_id)                                                    AS deal_count,
  COALESCE(SUM(ct.revenue_delta), 0)                                                   AS total_revenue,
  COALESCE(AVG(ct.revenue_delta) FILTER (WHERE ct.revenue_delta IS NOT NULL), 0)      AS avg_revenue,
  ROUND(
    (COUNT(*) FILTER (WHERE ct.success = true))::NUMERIC / NULLIF(COUNT(*), 0), 4
  )                                                                                     AS success_rate,
  MAX(ct.created_at)                                                                   AS last_activity
FROM causal_trace ct
WHERE ct.agent_id IS NOT NULL AND ct.entity_type = 'deal'
GROUP BY ct.agent_id, ct.tenant_id;

CREATE UNIQUE INDEX mv_agent_revenue_pk            ON mv_agent_revenue (agent_id, tenant_id);
CREATE INDEX        mv_agent_revenue_tenant_revenue ON mv_agent_revenue (tenant_id, total_revenue DESC);

-- mv_deal_flow_paths
CREATE MATERIALIZED VIEW mv_deal_flow_paths AS
SELECT
  ct.tenant_id,
  ct.correlation_id,
  STRING_AGG(ct.step_type, ' > ' ORDER BY ct.created_at)  AS flow_path,
  COUNT(*)                                                  AS step_count,
  COALESCE(SUM(ct.revenue_delta), 0)                       AS total_revenue,
  BOOL_AND(ct.success)                                     AS fully_successful,
  MIN(ct.created_at)                                       AS started_at,
  MAX(ct.created_at)                                       AS completed_at,
  EXTRACT(EPOCH FROM (MAX(ct.created_at) - MIN(ct.created_at)))::INTEGER AS duration_seconds
FROM causal_trace ct
GROUP BY ct.tenant_id, ct.correlation_id;

CREATE UNIQUE INDEX mv_deal_flow_paths_pk             ON mv_deal_flow_paths (correlation_id);
CREATE INDEX        mv_deal_flow_paths_tenant_revenue ON mv_deal_flow_paths (tenant_id, total_revenue DESC);

-- mv_tenant_graph_stats
CREATE MATERIALIZED VIEW mv_tenant_graph_stats AS
SELECT
  ct.tenant_id,
  COUNT(DISTINCT ct.correlation_id)                                                                     AS total_deals,
  COUNT(DISTINCT ct.agent_id)                                                                           AS active_agents,
  COALESCE(SUM(ct.revenue_delta), 0)                                                                    AS total_revenue,
  COALESCE(AVG(ct.revenue_delta) FILTER (WHERE ct.entity_type = 'deal' AND ct.revenue_delta IS NOT NULL), 0) AS avg_deal_revenue,
  ROUND(
    (COUNT(*) FILTER (WHERE ct.success = true))::NUMERIC / NULLIF(COUNT(*), 0), 4
  )                                                                                                      AS overall_success_rate,
  MAX(ct.created_at)                                                                                    AS last_activity
FROM causal_trace ct
GROUP BY ct.tenant_id;

CREATE UNIQUE INDEX mv_tenant_graph_stats_pk ON mv_tenant_graph_stats (tenant_id);

-- ---------------------------------------------------------------------------
-- 6. refresh_graph_views() — SECURITY DEFINER RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION refresh_graph_views()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_start    TIMESTAMPTZ := clock_timestamp();
  v_end      TIMESTAMPTZ;
  v_ms       INTEGER;
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_agent_revenue;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_deal_flow_paths;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_tenant_graph_stats;

  v_end := clock_timestamp();
  v_ms  := EXTRACT(EPOCH FROM (v_end - v_start))::INTEGER * 1000;

  RETURN jsonb_build_object(
    'ok',              true,
    'views_refreshed', to_jsonb(ARRAY['mv_agent_revenue','mv_deal_flow_paths','mv_tenant_graph_stats']),
    'duration_ms',     v_ms,
    'refreshed_at',    v_end
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'ok',          false,
    'error',       SQLERRM,
    'duration_ms', EXTRACT(EPOCH FROM (clock_timestamp() - v_start))::INTEGER * 1000
  );
END;
$func$;

REVOKE ALL ON FUNCTION refresh_graph_views() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION refresh_graph_views() TO service_role;
