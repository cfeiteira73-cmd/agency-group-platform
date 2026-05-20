-- =============================================================================
-- Agency Group — Migration 20260520000005
-- Fix permissive RLS on learning_events and runtime_events
--
-- VULNERABILITY: learning_events had USING(true) for authenticated role,
-- meaning any authenticated user could read all orgs' event data.
-- runtime_events had org isolation via JWT claims, which is correct but
-- lacked an explicit anon deny policy.
--
-- FIX:
--   learning_events  → authenticated users blocked from direct SELECT;
--                      only service_role (via supabaseAdmin) has access.
--                      Portal analytics use the service role client.
--   runtime_events   → keep org_id isolation; add explicit anon deny.
--
-- IDEMPOTENT: safe to run multiple times.
-- ROLLBACK: see comments at bottom of file.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: learning_events
-- Previous policy: authenticated_select with USING(true) = ALL rows visible
-- to any authenticated user regardless of org/tenant.
-- Fix: remove the permissive read; service_role bypasses RLS automatically.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'learning_events'
  ) THEN

    EXECUTE 'ALTER TABLE learning_events ENABLE ROW LEVEL SECURITY';

    -- Drop all prior learning_events RLS policies (idempotent)
    EXECUTE 'DROP POLICY IF EXISTS "learning_events_agent_read"               ON learning_events';
    EXECUTE 'DROP POLICY IF EXISTS "learning_events_insert"                   ON learning_events';
    EXECUTE 'DROP POLICY IF EXISTS "learning_events_service_only"             ON learning_events';
    EXECUTE 'DROP POLICY IF EXISTS "learning_events_authenticated_select"     ON learning_events';
    EXECUTE 'DROP POLICY IF EXISTS "learning_events_anon_deny"                ON learning_events';
    EXECUTE 'DROP POLICY IF EXISTS "allow_all_learning_events"                ON learning_events';
    EXECUTE 'DROP POLICY IF EXISTS "authenticated_read_learning_events"       ON learning_events';
    EXECUTE 'DROP POLICY IF EXISTS "service_role_all_learning_events"         ON learning_events';

    -- Authenticated users: NO direct access. All reads must go through
    -- service-role API routes (supabaseAdmin), which bypass RLS.
    -- This prevents cross-tenant data leakage via authenticated JWTs.
    EXECUTE $p$
      CREATE POLICY "learning_events_authenticated_deny"
        ON learning_events
        FOR ALL
        TO authenticated
        USING (false)
        WITH CHECK (false)
    $p$;

    -- Anon: explicit deny (belt-and-suspenders; RLS default already blocks)
    EXECUTE $p$
      CREATE POLICY "learning_events_anon_deny"
        ON learning_events
        FOR ALL
        TO anon
        USING (false)
        WITH CHECK (false)
    $p$;

    RAISE NOTICE 'learning_events RLS hardened: authenticated access revoked.';

  ELSE
    RAISE NOTICE 'Table learning_events does not exist yet — skipping.';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: runtime_events
-- Previous policy: org_id isolation via JWT claims (correct concept).
-- Adds: explicit anon deny; keeps org-scoped authenticated access but
-- guards against null/missing org_id in claims producing false matches.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'runtime_events'
  ) THEN

    EXECUTE 'ALTER TABLE runtime_events ENABLE ROW LEVEL SECURITY';

    -- Drop existing policies (idempotent)
    EXECUTE 'DROP POLICY IF EXISTS "runtime_events_org_isolation"             ON runtime_events';
    EXECUTE 'DROP POLICY IF EXISTS "authenticated_read_runtime_events"        ON runtime_events';
    EXECUTE 'DROP POLICY IF EXISTS "runtime_events_anon_deny"                 ON runtime_events';
    EXECUTE 'DROP POLICY IF EXISTS "service_role_all_runtime_events"          ON runtime_events';

    -- Authenticated users: can only see their own org's events.
    -- NULLIF guard: if org_id claim is missing/null, coerce to empty string
    -- to prevent null = null evaluating to true (which would expose all rows).
    EXECUTE $p$
      CREATE POLICY "runtime_events_org_isolation"
        ON runtime_events
        FOR ALL
        TO authenticated
        USING (
          org_id = NULLIF(
            (current_setting('request.jwt.claims', true)::jsonb ->> 'org_id'),
            ''
          )
        )
    $p$;

    -- Anon: explicit deny
    EXECUTE $p$
      CREATE POLICY "runtime_events_anon_deny"
        ON runtime_events
        FOR ALL
        TO anon
        USING (false)
        WITH CHECK (false)
    $p$;

    RAISE NOTICE 'runtime_events RLS hardened: org isolation enforced with null guard.';

  ELSE
    RAISE NOTICE 'Table runtime_events does not exist yet — skipping.';
  END IF;
END $$;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY['learning_events', 'runtime_events'];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public' AND tablename = tbl AND rowsecurity = true
    ) THEN
      RAISE NOTICE 'RLS confirmed ON: %', tbl;
    ELSE
      RAISE NOTICE 'WARNING: RLS not confirmed on: % (table may not exist yet)', tbl;
    END IF;
  END LOOP;
END $$;

-- =============================================================================
-- ROLLBACK NOTES (run manually if needed):
--   -- Restore permissive learning_events read (INSECURE — only for rollback):
--   DROP POLICY IF EXISTS "learning_events_authenticated_deny" ON learning_events;
--   CREATE POLICY "learning_events_authenticated_select"
--     ON learning_events FOR SELECT TO authenticated USING (true);
--
--   -- Restore original runtime_events policy (without null guard):
--   DROP POLICY IF EXISTS "runtime_events_org_isolation" ON runtime_events;
--   CREATE POLICY "runtime_events_org_isolation"
--     ON runtime_events FOR ALL
--     USING (org_id = current_setting('request.jwt.claims', true)::jsonb->>'org_id');
-- =============================================================================

SELECT '20260520000005_fix_permissive_rls applied' AS status;
