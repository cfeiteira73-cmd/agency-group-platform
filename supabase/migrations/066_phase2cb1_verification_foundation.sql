-- =============================================================================
-- ⛔ SUPERSEDED — DO NOT APPLY TO PRODUCTION
-- =============================================================================
-- Migration 066 was written against a false English-schema assumption.
-- It tries to ALTER TYPE property_status which DOES NOT EXIST in production.
-- It uses English column names (title, zone, type, …) which do NOT exist.
--
-- USE MIGRATION 067 INSTEAD:
--   supabase/migrations/067_phase2cb1_production_schema_reconciliation.sql
--
-- This file is retained for forensic history only.
-- =============================================================================

-- =============================================================================
-- Migration 066: Phase 2C.B1 — Property Submission Status + Verification Foundation
-- =============================================================================
--
-- PURPOSE:
--   1. Extend property_status enum with 'pending_review' — the lifecycle state
--      for all partner-submitted properties awaiting Agency Group review.
--   2. Add verification and provenance columns to the properties table.
--
-- PRINCIPLES:
--   SUBMITTED ≠ VERIFIED  — new submissions are always is_verified = false.
--   VERIFIED ≠ AVAILABLE  — pending_review properties are is_off_market = true.
--   AVAILABLE ≠ PUBLISHED — portal_published remains false until explicit decision.
--   NO HISTORICAL BACKFILL — existing rows keep their current status/verification.
--   OPTION B PRESERVED    — verified_by → public.users(id), NOT auth.users.
--
-- IDEMPOTENT: All statements use IF NOT EXISTS — safe to re-run.
-- NO BEGIN/COMMIT: ALTER TYPE ADD VALUE cannot participate in a transaction block
--   in all PostgreSQL versions; auto-commit per statement is safest.
--
-- APPLIED TO: canonical production isbfiofwpxqqpgxoftph (pending access restoration)
-- BASELINE:   commit 88f42fe | tests 2629/2629 | TS 0 errors
-- =============================================================================

-- ─── STEP 1: Extend property_status enum ─────────────────────────────────────
-- ADD VALUE IF NOT EXISTS is idempotent — safe if already present.

ALTER TYPE property_status ADD VALUE IF NOT EXISTS 'pending_review' AFTER 'off_market';

-- ─── STEP 2: Add verification and provenance columns ─────────────────────────

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS is_verified        BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_date  TIMESTAMPTZ          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS verified_by        UUID                 REFERENCES public.users(id) ON DELETE SET NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS submission_source  TEXT                 DEFAULT NULL;

-- ─── STEP 3: Document schema intent ─────────────────────────────────────────

COMMENT ON COLUMN public.properties.is_verified IS
  'Whether this property has been manually verified by an Agency Group agent. '
  'Default false. Partner submissions are NEVER auto-verified. '
  'Set true only through an explicit human review action.';

COMMENT ON COLUMN public.properties.verification_date IS
  'Timestamp of the most recent manual verification. NULL until verified.';

COMMENT ON COLUMN public.properties.verified_by IS
  'FK to public.users(id) — the AG agent who verified this property. '
  'NULL until explicitly verified. Option B identity — NOT auth.users.';

COMMENT ON COLUMN public.properties.submission_source IS
  'Origin of the property entry. ''partner'' for external agency submissions '
  'via /api/properties POST. NULL for properties entered directly by AG agents.';

-- =============================================================================
-- POST-APPLICATION CHECKLIST
-- =============================================================================
-- 1. Verify enum:
--    SELECT enumlabel FROM pg_enum
--    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'property_status')
--    ORDER BY enumsortorder;
--    → must include 'pending_review'
--
-- 2. Verify columns:
--    SELECT column_name, data_type, is_nullable, column_default
--    FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'properties'
--    AND column_name IN ('is_verified','verification_date','verified_by','submission_source');
--    → 4 rows returned
--
-- 3. Verify FK chain:
--    SELECT conname, confrelid::regclass FROM pg_constraint
--    WHERE conrelid = 'public.properties'::regclass AND contype = 'f'
--    AND conname LIKE '%verified_by%';
--    → properties_verified_by_fkey | public.users
--
-- 4. Verify existing rows unchanged:
--    SELECT COUNT(*) FROM properties WHERE is_verified = true;
--    → 0 (no historical auto-verification)
-- =============================================================================
