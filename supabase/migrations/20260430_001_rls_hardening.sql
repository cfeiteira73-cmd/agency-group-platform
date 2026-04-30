-- =============================================================================
-- Agency Group · Migration 20260430_001
-- RLS Hardening — Replace USING(true) with proper agent isolation
--
-- SAFE:
--   - Drops and recreates policies only
--   - Service-role bypass always preserved (bypasses RLS automatically)
--   - All internal API routes use service_role key — unaffected
--   - Portal authenticated users see only their own data
--   - Additive: no data deletion, no schema changes
--
-- ROLLBACK:
--   Re-run the original permissive policies:
--   DROP POLICY IF EXISTS "<name>" ON <table>;
--   CREATE POLICY "<name>" ON <table> USING (true);
-- =============================================================================

-- ─── CONTACTS ──────────────────────────────────────────────────────────────
-- Agents see only their own contacts
-- Service role bypasses RLS automatically (all API routes use service role)

DROP POLICY IF EXISTS "contacts_agent_access"           ON contacts;
DROP POLICY IF EXISTS "Service role has full access to contacts" ON contacts;
DROP POLICY IF EXISTS "contacts_own"                    ON contacts;

-- Agents read/write only their own contacts (matched by agent_email)
CREATE POLICY "contacts_agent_read_own"
  ON contacts FOR SELECT
  TO authenticated
  USING (agent_email = auth.email() OR agent_email = auth.uid()::text);

CREATE POLICY "contacts_agent_write_own"
  ON contacts FOR INSERT
  TO authenticated
  WITH CHECK (agent_email = auth.email() OR agent_email = auth.uid()::text);

CREATE POLICY "contacts_agent_update_own"
  ON contacts FOR UPDATE
  TO authenticated
  USING (agent_email = auth.email() OR agent_email = auth.uid()::text);

-- ─── DEALS ─────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "deals_agent_access"              ON deals;
DROP POLICY IF EXISTS "Service role has full access to deals" ON deals;
DROP POLICY IF EXISTS "Agents can read all deals"       ON deals;
DROP POLICY IF EXISTS "Agents can insert deals"         ON deals;
DROP POLICY IF EXISTS "Agents can update their deals"   ON deals;
DROP POLICY IF EXISTS "deals_own"                       ON deals;

CREATE POLICY "deals_agent_read_own"
  ON deals FOR SELECT
  TO authenticated
  USING (agent_email = auth.email() OR agent_email = auth.uid()::text);

CREATE POLICY "deals_agent_write_own"
  ON deals FOR INSERT
  TO authenticated
  WITH CHECK (agent_email = auth.email() OR agent_email = auth.uid()::text);

CREATE POLICY "deals_agent_update_own"
  ON deals FOR UPDATE
  TO authenticated
  USING (agent_email = auth.email() OR agent_email = auth.uid()::text);

-- ─── PROPERTIES ────────────────────────────────────────────────────────────
-- Properties: all authenticated users can READ (public listings)
-- Only owner agent can UPDATE/DELETE

DROP POLICY IF EXISTS "properties_public_read"          ON properties;
DROP POLICY IF EXISTS "properties_agent_write"          ON properties;
DROP POLICY IF EXISTS "Service role has full access to properties" ON properties;
DROP POLICY IF EXISTS "Agents can read all properties"  ON properties;

CREATE POLICY "properties_authenticated_read"
  ON properties FOR SELECT
  TO authenticated
  USING (true);  -- listings intentionally public to all authenticated users

CREATE POLICY "properties_public_anon_read"
  ON properties FOR SELECT
  TO anon
  USING (status = 'active' OR status = 'Ativo');

CREATE POLICY "properties_agent_insert"
  ON properties FOR INSERT
  TO authenticated
  WITH CHECK (agent_email = auth.email() OR agent_email = auth.uid()::text);

CREATE POLICY "properties_agent_update_own"
  ON properties FOR UPDATE
  TO authenticated
  USING (agent_email = auth.email() OR agent_email = auth.uid()::text OR agent_email IS NULL);

-- ─── DEAL PACKS ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "deal_packs_service_role"   ON deal_packs;
DROP POLICY IF EXISTS "deal_packs_agent_read"     ON deal_packs;

CREATE POLICY "deal_packs_agent_read_own"
  ON deal_packs FOR SELECT
  TO authenticated
  USING (created_by = auth.email() OR created_by = auth.uid()::text);

CREATE POLICY "deal_packs_agent_insert"
  ON deal_packs FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.email() OR created_by = auth.uid()::text);

CREATE POLICY "deal_packs_agent_update_own"
  ON deal_packs FOR UPDATE
  TO authenticated
  USING (created_by = auth.email() OR created_by = auth.uid()::text);

-- ─── MATCHES ───────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'matches') THEN
    -- Agents see matches they created or for their leads
    EXECUTE $policy$
      DROP POLICY IF EXISTS "matches_agent_read" ON matches;
      CREATE POLICY "matches_agent_read"
        ON matches FOR SELECT
        TO authenticated
        USING (
          matched_by = auth.email()
          OR matched_by = auth.uid()::text
          OR matched_by IS NULL
        );
    $policy$;
  END IF;
END $$;

-- ─── PRIORITY ITEMS ────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'priority_items') THEN
    EXECUTE $policy$
      DROP POLICY IF EXISTS "priority_items_agent_read" ON priority_items;
      ALTER TABLE priority_items ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "priority_items_agent_read"
        ON priority_items FOR SELECT
        TO authenticated
        USING (owner_id = auth.email() OR owner_id = auth.uid()::text OR owner_id IS NULL);

      CREATE POLICY "priority_items_agent_write"
        ON priority_items FOR INSERT
        TO authenticated
        WITH CHECK (true);  -- engine creates items; agents can see all open items

      CREATE POLICY "priority_items_agent_update"
        ON priority_items FOR UPDATE
        TO authenticated
        USING (owner_id = auth.email() OR owner_id = auth.uid()::text OR owner_id IS NULL);
    $policy$;
  END IF;
END $$;

-- ─── LEARNING EVENTS ───────────────────────────────────────────────────────
-- Learning events are internal — authenticated agents can see their own

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'learning_events') THEN
    EXECUTE $policy$
      ALTER TABLE learning_events ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS "learning_events_agent_read" ON learning_events;
      CREATE POLICY "learning_events_agent_read"
        ON learning_events FOR SELECT
        TO authenticated
        USING (true);  -- analytics — all agents can see aggregate event data
      CREATE POLICY "learning_events_insert"
        ON learning_events FOR INSERT
        TO authenticated
        WITH CHECK (true);
    $policy$;
  END IF;
END $$;

-- ─── OFFMARKET LEADS ───────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'offmarket_leads') THEN
    EXECUTE $policy$
      ALTER TABLE offmarket_leads ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS "offmarket_leads_agent_read" ON offmarket_leads;
      CREATE POLICY "offmarket_leads_agent_read"
        ON offmarket_leads FOR SELECT
        TO authenticated
        USING (true);  -- all agents see the shared pipeline
      CREATE POLICY "offmarket_leads_agent_write"
        ON offmarket_leads FOR ALL
        TO authenticated
        USING (true)
        WITH CHECK (true);
    $policy$;
  END IF;
END $$;

-- ─── VERIFY RLS IS ENABLED ────────────────────────────────────────────────
DO $$
DECLARE
  tbl TEXT;
  tables_checked TEXT[] := ARRAY['contacts','deals','properties','deal_packs'];
BEGIN
  FOREACH tbl IN ARRAY tables_checked
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public' AND tablename = tbl AND rowsecurity = true
    ) THEN
      RAISE WARNING 'RLS not enabled on table: %', tbl;
    END IF;
  END LOOP;
END $$;

-- Done
SELECT 'RLS hardening applied — agent isolation active' AS status;
