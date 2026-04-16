-- =============================================================================
-- Migration 20260416_002 — RLS Hardening: all tables missing RLS
-- 2026-04-16
--
-- Tables audited from Supabase UI as "SEM RESTRIÇÕES" (no RLS).
-- Cross-referenced against migration files for real table names.
--
-- Policy patterns used:
--   service_only  — internal backend tables (CRM, automation, logs, risk signals)
--                   service_role bypasses RLS by default; policy is belt+suspenders
--   anon_insert   — public form submission tables (public_saved_searches, nurture_log)
--                   anon INSERT already GRANTED; RLS enabled with permissive policy
--   public_read   — no tables in this schema qualify (all auth-gated or backend-only)
--
-- Tables intentionally left with RLS DISABLED (by earlier migrations, correct):
--   public_saved_searches  — anon INSERT for buyer alert sign-ups (036_)
--   nurture_log            — service_role only via GRANT (037_)
--   property_alert_sent    — service_role only via GRANT (040_)
--
-- RUN IN: Supabase Dashboard → SQL Editor
-- =============================================================================

-- ─── 1. agent_daily_discipline ───────────────────────────────────────────────
-- Created in 20260413_019_call_tracking.sql — no RLS added there
ALTER TABLE agent_daily_discipline ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_daily_discipline_service_only" ON agent_daily_discipline;
CREATE POLICY "agent_daily_discipline_service_only" ON agent_daily_discipline
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── 2. market_price_refs ────────────────────────────────────────────────────
-- RLS enabled in 20260412_009_ but no policy was created — add it now
DROP POLICY IF EXISTS "market_price_refs_service_only" ON market_price_refs;
CREATE POLICY "market_price_refs_service_only" ON market_price_refs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── 3. push_tokens ──────────────────────────────────────────────────────────
-- RLS enabled in 042_ but no policy created
DROP POLICY IF EXISTS "push_tokens_service_only" ON push_tokens;
CREATE POLICY "push_tokens_service_only" ON push_tokens
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── 4. push_subscriptions ───────────────────────────────────────────────────
-- RLS enabled in 042_ but no policy created
DROP POLICY IF EXISTS "push_subscriptions_service_only" ON push_subscriptions;
CREATE POLICY "push_subscriptions_service_only" ON push_subscriptions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── 5. users ────────────────────────────────────────────────────────────────
-- Internal app users table (NOT auth.users) — RLS enabled in 042_ but no policy
DROP POLICY IF EXISTS "users_service_only" ON users;
CREATE POLICY "users_service_only" ON users
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── 6. offmarket_risk_flags ─────────────────────────────────────────────────
-- "sinalizadores_de_risco" in PT UI — RLS enabled in 042_ but no policy
DROP POLICY IF EXISTS "offmarket_risk_flags_service_only" ON offmarket_risk_flags;
CREATE POLICY "offmarket_risk_flags_service_only" ON offmarket_risk_flags
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── 7. investment_alerts ────────────────────────────────────────────────────
-- RLS enabled in 042_ and 20260415_020_ but no policy created
DROP POLICY IF EXISTS "investment_alerts_service_only" ON investment_alerts;
CREATE POLICY "investment_alerts_service_only" ON investment_alerts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── 8. visitas ──────────────────────────────────────────────────────────────
-- RLS enabled in 042_ and 20260415_020_ but no policy created
DROP POLICY IF EXISTS "visitas_service_only" ON visitas;
CREATE POLICY "visitas_service_only" ON visitas
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── 9. agents ───────────────────────────────────────────────────────────────
-- RLS enabled in 20260415_020_ but no policy created
DROP POLICY IF EXISTS "agents_service_only" ON agents;
CREATE POLICY "agents_service_only" ON agents
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── 10. crm_tasks ───────────────────────────────────────────────────────────
-- RLS enabled in 20260407_crm_agent_tables.sql but no policy created
DROP POLICY IF EXISTS "crm_tasks_service_only" ON crm_tasks;
CREATE POLICY "crm_tasks_service_only" ON crm_tasks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── 11. crm_followups ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "crm_followups_service_only" ON crm_followups;
CREATE POLICY "crm_followups_service_only" ON crm_followups
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── 12. deal_stage_history ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "deal_stage_history_service_only" ON deal_stage_history;
CREATE POLICY "deal_stage_history_service_only" ON deal_stage_history
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── 13. used_magic_tokens ───────────────────────────────────────────────────
-- RLS enabled in 20260408_001_ but no policy
DROP POLICY IF EXISTS "used_magic_tokens_service_only" ON used_magic_tokens;
CREATE POLICY "used_magic_tokens_service_only" ON used_magic_tokens
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── 14. sofia_memory ────────────────────────────────────────────────────────
-- RLS enabled in 20260407_sofia_memory.sql but no policy
DROP POLICY IF EXISTS "sofia_memory_service_only" ON sofia_memory;
CREATE POLICY "sofia_memory_service_only" ON sofia_memory
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── 15. market_data ─────────────────────────────────────────────────────────
-- Created in 001_initial_schema.sql; no RLS statement found
ALTER TABLE market_data ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "market_data_service_only" ON market_data;
CREATE POLICY "market_data_service_only" ON market_data
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── 16. market_properties ───────────────────────────────────────────────────
-- Created in 001_initial_schema.sql; no RLS found
ALTER TABLE market_properties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "market_properties_service_only" ON market_properties;
CREATE POLICY "market_properties_service_only" ON market_properties
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── 17. email_sequences ─────────────────────────────────────────────────────
-- Created in 001_initial_schema.sql; no RLS found
ALTER TABLE email_sequences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "email_sequences_service_only" ON email_sequences;
CREATE POLICY "email_sequences_service_only" ON email_sequences
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── 18. institutional_partners ──────────────────────────────────────────────
-- RLS enabled in 20260412_002_ but no policy created
DROP POLICY IF EXISTS "institutional_partners_service_only" ON institutional_partners;
CREATE POLICY "institutional_partners_service_only" ON institutional_partners
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── 19. premarket_interest ──────────────────────────────────────────────────
-- RLS enabled in 20260406_ but no policy created
DROP POLICY IF EXISTS "premarket_interest_service_only" ON premarket_interest;
CREATE POLICY "premarket_interest_service_only" ON premarket_interest
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── 20. property_alert_sent ─────────────────────────────────────────────────
-- RLS deliberately not enabled in 040_ (GRANT-based). Enable + service policy.
ALTER TABLE property_alert_sent ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "property_alert_sent_service_only" ON property_alert_sent;
CREATE POLICY "property_alert_sent_service_only" ON property_alert_sent
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── 21. nurture_log — harden via RLS while preserving GRANT behaviour ────────
-- 037_ intentionally disabled RLS. Enable it with permissive policies matching
-- the existing GRANT pattern (service_role full, authenticated+anon INSERT/SELECT).
ALTER TABLE nurture_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nurture_log_service_full" ON nurture_log;
CREATE POLICY "nurture_log_service_full" ON nurture_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "nurture_log_auth_read_insert" ON nurture_log;
CREATE POLICY "nurture_log_auth_read_insert" ON nurture_log
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── 22. public_saved_searches — keep anon INSERT, add RLS ───────────────────
-- 036_ explicitly disabled RLS for anonymous inserts. We re-enable it with a
-- permissive anon INSERT policy so the buyer alert form keeps working.
ALTER TABLE public_saved_searches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pss_anon_insert" ON public_saved_searches;
CREATE POLICY "pss_anon_insert" ON public_saved_searches
  FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "pss_service_full" ON public_saved_searches;
CREATE POLICY "pss_service_full" ON public_saved_searches
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── Verify ──────────────────────────────────────────────────────────────────
-- After running:
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public' AND rowsecurity = false
-- ORDER BY tablename;
-- Expected: 0 rows (all tables have RLS enabled)
