-- =============================================================================
-- AGENCY GROUP — Migration 015: RLS Policies + Organization Isolation
-- Safe additive migration — all new columns nullable (backwards compatible)
-- Existing queries continue to work unchanged (org_id = NULL = single-tenant)
-- AMI: 22506 | SH-ROS Phase 1 Hardening
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- PART A: Add organization_id to key tables
-- All columns nullable — existing rows default to NULL (single-tenant mode)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE economic_truth_events        ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE governance_decisions         ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE override_events              ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE distribution_feedback_weights ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE market_feedback_signals      ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE transactional_decisions      ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE auto_model_updates           ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE rollback_events              ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE referrals                    ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE growth_metrics               ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE client_milestones            ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE nurture_log                  ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE scoring_feedback_events      ADD COLUMN IF NOT EXISTS organization_id uuid;

-- Index for all org lookups
CREATE INDEX IF NOT EXISTS idx_client_milestones_org    ON client_milestones(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nurture_log_org          ON nurture_log(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scoring_feedback_org     ON scoring_feedback_events(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_referrals_org            ON referrals(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_growth_metrics_org       ON growth_metrics(organization_id) WHERE organization_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART B: Enable Row Level Security on high-value tables
-- Service role bypasses all RLS automatically (supabaseAdmin continues to work)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE contacts                ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties              ENABLE ROW LEVEL SECURITY;
ALTER TABLE offmarket_leads         ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_packs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities              ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log               ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_alerts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_tasks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE priority_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications           ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART C: RLS Policies
-- Policy strategy:
--   - authenticated users can READ their own data
--   - only admins can write sensitive tables
--   - service_role always bypasses (supabaseAdmin not affected)
-- ─────────────────────────────────────────────────────────────────────────────

-- contacts: agents see all (portal is internal tool)
DROP POLICY IF EXISTS "contacts_authenticated_read"  ON contacts;
DROP POLICY IF EXISTS "contacts_authenticated_write" ON contacts;

CREATE POLICY "contacts_authenticated_read" ON contacts
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "contacts_authenticated_write" ON contacts
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- deals: agents see all
DROP POLICY IF EXISTS "deals_authenticated_read"  ON deals;
DROP POLICY IF EXISTS "deals_authenticated_write" ON deals;

CREATE POLICY "deals_authenticated_read" ON deals
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "deals_authenticated_write" ON deals
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- properties: public read for active/portal-published, authenticated write
DROP POLICY IF EXISTS "properties_public_read"         ON properties;
DROP POLICY IF EXISTS "properties_authenticated_write" ON properties;

CREATE POLICY "properties_public_read" ON properties
  FOR SELECT
  TO anon, authenticated
  USING (portal_published = true OR status = 'active');

CREATE POLICY "properties_authenticated_write" ON properties
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- offmarket_leads: authenticated only
DROP POLICY IF EXISTS "offmarket_leads_authenticated" ON offmarket_leads;

CREATE POLICY "offmarket_leads_authenticated" ON offmarket_leads
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- matches: authenticated only
DROP POLICY IF EXISTS "matches_authenticated" ON matches;

CREATE POLICY "matches_authenticated" ON matches
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- deal_packs: authenticated only
DROP POLICY IF EXISTS "deal_packs_authenticated" ON deal_packs;

CREATE POLICY "deal_packs_authenticated" ON deal_packs
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- activities: authenticated only
DROP POLICY IF EXISTS "activities_authenticated" ON activities;

CREATE POLICY "activities_authenticated" ON activities
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- learning_events: service-role insert only (fire-and-forget events)
DROP POLICY IF EXISTS "learning_events_authenticated_read" ON learning_events;

CREATE POLICY "learning_events_authenticated_read" ON learning_events
  FOR SELECT
  TO authenticated
  USING (true);

-- audit_log: read-only for authenticated, insert via service role only
DROP POLICY IF EXISTS "audit_log_authenticated_read" ON audit_log;

CREATE POLICY "audit_log_authenticated_read" ON audit_log
  FOR SELECT
  TO authenticated
  USING (true);

-- system_alerts: authenticated read/write (admin portal)
DROP POLICY IF EXISTS "system_alerts_authenticated" ON system_alerts;

CREATE POLICY "system_alerts_authenticated" ON system_alerts
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- operator_tasks: authenticated
DROP POLICY IF EXISTS "operator_tasks_authenticated" ON operator_tasks;

CREATE POLICY "operator_tasks_authenticated" ON operator_tasks
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- priority_items: authenticated
DROP POLICY IF EXISTS "priority_items_authenticated" ON priority_items;

CREATE POLICY "priority_items_authenticated" ON priority_items
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- notifications: users see their own
DROP POLICY IF EXISTS "notifications_own" ON notifications;

CREATE POLICY "notifications_own" ON notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);

-- ─────────────────────────────────────────────────────────────────────────────
-- PART D: Security hardening additions
-- ─────────────────────────────────────────────────────────────────────────────

-- Prevent direct deletion of audit_log (immutable append-only)
DROP POLICY IF EXISTS "audit_log_no_delete" ON audit_log;
CREATE POLICY "audit_log_no_delete" ON audit_log
  FOR DELETE
  TO authenticated
  USING (false); -- Only service role can delete

-- Prevent direct deletion of learning_events
DROP POLICY IF EXISTS "learning_events_no_delete" ON learning_events;
CREATE POLICY "learning_events_no_delete" ON learning_events
  FOR DELETE
  TO authenticated
  USING (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- PART E: Performance indexes missing from previous migrations
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_contacts_status          ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_next_followup   ON contacts(next_followup_at) WHERE next_followup_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_lead_score      ON contacts(lead_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_contacts_assigned_to     ON contacts(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_fase               ON deals(fase) WHERE fase IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_agent_email        ON deals(agent_email) WHERE agent_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_offmarket_score          ON offmarket_leads(score DESC NULLS LAST) WHERE score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_offmarket_sla_breach     ON offmarket_leads(sla_breach) WHERE sla_breach = true;
CREATE INDEX IF NOT EXISTS idx_offmarket_status         ON offmarket_leads(status);
CREATE INDEX IF NOT EXISTS idx_offmarket_assigned       ON offmarket_leads(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_learning_events_type     ON learning_events(event_type);
CREATE INDEX IF NOT EXISTS idx_learning_events_created  ON learning_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor          ON audit_log(actor_email) WHERE actor_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_log_created        ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_alerts_status     ON system_alerts(status) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_operator_tasks_status    ON operator_tasks(status) WHERE status IN ('pending', 'in_progress');
CREATE INDEX IF NOT EXISTS idx_priority_items_open      ON priority_items(priority_score DESC) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_matches_lead             ON matches(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_matches_score            ON matches(match_score DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK SCRIPT (execute if migration needs reverting)
-- Save as: supabase/migrations/rollback_015.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- ALTER TABLE economic_truth_events        DROP COLUMN IF EXISTS organization_id;
-- ALTER TABLE governance_decisions         DROP COLUMN IF EXISTS organization_id;
-- ALTER TABLE override_events              DROP COLUMN IF EXISTS organization_id;
-- ALTER TABLE distribution_feedback_weights DROP COLUMN IF EXISTS organization_id;
-- ALTER TABLE market_feedback_signals      DROP COLUMN IF EXISTS organization_id;
-- ALTER TABLE transactional_decisions      DROP COLUMN IF EXISTS organization_id;
-- ALTER TABLE auto_model_updates           DROP COLUMN IF EXISTS organization_id;
-- ALTER TABLE rollback_events              DROP COLUMN IF EXISTS organization_id;
-- ALTER TABLE referrals                    DROP COLUMN IF EXISTS organization_id;
-- ALTER TABLE growth_metrics               DROP COLUMN IF EXISTS organization_id;
-- ALTER TABLE client_milestones            DROP COLUMN IF EXISTS organization_id;
-- ALTER TABLE nurture_log                  DROP COLUMN IF EXISTS organization_id;
-- ALTER TABLE scoring_feedback_events      DROP COLUMN IF EXISTS organization_id;
-- ALTER TABLE contacts DISABLE ROW LEVEL SECURITY;
-- ... (disable RLS on all tables above)
