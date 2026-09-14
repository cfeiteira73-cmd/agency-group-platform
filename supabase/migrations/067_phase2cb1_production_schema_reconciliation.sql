-- =============================================================================
-- Migration 067: Phase 2C.B1 — Production Schema Reconciliation
-- =============================================================================
--
-- PURPOSE:
--   Implements B1 verification, provenance, and off-market columns on the
--   ACTUAL production properties table (Portuguese column names).
--   Replaces Migration 066 which was written against a false English-schema
--   assumption and also tried to ALTER a non-existent property_status enum.
--
-- PRODUCTION TRUTH (verified 2026-09-14, project isbfiofwpxqqpgxoftph):
--   • properties table uses Portuguese column names:
--     nome, zona, bairro, tipo, preco, area, quartos, casas_banho, …
--   • status column is TEXT — no property_status enum exists
--   • B1 columns (is_verified, submission_source, is_off_market) ABSENT
--   • RLS policy "Agents can read all properties" has USING (true) —
--     allows anon SELECT on ALL rows including any future pending_review rows
--
-- WHAT THIS MIGRATION DOES:
--   1. Adds B1 verification and provenance columns (additive, no renames)
--   2. Replaces the permissive anon SELECT policy with one scoped to
--      active, non-off-market inventory (minimum safe change for B1)
--
-- WHAT THIS MIGRATION DOES NOT DO:
--   • Does NOT rename any existing column
--   • Does NOT create a property_status enum
--   • Does NOT modify service-role access
--   • Does NOT implement B2 confidentiality architecture
--
-- BADGE = 'Off-Market' BACKFILL (Step 1b):
--   Production confirmed 3 rows with badge = 'Off-Market' (2026-09-14).
--   These are backfilled to is_off_market = true in Step 1b.
--   Owner decision explicit. All other badges remain is_off_market = false.
--
-- PRINCIPLES:
--   SUBMITTED ≠ VERIFIED  — new submissions are always is_verified = false
--   VERIFIED ≠ AVAILABLE  — pending_review properties are is_off_market = true
--   AVAILABLE ≠ PUBLISHED — property stays off-market until explicit AG decision
--   NO VERIFICATION BACKFILL — existing 55 rows keep current status/is_verified=false
--   BADGE BACKFILL — 3 rows with badge='Off-Market' set is_off_market=true (Step 1b)
--   OPTION B PRESERVED    — verified_by → public.users(id), NOT auth.users
--   MINIMUM SAFE CHANGE   — only the RLS policy needed for B1 safety is changed
--
-- IDEMPOTENT: ADD COLUMN IF NOT EXISTS — safe to re-run.
-- DEPLOYMENT ORDER: apply migration → verify → deploy application code.
--
-- BASELINE: commit 88f42fe (production) | 55 live properties
-- SUPERSEDES: Migration 066 (apply 067 instead of 066 in production)
-- =============================================================================

-- ─── STEP 1: Add B1 verification and provenance columns ──────────────────────
-- All columns are additive. Existing 55 rows receive default values.
-- is_verified = false:     historical rows are not verified under B1 model
-- is_off_market = false:   initializes all existing rows as publicly visible
--                          (Step 1b immediately backfills badge='Off-Market' rows to true)
-- submission_source = NULL: existing rows have no structured provenance record

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS is_verified        BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_date  TIMESTAMPTZ          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS verified_by        UUID                 DEFAULT NULL
                           REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submission_source  TEXT                 DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_off_market      BOOLEAN     NOT NULL DEFAULT false;

-- ─── STEP 1b: Historical Off-Market backfill ────────────────────────────────
--
-- OWNER DECISION (2026-09-14, direct production evidence):
--   Exactly 3 production rows have badge = 'Off-Market'. These were explicitly
--   classified as off-market BEFORE the structured boolean column existed.
--   The backfill preserves existing commercial intent; it does NOT create new
--   confidentiality classifications. badge='Off-Market' is the ONLY criterion.
--
-- No other badge value (Novo, Destaque, Exclusivo, NULL) is backfilled.
-- No fuzzy matching. No case-insensitive matching. Exact string only.
--
-- SAFETY GUARD: WHERE is_off_market = false prevents double-applying
--   if this migration is re-run (ADD COLUMN IF NOT EXISTS is idempotent but
--   the column would already exist on re-run; DEFAULT false means no rows
--   would satisfy is_off_market=false unless they were truly not yet set).
--
-- EXPECTED RESULT after this step (based on 2026-09-14 production count):
--   is_off_market = true  → 3 rows  (badge='Off-Market')
--   is_off_market = false → 52 rows (all others)
--   Total: 55
--
-- ⚠️  RE-CHECK BEFORE EXECUTION: Run these queries immediately before applying:
--   SELECT COUNT(*) FROM properties;
--   SELECT badge, COUNT(*) FROM properties GROUP BY badge;
--   If badge='Off-Market' count ≠ 3 → STOP and notify owner.

UPDATE public.properties
SET    is_off_market = true
WHERE  badge = 'Off-Market'
  AND  is_off_market = false;

-- ─── STEP 2: Column documentation ────────────────────────────────────────────

COMMENT ON COLUMN public.properties.is_verified IS
  'Whether this property has been manually verified by an Agency Group agent. '
  'Default false. Partner submissions (submission_source=''partner'') are NEVER '
  'auto-verified. Set true only through an explicit human review action. '
  'Existing rows: false means not-yet-assessed under the B1 model, not rejected.';

COMMENT ON COLUMN public.properties.verification_date IS
  'Timestamp of the most recent manual verification. NULL until verified.';

COMMENT ON COLUMN public.properties.verified_by IS
  'FK to public.users(id) — the AG agent who verified this property. '
  'NULL until explicitly verified. References public.users (Option B), NOT auth.users.';

COMMENT ON COLUMN public.properties.submission_source IS
  'Origin of the property entry. ''partner'' for external agency submissions '
  'via POST /api/properties. NULL for properties entered directly by AG agents.';

COMMENT ON COLUMN public.properties.is_off_market IS
  'Programmatic confidentiality gate. true = not publicly queryable by anon. '
  'Partner submissions always start with is_off_market = true. '
  'Existing rows initialize as false; 3 rows with badge=Off-Market backfilled to true '
  'in migration 067 Step 1b (owner decision 2026-09-14).';

-- ─── STEP 3: Minimum B1 RLS security boundary ────────────────────────────────
--
-- PROBLEM: Current "Agents can read all properties" policy has USING (true).
-- This exposes ALL rows (including future pending_review partner submissions)
-- to direct anonymous Supabase client queries.
--
-- FIX: Replace the permissive anon SELECT policy with one that restricts to
-- active, non-off-market inventory only.
--
-- PRESERVED POLICIES (not touched):
--   • "Service role has full access" — service role bypass retained
--   • "properties_own_delete" — agent own-delete retained
--   • Any other existing policies
--
-- ANON READ AFTER THIS MIGRATION:
--   Only rows with status = 'active' AND is_off_market = false
--
-- SERVICE ROLE READ (via supabaseAdmin in application):
--   All rows — bypasses RLS entirely
--
-- NOTE ON AUTHENTICATED PORTAL USERS:
--   NextAuth session tokens are not propagated into Supabase auth.
--   Portal reads use supabaseAdmin (service role) and bypass RLS.
--   The authenticated RLS policy below is a safety net for future direct access.

-- Drop ALL overly permissive anon/authenticated SELECT policies
-- LIVE PRODUCTION TRUTH (verified 2026-09-14, project isbfiofwpxqqpgxoftph):
--   "Agents can read all properties"  USING (true)       — allows ALL rows for authenticated
--   "properties_authenticated"         USING (auth.role() = 'authenticated') — allows ALL rows
--   "properties_public_read"           USING (status <> ALL (ARRAY['off-market','archived']))
--                                      — allows pending_review and other non-archived rows for anon
-- All three must be dropped and replaced by the single scoped policy below.
DROP POLICY IF EXISTS "Agents can read all properties" ON public.properties;
DROP POLICY IF EXISTS "properties_authenticated" ON public.properties;
DROP POLICY IF EXISTS "properties_public_read" ON public.properties;

-- Public/anon access: only active, non-off-market inventory
-- This prevents pending_review and is_off_market=true rows from being
-- directly queryable by anyone with the Supabase anon key.
CREATE POLICY "Public read active listings"
  ON public.properties
  FOR SELECT
  TO anon, authenticated
  USING (
    status = 'active'
    AND is_off_market = false
  );

-- Service-role users (supabaseAdmin used in all internal portal routes)
-- get full access through the existing service-role bypass policy.
-- No changes needed for service-role access.

-- ─── STEP 4: Index for B1 query patterns ─────────────────────────────────────
-- Supports efficient pending_review discovery and off-market filtering.

CREATE INDEX IF NOT EXISTS idx_properties_status_offmarket
  ON public.properties (status, is_off_market);

CREATE INDEX IF NOT EXISTS idx_properties_submission_source
  ON public.properties (submission_source)
  WHERE submission_source IS NOT NULL;

-- =============================================================================
-- POST-APPLICATION CHECKLIST
-- =============================================================================
-- 1. Verify B1 columns exist:
--    SELECT column_name, data_type, is_nullable, column_default
--    FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'properties'
--    AND column_name IN ('is_verified','verification_date','verified_by',
--                        'submission_source','is_off_market');
--    → 5 rows returned
--
-- 2. Verify existing data unchanged:
--    SELECT COUNT(*) FROM properties WHERE is_verified = true;
--    → 0 (no historical auto-verification)
--    SELECT COUNT(*) FROM properties WHERE is_off_market = true;
--    → 3 (badge='Off-Market' rows backfilled by Step 1b)
--    SELECT COUNT(*) FROM properties WHERE is_off_market = false;
--    → 52
--
-- 3. Verify RLS policy change:
--    SELECT policyname, cmd, qual
--    FROM pg_policies
--    WHERE schemaname = 'public' AND tablename = 'properties'
--    ORDER BY policyname;
--    → "Agents can read all properties" must NOT appear
--    → "Public read active listings" must appear with status/is_off_market filter
--
-- 4. Verify anon cannot read pending_review:
--    Using anon key: SELECT * FROM properties WHERE status = 'pending_review';
--    → 0 rows (RLS filters them out)
--
-- 5. Verify service role can read all:
--    Using service key: SELECT COUNT(*) FROM properties;
--    → 55 (all rows visible)
-- =============================================================================
