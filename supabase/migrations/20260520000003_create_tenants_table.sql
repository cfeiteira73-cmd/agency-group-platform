-- =============================================================================
-- Agency Group — Migration: tenants table
-- 20260520000003_create_tenants_table.sql
--
-- Required by:
--   - fetchActiveTenants() in app/control-tower/ceo/page.tsx
--   - mv_tenant_graph_stats materialized view (JOIN tenants t)
--   - lib/graph/materializedViews.ts
--
-- Without this table, fetchActiveTenants() always falls back to hardcoded "1".
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.tenants (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT        NOT NULL UNIQUE,
  name        TEXT        NOT NULL,
  plan        TEXT        NOT NULL DEFAULT 'starter',
  org_id      TEXT        NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug   ON public.tenants (slug);
CREATE INDEX IF NOT EXISTS idx_tenants_org_id ON public.tenants (org_id);

-- Seed the default Agency Group tenant
INSERT INTO public.tenants (slug, name, plan, org_id)
VALUES ('agency-group', 'Agency Group', 'enterprise', 'agency-group')
ON CONFLICT (org_id) DO NOTHING;

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tenants'
      AND policyname = 'service_role_all_tenants'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "service_role_all_tenants"
        ON public.tenants FOR ALL TO service_role
        USING (true) WITH CHECK (true)
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tenants'
      AND policyname = 'authenticated_read_tenants'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "authenticated_read_tenants"
        ON public.tenants FOR SELECT TO authenticated
        USING (true)
    $policy$;
  END IF;
END
$$;

SELECT '20260520000003: tenants table created with Agency Group seed' AS status;
