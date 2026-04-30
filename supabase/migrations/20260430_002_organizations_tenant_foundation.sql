-- =============================================================================
-- Agency Group · Migration 20260430_002
-- Organizations Table + Tenant Foundation (SaaS Readiness Phase 1)
--
-- PURPOSE:
--   Establishes the multi-tenant data foundation for future SaaS capability.
--   Creates organizations table, adds nullable tenant_id to all tenant-owned
--   tables, backfills with default Agency Group org, and prepares the RLS
--   policy stubs that will be activated once JWT includes tenant_id.
--
-- SAFETY:
--   - ALL tenant_id columns are NULLABLE (no existing data is broken)
--   - RLS tenant enforcement NOT activated here (requires JWT customization first)
--   - Backfill is additive only
--   - Rollback: drop the organizations table and tenant_id columns
--
-- NEXT STEP (manual, after JWT is configured):
--   1. In Supabase Dashboard → Auth → Hooks → Add custom JWT claim:
--      tenant_id: select org_id from org_members where user_id = auth.uid()
--   2. Run migration 20260430_005_tenant_rls_enforcement.sql (not yet created)
--   3. Remove the feature flag TENANT_ISOLATION_ENABLED=false
--
-- BLOCKING REASON (do not enforce before JWT is ready):
--   Using 'USING (tenant_id = (auth.jwt()->>'tenant_id')::uuid)' before JWT
--   includes tenant_id would return empty result sets for all authenticated
--   queries — a silent data loss scenario.
-- =============================================================================

-- ── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- ORGANIZATIONS TABLE
-- Root entity for multi-tenant isolation
-- =============================================================================

CREATE TABLE IF NOT EXISTS organizations (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT         NOT NULL UNIQUE,         -- url-safe identifier
  name         TEXT         NOT NULL,
  ami_number   TEXT,                                  -- Portuguese real estate license
  plan         TEXT         NOT NULL DEFAULT 'solo'
               CHECK (plan IN ('solo','team','agency','enterprise')),
  max_agents   SMALLINT     DEFAULT 5,
  status       TEXT         NOT NULL DEFAULT 'active'
               CHECK (status IN ('active','suspended','trial','churned')),
  -- Contact
  email        TEXT,
  phone        TEXT,
  address      TEXT,
  country      TEXT         DEFAULT 'PT',
  -- Metadata
  settings     JSONB        NOT NULL DEFAULT '{}',   -- org-level config overrides
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE organizations IS
  'Root tenant entity. Each row represents one brokerage using the platform.';

-- ── Default Agency Group organization ────────────────────────────────────────
INSERT INTO organizations (id, slug, name, ami_number, plan, max_agents)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'agency-group',
  'Agency Group',
  '22506',
  'agency',
  50
)
ON CONFLICT (slug) DO NOTHING;

-- ── Auto-update updated_at ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_organizations_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_organizations_updated_at ON organizations;
CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_organizations_updated_at();

-- =============================================================================
-- ORG_MEMBERS — Agent ↔ Organization mapping
-- =============================================================================

CREATE TABLE IF NOT EXISTS org_members (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id      UUID,        -- Supabase auth.uid() (nullable for email-only agents)
  email        TEXT         NOT NULL,
  role         TEXT         NOT NULL DEFAULT 'agent'
               CHECK (role IN ('owner','admin','agent','viewer')),
  status       TEXT         NOT NULL DEFAULT 'active'
               CHECK (status IN ('active','suspended','invited','removed')),
  invited_at   TIMESTAMPTZ,
  joined_at    TIMESTAMPTZ  DEFAULT NOW(),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_members_org_email
  ON org_members(org_id, email);

CREATE INDEX IF NOT EXISTS idx_org_members_email
  ON org_members(email);

CREATE INDEX IF NOT EXISTS idx_org_members_user_id
  ON org_members(user_id) WHERE user_id IS NOT NULL;

COMMENT ON TABLE org_members IS
  'Maps authenticated users (agents) to their organization. One user may belong to one org.';

-- ── RLS on organizations ──────────────────────────────────────────────────────
ALTER TABLE organizations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members     ENABLE ROW LEVEL SECURITY;

-- Service role bypass
CREATE POLICY "orgs_service_role"
  ON organizations FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "org_members_service_role"
  ON org_members FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated: see their own org
CREATE POLICY "orgs_agent_read"
  ON organizations FOR SELECT TO authenticated
  USING (
    id IN (SELECT org_id FROM org_members WHERE email = auth.email())
  );

CREATE POLICY "org_members_agent_read"
  ON org_members FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT org_id FROM org_members WHERE email = auth.email())
  );

-- =============================================================================
-- ADD tenant_id TO ALL TENANT-OWNED TABLES (NULLABLE — safe, no enforcement yet)
-- =============================================================================

-- ── contacts ─────────────────────────────────────────────────────────────────
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_tenant_id
  ON contacts(tenant_id) WHERE tenant_id IS NOT NULL;

-- ── deals ─────────────────────────────────────────────────────────────────────
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_deals_tenant_id
  ON deals(tenant_id) WHERE tenant_id IS NOT NULL;

-- ── properties ────────────────────────────────────────────────────────────────
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_properties_tenant_id
  ON properties(tenant_id) WHERE tenant_id IS NOT NULL;

-- ── deal_packs ────────────────────────────────────────────────────────────────
ALTER TABLE deal_packs
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_deal_packs_tenant_id
  ON deal_packs(tenant_id) WHERE tenant_id IS NOT NULL;

-- ── matches ───────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'matches') THEN
    EXECUTE 'ALTER TABLE matches ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id) ON DELETE SET NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_matches_tenant_id ON matches(tenant_id) WHERE tenant_id IS NOT NULL';
  END IF;
END $$;

-- ── priority_items ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'priority_items') THEN
    EXECUTE 'ALTER TABLE priority_items ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id) ON DELETE SET NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_priority_items_tenant_id ON priority_items(tenant_id) WHERE tenant_id IS NOT NULL';
  END IF;
END $$;

-- ── learning_events ───────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'learning_events') THEN
    EXECUTE 'ALTER TABLE learning_events ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id) ON DELETE SET NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_learning_events_tenant_id ON learning_events(tenant_id) WHERE tenant_id IS NOT NULL';
  END IF;
END $$;

-- ── offmarket_leads ───────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'offmarket_leads') THEN
    EXECUTE 'ALTER TABLE offmarket_leads ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id) ON DELETE SET NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_offmarket_leads_tenant_id ON offmarket_leads(tenant_id) WHERE tenant_id IS NOT NULL';
  END IF;
END $$;

-- =============================================================================
-- BACKFILL — Assign all existing data to the default Agency Group org
-- =============================================================================

-- Safe: only updates NULL tenant_id rows, no data modification beyond that
UPDATE contacts      SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE deals         SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE properties    SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE deal_packs    SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;

-- Conditional backfill for optional tables
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'matches') THEN
    EXECUTE 'UPDATE matches SET tenant_id = ''00000000-0000-0000-0000-000000000001'' WHERE tenant_id IS NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'priority_items') THEN
    EXECUTE 'UPDATE priority_items SET tenant_id = ''00000000-0000-0000-0000-000000000001'' WHERE tenant_id IS NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'learning_events') THEN
    EXECUTE 'UPDATE learning_events SET tenant_id = ''00000000-0000-0000-0000-000000000001'' WHERE tenant_id IS NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'offmarket_leads') THEN
    EXECUTE 'UPDATE offmarket_leads SET tenant_id = ''00000000-0000-0000-0000-000000000001'' WHERE tenant_id IS NULL';
  END IF;
END $$;

-- ── Add Agency Group staff as org members ─────────────────────────────────────
-- NOTE: Replace email with actual agent emails before running
INSERT INTO org_members (org_id, email, role)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin@agencygroup.pt',
  'owner'
)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- FEATURE FLAG VIEW — check if tenant isolation enforcement is safe to enable
-- =============================================================================

CREATE OR REPLACE VIEW v_tenant_isolation_readiness AS
SELECT
  'organizations'   AS check_item,
  (SELECT COUNT(*) FROM organizations) AS value,
  'organizations created' AS note
UNION ALL
SELECT
  'contacts_backfilled',
  (SELECT COUNT(*) FROM contacts WHERE tenant_id IS NOT NULL)::bigint,
  'contacts with tenant_id'
UNION ALL
SELECT
  'deals_backfilled',
  (SELECT COUNT(*) FROM deals WHERE tenant_id IS NOT NULL)::bigint,
  'deals with tenant_id'
UNION ALL
SELECT
  'properties_backfilled',
  (SELECT COUNT(*) FROM properties WHERE tenant_id IS NOT NULL)::bigint,
  'properties with tenant_id'
UNION ALL
SELECT
  'contacts_missing_tenant',
  (SELECT COUNT(*) FROM contacts WHERE tenant_id IS NULL)::bigint,
  'WARNING: must be 0 before enabling RLS enforcement'
UNION ALL
SELECT
  'deals_missing_tenant',
  (SELECT COUNT(*) FROM deals WHERE tenant_id IS NULL)::bigint,
  'WARNING: must be 0 before enabling RLS enforcement';

-- =============================================================================
-- HELPER FUNCTION — get tenant_id from agent email
-- =============================================================================

CREATE OR REPLACE FUNCTION get_tenant_id_for_email(p_email TEXT)
RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT org_id FROM org_members WHERE email = p_email LIMIT 1;
$$;

COMMENT ON FUNCTION get_tenant_id_for_email IS
  'Returns the organization UUID for a given agent email.
   Used by API routes to stamp tenant_id on new records.';

-- Done
SELECT 'tenant foundation installed — RLS enforcement PENDING JWT customization' AS status;
SELECT * FROM v_tenant_isolation_readiness;
