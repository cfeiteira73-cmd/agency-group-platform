-- =============================================================================
-- Agency Group — Migration 20260519000000
-- RLS: Observability Tables (causal_trace, ai_audit_log,
--      sofia_conversations, learning_events)
--
-- STRATEGY:
--   - Service role (SUPABASE_SERVICE_ROLE_KEY) bypasses RLS automatically in
--     Supabase — no explicit policy needed for it.
--   - causal_trace      → HAS tenant_id (TEXT NOT NULL DEFAULT 'agency-group')
--                         Authenticated users: SELECT where tenant_id matches
--                         the request-scoped session variable app.tenant_id.
--   - ai_audit_log      → NO tenant_id column
--                         Authenticated users: SELECT only (no row filter).
--   - sofia_conversations → NO tenant_id column
--                         Authenticated users: SELECT only (no row filter).
--   - learning_events   → NO tenant_id column
--                         Authenticated users: SELECT only (no row filter).
--   - Anon / public role: zero access to all four tables.
--
-- IDEMPOTENT: safe to run multiple times.
--   - Uses ALTER TABLE ... ENABLE ROW LEVEL SECURITY (idempotent).
--   - All policies are preceded by DROP POLICY IF EXISTS.
--   - set_tenant_id() uses CREATE OR REPLACE FUNCTION.
--
-- ROLLBACK (if needed):
--   ALTER TABLE causal_trace      DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE ai_audit_log      DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE sofia_conversations DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE learning_events   DISABLE ROW LEVEL SECURITY;
--   -- Drop policies below, then re-create previous permissive versions.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- HELPER: set_tenant_id(t_id text)
-- Call once per request in API route server-side code:
--   await supabase.rpc('set_tenant_id', { t_id: 'agency-group' })
-- Uses transaction-local config (true = txn scope, reset when connection closes).
-- SECURITY DEFINER ensures callers cannot bypass by changing search_path.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_tenant_id(t_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.tenant_id', t_id, true);
END;
$$;

COMMENT ON FUNCTION set_tenant_id(text) IS
  'Set the request-scoped tenant identifier used by RLS policies on tenant-aware tables.';

-- =============================================================================
-- TABLE: causal_trace
-- Schema: has tenant_id TEXT NOT NULL DEFAULT ''agency-group''
-- Access: service_role = full (bypasses RLS); authenticated = SELECT own tenant;
--         anon = none.
-- =============================================================================

-- Ensure RLS is enabled (idempotent)
ALTER TABLE causal_trace ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent guard before re-create)
DROP POLICY IF EXISTS "causal_trace_service_full"         ON causal_trace;
DROP POLICY IF EXISTS "causal_trace_authenticated_select"  ON causal_trace;
DROP POLICY IF EXISTS "causal_trace_anon_deny"             ON causal_trace;

-- Service role: bypasses RLS automatically in Supabase (no policy needed).
-- Authenticated: SELECT rows for matching tenant OR the default agency-group tenant.
-- Anon: no policy = no access (RLS closed by default when enabled).

CREATE POLICY "causal_trace_authenticated_select"
  ON causal_trace
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = current_setting('app.tenant_id', true)
    OR tenant_id = 'agency-group'
  );

-- Explicit deny for anon role (belt-and-suspenders; RLS default already blocks them)
CREATE POLICY "causal_trace_anon_deny"
  ON causal_trace
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- =============================================================================
-- TABLE: ai_audit_log
-- Schema: NO tenant_id column (correlation_id, model, circuit_name, ...)
-- Access: service_role = full (bypasses RLS); authenticated = SELECT only;
--         anon = none.
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ai_audit_log'
  ) THEN

    -- Enable RLS
    EXECUTE 'ALTER TABLE ai_audit_log ENABLE ROW LEVEL SECURITY';

    -- Drop and recreate policies
    EXECUTE 'DROP POLICY IF EXISTS "ai_audit_log_authenticated_select" ON ai_audit_log';
    EXECUTE 'DROP POLICY IF EXISTS "ai_audit_log_anon_deny"            ON ai_audit_log';

    -- Authenticated agents may read all audit entries (no tenant filter — no column)
    EXECUTE $p$
      CREATE POLICY "ai_audit_log_authenticated_select"
        ON ai_audit_log
        FOR SELECT
        TO authenticated
        USING (true)
    $p$;

    -- Anon: explicit deny
    EXECUTE $p$
      CREATE POLICY "ai_audit_log_anon_deny"
        ON ai_audit_log
        FOR ALL
        TO anon
        USING (false)
        WITH CHECK (false)
    $p$;

  ELSE
    RAISE NOTICE 'Table ai_audit_log does not exist yet — skipping RLS setup. Re-run this migration after creating the table.';
  END IF;
END $$;

-- =============================================================================
-- TABLE: sofia_conversations
-- Schema: NO tenant_id column (session_id, user_message, assistant_message, ...)
-- Access: service_role = full (bypasses RLS); authenticated = SELECT only;
--         anon = none.
-- NOTE: Migration 20260407_003 already set "Service role only" policy.
--       We replace it with a more granular set that also allows authenticated
--       SELECT while preserving the zero-anon rule.
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'sofia_conversations'
  ) THEN

    EXECUTE 'ALTER TABLE sofia_conversations ENABLE ROW LEVEL SECURITY';

    -- Remove previous permissive policy from 20260407_003 migration
    EXECUTE 'DROP POLICY IF EXISTS "Service role only"                          ON sofia_conversations';
    EXECUTE 'DROP POLICY IF EXISTS "sofia_conversations_authenticated_select"   ON sofia_conversations';
    EXECUTE 'DROP POLICY IF EXISTS "sofia_conversations_anon_deny"              ON sofia_conversations';

    -- Authenticated: read-only (no write — API routes use service role for inserts)
    EXECUTE $p$
      CREATE POLICY "sofia_conversations_authenticated_select"
        ON sofia_conversations
        FOR SELECT
        TO authenticated
        USING (true)
    $p$;

    -- Anon: explicit deny
    EXECUTE $p$
      CREATE POLICY "sofia_conversations_anon_deny"
        ON sofia_conversations
        FOR ALL
        TO anon
        USING (false)
        WITH CHECK (false)
    $p$;

  ELSE
    RAISE NOTICE 'Table sofia_conversations does not exist yet — skipping RLS setup.';
  END IF;
END $$;

-- =============================================================================
-- TABLE: learning_events
-- Schema: NO tenant_id column (event_type, lead_id, deal_id, correlation_id, ...)
-- Access: service_role = full (bypasses RLS); authenticated = SELECT only;
--         anon = none.
-- NOTE: Migrations 20260430_001 and 20260515_018 previously set policies here.
--       20260515_018 set USING(false) for authenticated (full block).
--       We replace with SELECT-permitted, no-write, no-anon.
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'learning_events'
  ) THEN

    EXECUTE 'ALTER TABLE learning_events ENABLE ROW LEVEL SECURITY';

    -- Drop all prior learning_events RLS policies (multiple migrations touched this)
    EXECUTE 'DROP POLICY IF EXISTS "learning_events_agent_read"    ON learning_events';
    EXECUTE 'DROP POLICY IF EXISTS "learning_events_insert"        ON learning_events';
    EXECUTE 'DROP POLICY IF EXISTS "learning_events_service_only"  ON learning_events';
    EXECUTE 'DROP POLICY IF EXISTS "learning_events_authenticated_select" ON learning_events';
    EXECUTE 'DROP POLICY IF EXISTS "learning_events_anon_deny"     ON learning_events';

    -- Authenticated: read-only aggregate access (analytics use case)
    EXECUTE $p$
      CREATE POLICY "learning_events_authenticated_select"
        ON learning_events
        FOR SELECT
        TO authenticated
        USING (true)
    $p$;

    -- Anon: explicit deny
    EXECUTE $p$
      CREATE POLICY "learning_events_anon_deny"
        ON learning_events
        FOR ALL
        TO anon
        USING (false)
        WITH CHECK (false)
    $p$;

  ELSE
    RAISE NOTICE 'Table learning_events does not exist yet — skipping RLS setup.';
  END IF;
END $$;

-- =============================================================================
-- VERIFICATION: confirm RLS is enabled on all four tables (warns if not)
-- =============================================================================

DO $$
DECLARE
  tbl  TEXT;
  tbls TEXT[] := ARRAY[
    'causal_trace',
    'ai_audit_log',
    'sofia_conversations',
    'learning_events'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename   = tbl
        AND rowsecurity = true
    ) THEN
      -- Table may not exist yet — that is acceptable (DO block guards above)
      RAISE NOTICE 'RLS not confirmed on table: % (may not exist yet)', tbl;
    ELSE
      RAISE NOTICE 'RLS confirmed ON: %', tbl;
    END IF;
  END LOOP;
END $$;

-- Done
SELECT '20260519000000_rls_observability_tables applied' AS status;
