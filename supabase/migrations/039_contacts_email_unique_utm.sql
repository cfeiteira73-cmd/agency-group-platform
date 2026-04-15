-- =============================================================================
-- Migration 039 — Contacts: email unique index + UTM source tracking
-- 2026-04-15
--
-- Context: Supabase schema audit found:
-- 1. contacts.email has NO UNIQUE constraint — silent duplicate imports possible
--    (API does manual find-then-update but duplicate emails can still exist from
--    direct DB inserts, n8n workflows, Notion seed, etc.)
-- 2. No UTM parameter storage — source attribution is single-field (source TEXT)
--    which loses campaign/medium/term/content data → blind on marketing ROI
--
-- Safe to apply: IF NOT EXISTS guards, partial index (nulls excluded), no data loss
--
-- RUN IN: Supabase Dashboard → SQL Editor
-- =============================================================================

-- ─── 1. Email partial unique index (nulls excluded — email is nullable) ────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_email_unique
  ON contacts(email)
  WHERE email IS NOT NULL;

-- ─── 2. UTM source tracking columns ──────────────────────────────────────────
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS utm_source   TEXT,   -- e.g. 'google', 'instagram', 'idealist'
  ADD COLUMN IF NOT EXISTS utm_medium   TEXT,   -- e.g. 'cpc', 'organic', 'email'
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,   -- e.g. 'lisbon_luxury_q2_2026'
  ADD COLUMN IF NOT EXISTS utm_term     TEXT,   -- e.g. 'apartments lisbon buy'
  ADD COLUMN IF NOT EXISTS utm_content  TEXT,   -- e.g. 'hero_cta', 'blog_sidebar'
  ADD COLUMN IF NOT EXISTS utm_landing  TEXT;   -- first page URL at capture time

-- Index for campaign attribution queries
CREATE INDEX IF NOT EXISTS idx_contacts_utm_source
  ON contacts(utm_source)
  WHERE utm_source IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_utm_campaign
  ON contacts(utm_campaign)
  WHERE utm_campaign IS NOT NULL;

-- ─── 3. Verify ────────────────────────────────────────────────────────────────
-- After running:
-- SELECT COUNT(*) FROM contacts WHERE email IS NOT NULL GROUP BY email HAVING COUNT(*) > 1;
-- → Should return 0 rows (duplicate emails should be resolved before creating index)
-- If it fails: resolve duplicates first with:
--   DELETE FROM contacts WHERE id IN (
--     SELECT id FROM (
--       SELECT id, ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at DESC) AS rn
--       FROM contacts WHERE email IS NOT NULL
--     ) sub WHERE rn > 1
--   );
