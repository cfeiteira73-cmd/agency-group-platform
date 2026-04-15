-- =============================================================================
-- AGENCY GROUP — PENDING MIGRATIONS BATCH
-- Run all 3 in Supabase Dashboard → SQL Editor
-- Order: 038 → 039 → 040
-- Date: 2026-04-15
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION 038 — Fix RLS OR true bypass
-- CRITICAL security fix: removes policies that gave anon users full table access
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "contacts_agent_access" ON contacts;
DROP POLICY IF EXISTS "deals_agent_access" ON deals;
DROP POLICY IF EXISTS "properties_public_read" ON properties;
DROP POLICY IF EXISTS "properties_agent_write" ON properties;

CREATE POLICY "contacts_service_only" ON contacts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "deals_service_only" ON deals
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "properties_public_read" ON properties
  FOR SELECT USING (status NOT IN ('off-market', 'archived'));

CREATE POLICY "properties_service_write" ON properties
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION 039 — Email unique index + UTM tracking columns
-- Safe: IF NOT EXISTS guards throughout. No data loss.
-- NOTE: If unique index fails, you have duplicate emails. Run dedup query below.
-- ─────────────────────────────────────────────────────────────────────────────

-- OPTIONAL: check for duplicate emails first
-- SELECT email, COUNT(*) FROM contacts WHERE email IS NOT NULL GROUP BY email HAVING COUNT(*) > 1;
-- If duplicates found, run dedup:
-- DELETE FROM contacts WHERE id IN (
--   SELECT id FROM (
--     SELECT id, ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at DESC) AS rn
--     FROM contacts WHERE email IS NOT NULL
--   ) sub WHERE rn > 1
-- );

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_email_unique
  ON contacts(email)
  WHERE email IS NOT NULL;

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS utm_source   TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium   TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS utm_term     TEXT,
  ADD COLUMN IF NOT EXISTS utm_content  TEXT,
  ADD COLUMN IF NOT EXISTS utm_landing  TEXT;

CREATE INDEX IF NOT EXISTS idx_contacts_utm_source
  ON contacts(utm_source) WHERE utm_source IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_utm_campaign
  ON contacts(utm_campaign) WHERE utm_campaign IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION 040 — property_alert_sent dedup table
-- Required for n8n wf-Q alert deduplication
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.property_alert_sent (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT        NOT NULL,
  property_id TEXT        NOT NULL,
  zona        TEXT,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT property_alert_sent_unique UNIQUE (email, property_id)
);

CREATE INDEX IF NOT EXISTS idx_property_alert_email
  ON public.property_alert_sent (email);

CREATE INDEX IF NOT EXISTS idx_property_alert_property_id
  ON public.property_alert_sent (property_id);

CREATE INDEX IF NOT EXISTS idx_property_alert_sent_at
  ON public.property_alert_sent (sent_at DESC);

GRANT SELECT, INSERT ON public.property_alert_sent TO service_role;

-- =============================================================================
-- VERIFY ALL 3 MIGRATIONS
-- Run after the above to confirm success:
-- =============================================================================
/*
-- 1. RLS policies
SELECT tablename, policyname, roles, cmd, qual FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('contacts','deals','properties')
ORDER BY tablename, policyname;

-- 2. UTM columns
SELECT column_name FROM information_schema.columns
WHERE table_name = 'contacts' AND column_name LIKE 'utm_%'
ORDER BY column_name;

-- 3. Alert dedup table
SELECT table_name FROM information_schema.tables
WHERE table_name = 'property_alert_sent';
*/
