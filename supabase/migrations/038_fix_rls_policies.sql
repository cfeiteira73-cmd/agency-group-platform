-- =============================================================================
-- Migration 038 — Fix RLS: remove OR true bypass on contacts, deals, properties
-- 2026-04-15
--
-- Context: schema.sql had `USING (agent_email = current_user OR true)` which
-- renders RLS completely ineffective — any anon user with the public key can
-- read/write all rows. Service role bypasses RLS entirely (correct behaviour),
-- so these fixes protect against direct anon key access.
--
-- Pattern: contacts + deals are internal CRM tables — no anon access.
--          properties: public SELECT allowed (listings page), all writes
--          require authenticated role (portal agents).
--
-- RUN IN: Supabase Dashboard → SQL Editor
-- =============================================================================

-- ─── 1. contacts ─────────────────────────────────────────────────────────────
-- Drop old permissive policy
DROP POLICY IF EXISTS "contacts_agent_access" ON contacts;

-- Service role bypasses RLS by default — no explicit policy needed for server.
-- Deny all anon/authenticated access at row level; API layer uses service_role.
CREATE POLICY "contacts_service_only" ON contacts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── 2. deals ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "deals_agent_access" ON deals;

CREATE POLICY "deals_service_only" ON deals
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── 3. properties ───────────────────────────────────────────────────────────
-- Keep public read (listings are intentionally public)
DROP POLICY IF EXISTS "properties_public_read" ON properties;
DROP POLICY IF EXISTS "properties_agent_write" ON properties;

-- Public can read active/available listings only
CREATE POLICY "properties_public_read" ON properties
  FOR SELECT
  USING (status NOT IN ('off-market', 'archived'));

-- All writes require service_role (portal backend only)
CREATE POLICY "properties_service_write" ON properties
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── 4. Verify ───────────────────────────────────────────────────────────────
-- After running, check:
-- SELECT schemaname, tablename, policyname, roles, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename IN ('contacts','deals','properties');
