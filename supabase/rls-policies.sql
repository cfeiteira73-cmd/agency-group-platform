-- ============================================================
-- Agency Group — Row Level Security Policies
-- Apply via: Supabase Dashboard > SQL Editor, or `supabase db push`
-- ============================================================

-- Enable RLS on all application tables
ALTER TABLE public.users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitas    ENABLE ROW LEVEL SECURITY;

-- Drop existing policies before recreating (idempotent re-run)
DROP POLICY IF EXISTS "users_own_data"              ON public.users;
DROP POLICY IF EXISTS "properties_authenticated"    ON public.properties;
DROP POLICY IF EXISTS "properties_own_insert"       ON public.properties;
DROP POLICY IF EXISTS "deals_own"                   ON public.deals;
DROP POLICY IF EXISTS "contacts_own"                ON public.contacts;
DROP POLICY IF EXISTS "visitas_own"                 ON public.visitas;

-- ── users ────────────────────────────────────────────────────
-- Each user can read/write only their own row.
-- Admins are handled at the application layer (service-role key bypasses RLS).
CREATE POLICY "users_own_data" ON public.users
  FOR ALL
  USING (auth.uid()::text = id::text);

-- ── properties ───────────────────────────────────────────────
-- Any authenticated user can read active listings.
CREATE POLICY "properties_authenticated" ON public.properties
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Any authenticated user can insert a property (agent_id enforced in app layer).
CREATE POLICY "properties_own_insert" ON public.properties
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Only the owning agent (or an admin via service-role) can update/delete.
CREATE POLICY "properties_own_update" ON public.properties
  FOR UPDATE
  USING (agent_id::text = auth.uid()::text);

CREATE POLICY "properties_own_delete" ON public.properties
  FOR DELETE
  USING (agent_id::text = auth.uid()::text);

-- ── deals ────────────────────────────────────────────────────
-- Agents see only their own deals. Admins use the service-role key.
CREATE POLICY "deals_own" ON public.deals
  FOR ALL
  USING (agent_id::text = auth.uid()::text);

-- ── contacts ─────────────────────────────────────────────────
CREATE POLICY "contacts_own" ON public.contacts
  FOR ALL
  USING (agent_id::text = auth.uid()::text);

-- ── visitas ──────────────────────────────────────────────────
CREATE POLICY "visitas_own" ON public.visitas
  FOR ALL
  USING (agent_id::text = auth.uid()::text);

-- ============================================================
-- Verify after applying:
-- SELECT tablename, rowsecurity
-- FROM   pg_tables
-- WHERE  schemaname = 'public'
-- ORDER  BY tablename;
-- ============================================================
