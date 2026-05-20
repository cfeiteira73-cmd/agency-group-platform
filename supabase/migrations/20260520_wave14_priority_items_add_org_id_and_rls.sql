-- Wave 14: Add org_id column + RLS policies to priority_items
-- Applied via Supabase MCP on 2026-05-20 (Wave 14 Global Audit close)
-- Migration name in DB: priority_items_add_org_id_and_rls

ALTER TABLE public.priority_items
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id)
  DEFAULT '00000000-0000-0000-0000-000000000001';

ALTER TABLE public.priority_items ENABLE ROW LEVEL SECURITY;

-- Org members can read their org's priority items
CREATE POLICY IF NOT EXISTS "org_members_select" ON public.priority_items
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
    )
  );

-- Org members can insert priority items for their org
CREATE POLICY IF NOT EXISTS "org_members_insert" ON public.priority_items
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
    )
  );

-- Org members can update their org's priority items
CREATE POLICY IF NOT EXISTS "org_members_update" ON public.priority_items
  FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
    )
  );

-- Org members can delete their org's priority items
CREATE POLICY IF NOT EXISTS "org_members_delete" ON public.priority_items
  FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
    )
  );
