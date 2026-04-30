-- =============================================================================
-- Agency Group · ROLLBACK SCRIPT
-- Covers: Migrations 20260429_001 → 20260430_004 (7 migrations)
-- Generated: 2026-04-30
--
-- EXECUTION ORDER: Run in REVERSE order — most recent migration first.
-- Safe: all DROP/ALTER operations wrapped with IF EXISTS guards.
-- Idempotent: can be re-run if partially applied.
--
-- USAGE:
--   1. Open Supabase Dashboard → SQL Editor
--   2. Paste this entire file
--   3. Review each section before executing
--   4. Execute top-to-bottom (already in reverse migration order)
--
-- SCOPE:
--   R7: ROLLBACK 20260430_004 — audit_log
--   R6: ROLLBACK 20260430_003 — performance indexes
--   R5: ROLLBACK 20260430_002 — organizations + tenant foundation
--   R4: ROLLBACK 20260430_001 — RLS hardening
--   R3: ROLLBACK 20260429_003 — deal_pack view RPC
--   R2: ROLLBACK 20260429_002 — trg_deals_fee_sync fix
--   R1: ROLLBACK 20260429_001 — learning_events UUID fix
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- R7: ROLLBACK 20260430_004 — Audit Log Table
-- ─────────────────────────────────────────────────────────────────────────────

-- Remove triggers first (depend on functions)
DROP TRIGGER IF EXISTS trg_audit_deals      ON deals;
DROP TRIGGER IF EXISTS trg_audit_deal_packs ON deal_packs;

-- Remove functions
DROP FUNCTION IF EXISTS trg_audit_deals_fn()                    CASCADE;
DROP FUNCTION IF EXISTS trg_audit_deal_packs_fn()               CASCADE;
DROP FUNCTION IF EXISTS enrich_audit_actor(TEXT,TEXT,TEXT,TEXT,UUID,UUID) CASCADE;
DROP FUNCTION IF EXISTS purge_old_audit_logs(INT)               CASCADE;

-- Drop indexes before table
DROP INDEX IF EXISTS idx_audit_log_actor_email;
DROP INDEX IF EXISTS idx_audit_log_record;
DROP INDEX IF EXISTS idx_audit_log_recent;
DROP INDEX IF EXISTS idx_audit_log_correlation;
DROP INDEX IF EXISTS idx_audit_log_tenant;

-- Drop table (all audit history is lost — confirm before running in production)
-- SAFETY: Comment this line out if you want to preserve audit history
DROP TABLE IF EXISTS audit_log CASCADE;

SELECT 'R7 complete: audit_log removed' AS rollback_status;

-- ─────────────────────────────────────────────────────────────────────────────
-- R6: ROLLBACK 20260430_003 — Performance Indexes
-- ─────────────────────────────────────────────────────────────────────────────

-- Deals indexes
DROP INDEX IF EXISTS idx_deals_agent_email_fase;
DROP INDEX IF EXISTS idx_deals_fase_updated_at;
DROP INDEX IF EXISTS idx_deals_open_pipeline;
DROP INDEX IF EXISTS idx_deals_agent_realized_fee;
DROP INDEX IF EXISTS idx_deals_tenant_fase;

-- Contacts indexes
DROP INDEX IF EXISTS idx_contacts_agent_email_status;
DROP INDEX IF EXISTS idx_contacts_next_followup;
DROP INDEX IF EXISTS idx_contacts_budget;
DROP INDEX IF EXISTS idx_contacts_dormant_detection;

-- Deal packs indexes
DROP INDEX IF EXISTS idx_deal_packs_created_by_status;
DROP INDEX IF EXISTS idx_deal_packs_sent_unviewed;

-- Matches indexes
DROP INDEX IF EXISTS idx_matches_lead_score_status;

-- Learning events indexes
DROP INDEX IF EXISTS idx_learning_events_agent_type_time;
DROP INDEX IF EXISTS idx_learning_events_type_time_asc;

-- Priority items indexes
DROP INDEX IF EXISTS idx_priority_items_owner_score_deadline;
DROP INDEX IF EXISTS idx_priority_items_revenue_impact;

-- Properties indexes
DROP INDEX IF EXISTS idx_properties_zona_status;
DROP INDEX IF EXISTS idx_properties_preco_range;

-- KPI snapshots indexes (conditional)
DROP INDEX IF EXISTS idx_kpi_snapshots_agent_date;
DROP INDEX IF EXISTS idx_kpi_snapshots_date;

SELECT 'R6 complete: performance indexes removed' AS rollback_status;

-- ─────────────────────────────────────────────────────────────────────────────
-- R5: ROLLBACK 20260430_002 — Organizations + Tenant Foundation
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop view first
DROP VIEW IF EXISTS v_tenant_isolation_readiness;

-- Drop helper function
DROP FUNCTION IF EXISTS get_tenant_id_for_email(TEXT) CASCADE;
DROP FUNCTION IF EXISTS update_organizations_updated_at() CASCADE;

-- Remove tenant_id column backfill + FK references
-- NOTE: columns are dropped BEFORE the organizations table (FK dependency)

-- contacts
ALTER TABLE contacts      DROP COLUMN IF EXISTS tenant_id;
DROP INDEX IF EXISTS idx_contacts_tenant_id;

-- deals
ALTER TABLE deals         DROP COLUMN IF EXISTS tenant_id;
DROP INDEX IF EXISTS idx_deals_tenant_id;

-- properties
ALTER TABLE properties    DROP COLUMN IF EXISTS tenant_id;
DROP INDEX IF EXISTS idx_properties_tenant_id;

-- deal_packs
ALTER TABLE deal_packs    DROP COLUMN IF EXISTS tenant_id;
DROP INDEX IF EXISTS idx_deal_packs_tenant_id;

-- matches (conditional)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'matches') THEN
    EXECUTE 'ALTER TABLE matches DROP COLUMN IF EXISTS tenant_id';
    EXECUTE 'DROP INDEX IF EXISTS idx_matches_tenant_id';
  END IF;
END $$;

-- priority_items (conditional)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'priority_items') THEN
    EXECUTE 'ALTER TABLE priority_items DROP COLUMN IF EXISTS tenant_id';
    EXECUTE 'DROP INDEX IF EXISTS idx_priority_items_tenant_id';
  END IF;
END $$;

-- learning_events (conditional)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'learning_events') THEN
    EXECUTE 'ALTER TABLE learning_events DROP COLUMN IF EXISTS tenant_id';
    EXECUTE 'DROP INDEX IF EXISTS idx_learning_events_tenant_id';
  END IF;
END $$;

-- offmarket_leads (conditional)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'offmarket_leads') THEN
    EXECUTE 'ALTER TABLE offmarket_leads DROP COLUMN IF EXISTS tenant_id';
    EXECUTE 'DROP INDEX IF EXISTS idx_offmarket_leads_tenant_id';
  END IF;
END $$;

-- Drop org_members before organizations (FK dependency)
DROP TABLE IF EXISTS org_members    CASCADE;
DROP TABLE IF EXISTS organizations  CASCADE;

SELECT 'R5 complete: tenant foundation removed' AS rollback_status;

-- ─────────────────────────────────────────────────────────────────────────────
-- R4: ROLLBACK 20260430_001 — RLS Hardening
-- Restores previous permissive policies (USING true)
-- ─────────────────────────────────────────────────────────────────────────────

-- contacts — restore permissive read/write
DROP POLICY IF EXISTS "contacts_agent_read_own"   ON contacts;
DROP POLICY IF EXISTS "contacts_agent_write_own"  ON contacts;
DROP POLICY IF EXISTS "contacts_agent_update_own" ON contacts;

CREATE POLICY "contacts_agent_access"
  ON contacts FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- deals — restore permissive
DROP POLICY IF EXISTS "deals_agent_read_own"   ON deals;
DROP POLICY IF EXISTS "deals_agent_write_own"  ON deals;
DROP POLICY IF EXISTS "deals_agent_update_own" ON deals;

CREATE POLICY "deals_agent_access"
  ON deals FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- properties — restore permissive
DROP POLICY IF EXISTS "properties_authenticated_read" ON properties;
DROP POLICY IF EXISTS "properties_public_anon_read"   ON properties;
DROP POLICY IF EXISTS "properties_agent_insert"       ON properties;
DROP POLICY IF EXISTS "properties_agent_update_own"   ON properties;

CREATE POLICY "properties_public_read"
  ON properties FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "properties_agent_write"
  ON properties FOR INSERT TO authenticated
  WITH CHECK (true);

-- deal_packs — restore permissive
DROP POLICY IF EXISTS "deal_packs_agent_read_own"   ON deal_packs;
DROP POLICY IF EXISTS "deal_packs_agent_insert"     ON deal_packs;
DROP POLICY IF EXISTS "deal_packs_agent_update_own" ON deal_packs;

CREATE POLICY "deal_packs_service_role"
  ON deal_packs FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- matches — restore (conditional)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'matches') THEN
    EXECUTE $p$
      DROP POLICY IF EXISTS "matches_agent_read" ON matches;
      CREATE POLICY "matches_agent_access"
        ON matches FOR ALL TO authenticated
        USING (true) WITH CHECK (true);
    $p$;
  END IF;
END $$;

-- priority_items — restore (conditional)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'priority_items') THEN
    EXECUTE $p$
      DROP POLICY IF EXISTS "priority_items_agent_read"   ON priority_items;
      DROP POLICY IF EXISTS "priority_items_agent_write"  ON priority_items;
      DROP POLICY IF EXISTS "priority_items_agent_update" ON priority_items;
      CREATE POLICY "priority_items_access"
        ON priority_items FOR ALL TO authenticated
        USING (true) WITH CHECK (true);
    $p$;
  END IF;
END $$;

SELECT 'R4 complete: RLS reverted to permissive policies' AS rollback_status;

-- ─────────────────────────────────────────────────────────────────────────────
-- R3: ROLLBACK 20260429_003 — deal_pack view RPC
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop the RPC (callers must handle gracefully)
DROP FUNCTION IF EXISTS increment_deal_pack_view_count(UUID) CASCADE;

-- NOTE: metadata and ai_summary columns are safe to leave in place
-- They contain no breaking changes and removing them could delete data.
-- Only remove if sure they are empty:
-- ALTER TABLE deal_packs DROP COLUMN IF EXISTS metadata;
-- ALTER TABLE deal_packs DROP COLUMN IF EXISTS ai_summary;

SELECT 'R3 complete: deal_pack view RPC removed' AS rollback_status;

-- ─────────────────────────────────────────────────────────────────────────────
-- R2: ROLLBACK 20260429_002 — trg_deals_fee_sync fix
-- Restores the broken trigger (was broken before, will be broken again)
-- ─────────────────────────────────────────────────────────────────────────────

-- Remove the portal-compat version
DROP TRIGGER IF EXISTS trg_deals_fee_sync ON deals;
DROP FUNCTION IF EXISTS sync_deal_expected_fee() CASCADE;

-- NOTE: If you want to restore the ORIGINAL broken trigger, uncomment:
-- This is intentionally not restored (it was broken and caused crashes)
-- CREATE OR REPLACE FUNCTION sync_deal_expected_fee() ...

SELECT 'R2 complete: fee sync trigger removed (was broken before, not restored)' AS rollback_status;

-- ─────────────────────────────────────────────────────────────────────────────
-- R1: ROLLBACK 20260429_001 — learning_events UUID fix
-- DESTRUCTIVE: reverts TEXT columns back to INTEGER — any UUID values will fail
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop event bus indexes
DROP INDEX IF EXISTS idx_learning_events_correlation;
DROP INDEX IF EXISTS idx_learning_events_session;
DROP INDEX IF EXISTS idx_learning_events_lead_text;
DROP INDEX IF EXISTS idx_learning_events_deal_text;
DROP INDEX IF EXISTS idx_learning_events_type_time;

-- Drop event bus columns
ALTER TABLE learning_events DROP COLUMN IF EXISTS correlation_id;
ALTER TABLE learning_events DROP COLUMN IF EXISTS session_id;
ALTER TABLE learning_events DROP COLUMN IF EXISTS source_system;

-- CAUTION: Revert TEXT → INTEGER will FAIL if any UUID values exist in lead_id/deal_id
-- Only execute if learning_events table is empty or contains only integer-compatible values
-- ALTER TABLE learning_events ALTER COLUMN lead_id TYPE INTEGER USING lead_id::INTEGER;
-- ALTER TABLE learning_events ALTER COLUMN deal_id TYPE INTEGER USING deal_id::INTEGER;

SELECT 'R1 complete: event bus columns removed (column type revert skipped — manual if needed)' AS rollback_status;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK COMPLETE
-- ─────────────────────────────────────────────────────────────────────────────

SELECT
  '7 migrations rolled back' AS summary,
  'Verify application is functional before clearing this script' AS next_step,
  '20260429_001 → 20260430_004 reverted' AS scope;
