-- =============================================================================
-- Agency Group — SH-ROS Graph Materialized Views + Anomaly Baselines
-- Migration: 20260521000003
-- Applied: manually via Supabase Dashboard SQL editor
-- URL: https://supabase.com/dashboard/project/isbfiofwpxqqpgxoftph/sql/new
--
-- Creates:
--   1. anomaly_baselines          — persistent EMA state (survives cold starts)
--   2. mv_agent_revenue           — per-agent revenue aggregates
--   3. mv_deal_flow_paths         — per-correlation-id step sequences
--   4. mv_tenant_graph_stats      — per-tenant summary stats
--   5. refresh_graph_views()      — SECURITY DEFINER RPC for concurrent refresh
--
-- IMPORTANT: Run the initial REFRESH MATERIALIZED VIEW (non-concurrent) at the
-- bottom of this file ONCE to populate views before CONCURRENT refresh can work.
-- Subsequent refreshes use CONCURRENT via the refresh_graph_views() RPC.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. anomaly_baselines
--    Persistent EMA (Exponential Moving Average) state for anomaly detection.
--    Keyed by metric name; survives serverless cold starts.
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
  FOR ALL
  USING (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 2. mv_agent_revenue
--    Matches TypeScript interface AgentRevenueMV in lib/graph/materializedViews.ts
--    Columns: tenant_id, agent_id, deal_count, total_revenue, avg_revenue,
--             success_rate (0..1 decimal), last_activity
-- ---------------------------------------------------------------------------

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_agent_revenue AS
SELECT
  ct.agent_id,
  ct.tenant_id,
  COUNT(DISTINCT ct.correlation_id)                              AS deal_count,
  COALESCE(SUM(ct.revenue_delta), 0)                            AS total_revenue,
  COALESCE(AVG(ct.revenue_delta) FILTER (WHERE ct.revenue_delta IS NOT NULL), 0)
                                                                 AS avg_revenue,
  ROUND(
    (COUNT(*) FILTER (WHERE ct.success = true))::NUMERIC /
    NULLIF(COUNT(*), 0),
    4
  )                                                              AS success_rate,
  MAX(ct.created_at)                                            AS last_activity
FROM causal_trace ct
WHERE ct.agent_id IS NOT NULL
  AND ct.entity_type = 'deal'
GROUP BY ct.agent_id, ct.tenant_id;

-- UNIQUE index: required for REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS mv_agent_revenue_pk
  ON mv_agent_revenue (agent_id, tenant_id);

-- Fast lookup by tenant
CREATE INDEX IF NOT EXISTS mv_agent_revenue_tenant_revenue
  ON mv_agent_revenue (tenant_id, total_revenue DESC);

-- ---------------------------------------------------------------------------
-- 3. mv_deal_flow_paths
--    Matches TypeScript interface DealFlowPathMV in lib/graph/materializedViews.ts
--    Columns: tenant_id, correlation_id, flow_path, step_count, total_revenue,
--             fully_successful, started_at, completed_at, duration_seconds
-- ---------------------------------------------------------------------------

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_deal_flow_paths AS
SELECT
  ct.tenant_id,
  ct.correlation_id,
  STRING_AGG(ct.step_type, ' → ' ORDER BY ct.created_at)       AS flow_path,
  COUNT(*)                                                       AS step_count,
  COALESCE(SUM(ct.revenue_delta), 0)                            AS total_revenue,
  BOOL_AND(ct.success)                                          AS fully_successful,
  MIN(ct.created_at)                                            AS started_at,
  MAX(ct.created_at)                                            AS completed_at,
  EXTRACT(EPOCH FROM (MAX(ct.created_at) - MIN(ct.created_at)))::INTEGER
                                                                 AS duration_seconds
FROM causal_trace ct
GROUP BY ct.tenant_id, ct.correlation_id;

-- UNIQUE index: required for CONCURRENT refresh
CREATE UNIQUE INDEX IF NOT EXISTS mv_deal_flow_paths_pk
  ON mv_deal_flow_paths (correlation_id);

-- Fast lookup by tenant, revenue, and recency
CREATE INDEX IF NOT EXISTS mv_deal_flow_paths_tenant_revenue
  ON mv_deal_flow_paths (tenant_id, total_revenue DESC);

-- ---------------------------------------------------------------------------
-- 4. mv_tenant_graph_stats
--    Matches TypeScript interface TenantGraphStatsMV in lib/graph/materializedViews.ts
--    Columns: tenant_id, total_deals, active_agents, total_revenue,
--             avg_deal_revenue, overall_success_rate (0..1), last_activity
-- ---------------------------------------------------------------------------

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_tenant_graph_stats AS
SELECT
  ct.tenant_id,
  COUNT(DISTINCT ct.correlation_id)                              AS total_deals,
  COUNT(DISTINCT ct.agent_id)                                   AS active_agents,
  COALESCE(SUM(ct.revenue_delta), 0)                            AS total_revenue,
  COALESCE(
    AVG(ct.revenue_delta) FILTER (WHERE ct.entity_type = 'deal' AND ct.revenue_delta IS NOT NULL),
    0
  )                                                              AS avg_deal_revenue,
  ROUND(
    (COUNT(*) FILTER (WHERE ct.success = true))::NUMERIC /
    NULLIF(COUNT(*), 0),
    4
  )                                                              AS overall_success_rate,
  MAX(ct.created_at)                                            AS last_activity
FROM causal_trace ct
GROUP BY ct.tenant_id;

-- UNIQUE index: required for CONCURRENT refresh
CREATE UNIQUE INDEX IF NOT EXISTS mv_tenant_graph_stats_pk
  ON mv_tenant_graph_stats (tenant_id);

-- ---------------------------------------------------------------------------
-- 5. refresh_graph_views() — SECURITY DEFINER RPC
--    Called by /api/cron/refresh-graph-views via db.rpc('refresh_graph_views').
--    Runs as the table owner (postgres) so no Management API token is needed.
--    Returns JSON: { ok, views_refreshed, duration_ms, refreshed_at }
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION refresh_graph_views()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    'ok',           false,
    'error',        SQLERRM,
    'duration_ms',  EXTRACT(EPOCH FROM (clock_timestamp() - v_start))::INTEGER * 1000
  );
END;
$$;

-- Restrict to service_role only
REVOKE ALL ON FUNCTION refresh_graph_views() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION refresh_graph_views() TO service_role;

-- ---------------------------------------------------------------------------
-- 6. Initial populate (non-CONCURRENT required before first CONCURRENT refresh)
--    Only runs at migration time; subsequent refreshes use CONCURRENT via RPC.
-- ---------------------------------------------------------------------------
REFRESH MATERIALIZED VIEW mv_agent_revenue;
REFRESH MATERIALIZED VIEW mv_deal_flow_paths;
REFRESH MATERIALIZED VIEW mv_tenant_graph_stats;
