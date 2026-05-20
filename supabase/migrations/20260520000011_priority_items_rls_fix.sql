-- =============================================================================
-- Migration: 20260520000011_priority_items_rls_fix
-- Purpose: Replace broken org_id-based RLS with correct tenant_id-based policies
-- Background: Migration 20260520000009 added tenant_id to priority_items.
--             The old policies referenced org_id (non-existent column).
--             service_role (supabaseAdmin) bypasses RLS — app-level isolation
--             remains the primary defence. These policies protect direct
--             authenticated client access.
-- =============================================================================

-- Drop stale org_id-based policies
drop policy if exists priority_items_select on priority_items;
drop policy if exists priority_items_insert on priority_items;
drop policy if exists priority_items_update on priority_items;
drop policy if exists priority_items_delete on priority_items;

-- SELECT: tenant members only
create policy priority_items_select on priority_items
  for select to authenticated
  using (
    tenant_id in (
      select org_id from org_members where email = auth.email()
    )
  );

-- INSERT: enforce tenant_id matches caller's org
create policy priority_items_insert on priority_items
  for insert to authenticated
  with check (
    tenant_id in (
      select org_id from org_members where email = auth.email()
    )
  );

-- UPDATE: tenant members only
create policy priority_items_update on priority_items
  for update to authenticated
  using (
    tenant_id in (
      select org_id from org_members where email = auth.email()
    )
  );

-- DELETE: tenant members only
create policy priority_items_delete on priority_items
  for delete to authenticated
  using (
    tenant_id in (
      select org_id from org_members where email = auth.email()
    )
  );

-- service_role bypass (supabaseAdmin uses service_role — needs full access)
create policy priority_items_service_role on priority_items
  for all to service_role
  using (true)
  with check (true);
