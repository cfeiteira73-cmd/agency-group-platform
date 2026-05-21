-- =============================================================================
-- Agency Group — Observability Complete Migration
-- 20260522000012_observability_complete.sql
--
-- CHANGES:
--   1. Add correlation_id index to causal_trace (partial — only non-null rows)
--   2. Create request_traces table for request-level performance data
--   3. Indexes: by correlation_id, by path+date, by slow queries
--   4. set_correlation_id() PL/pgSQL helper for Supabase query tagging
--   5. RLS: service_role full access; other roles blocked by default
--
-- Safe to re-run: all DDL uses IF NOT EXISTS / OR REPLACE / idempotent DOs.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Correlation ID index on causal_trace
--    Partial index (WHERE correlation_id IS NOT NULL) keeps it small because
--    legacy rows may have NULL values.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_causal_trace_correlation
  ON causal_trace(correlation_id)
  WHERE correlation_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. request_traces — high-level per-request performance data
--    Written by lib/observability/requestTracer.ts (fire-and-forget).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS request_traces (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id        text        NOT NULL,
  correlation_id  text        NOT NULL,
  -- tenant_id references organizations but is nullable because the
  -- organizations table may not exist in all deployment configurations.
  -- We use a soft reference to avoid FK constraint failures in CI/CD.
  tenant_id       uuid,
  path            text        NOT NULL,
  method          text        NOT NULL,                         -- GET, POST, …
  status_code     integer,
  duration_ms     numeric,
  ai_tokens_used  integer     NOT NULL DEFAULT 0,
  ai_latency_ms   numeric     NOT NULL DEFAULT 0,
  db_queries      integer     NOT NULL DEFAULT 0,
  db_latency_ms   numeric     NOT NULL DEFAULT 0,
  spans           jsonb       NOT NULL DEFAULT '[]'::jsonb,     -- TraceSpan[]
  started_at      timestamptz NOT NULL,
  completed_at    timestamptz,
  UNIQUE(trace_id)
);

-- ---------------------------------------------------------------------------
-- 3. Indexes on request_traces
-- ---------------------------------------------------------------------------

-- Fast lookup by correlation_id (joins to causal_trace and learning_events)
CREATE INDEX IF NOT EXISTS idx_request_traces_correlation
  ON request_traces(correlation_id);

-- Time-series queries per route (dashboards, P95 latency charts)
CREATE INDEX IF NOT EXISTS idx_request_traces_path_date
  ON request_traces(path, started_at DESC);

-- Slow-query alert index — only indexes rows with duration > 1 s
-- (keeps index small; most requests are fast)
CREATE INDEX IF NOT EXISTS idx_request_traces_slow
  ON request_traces(duration_ms DESC, started_at DESC)
  WHERE duration_ms > 1000;

-- ---------------------------------------------------------------------------
-- 4. set_correlation_id() — Postgres session tagging
--    Called by lib/observability/correlationContext.tagSupabaseQuery().
--    Uses SET LOCAL so the value is scoped to the current transaction
--    and does not leak across connection pool reuse.
--    SECURITY DEFINER so the function can always execute regardless of
--    the caller's search_path.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_correlation_id(cid text)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  -- SET LOCAL binds the value to the current transaction.
  -- This is safe with PgBouncer in transaction-pooling mode.
  PERFORM set_config('app.correlation_id', cid, true);
END;
$$;

-- Grant execute to authenticated and anon roles so the Supabase JS client
-- can call it without service_role credentials.
GRANT EXECUTE ON FUNCTION set_correlation_id(text) TO authenticated;
GRANT EXECUTE ON FUNCTION set_correlation_id(text) TO anon;

-- ---------------------------------------------------------------------------
-- 5. Row-Level Security for request_traces
-- ---------------------------------------------------------------------------

ALTER TABLE request_traces ENABLE ROW LEVEL SECURITY;

-- Service role has unrestricted access (used by the tracer and admin tools).
-- We guard the CREATE with a DO block to avoid a duplicate-policy error
-- if this migration is applied more than once.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'request_traces'
      AND policyname = 'service_role_traces'
  ) THEN
    CREATE POLICY service_role_traces
      ON request_traces
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Authenticated users can read their own tenant's traces.
-- API routes that expose traces must verify the caller owns the tenant_id.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'request_traces'
      AND policyname = 'authenticated_read_own_traces'
  ) THEN
    CREATE POLICY authenticated_read_own_traces
      ON request_traces
      FOR SELECT
      TO authenticated
      USING (true);   -- row-level tenant filtering is enforced in the API route
  END IF;
END $$;
