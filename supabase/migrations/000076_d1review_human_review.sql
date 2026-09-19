-- =============================================================================
-- Migration 076: D1-REVIEW Human Match Review Layer
-- Phase 2C.D1-REVIEW — 2026-09-19
-- =============================================================================
-- Adds human review columns to matches. All columns are additive (IF NOT EXISTS).
-- The CHECK constraint uses NOT VALID to avoid locking the table during migration:
-- existing rows are not validated. VALIDATE CONSTRAINT can be run separately.
--
-- ZERO DATA DELETIONS. ZERO MATCH MUTATIONS. ZERO LEGACY ROW CHANGES.
-- =============================================================================

BEGIN;

-- 1. matches.notes — human-written review notes
--    Machine MUST NOT write this column (see upsert_match_v1 — UPDATE only
--    touches algorithm fields, never notes).
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS notes TEXT NULL;

-- 2. matches.reviewed_at — server-generated timestamp of the review decision
--    Set by PATCH /api/matches/[id] when status changes. Not client-settable.
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ NULL;

-- 3. matches.reviewed_by — FK to public.users(id) (canonical application identity)
--    auth.ts confirms: session.user.id = public.users.id (UUID)
--    Server-derived from authenticated email — never accepted from client.
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS reviewed_by UUID NULL
  REFERENCES public.users(id) ON DELETE SET NULL;

-- 4. CHECK constraint on matches.status (valid human-review states only)
--    NOT VALID: does not validate existing rows (avoids full table scan).
--    All 38 current rows are expected to have status='pending' (D0-SV confirmed),
--    so validation is safe. Run VALIDATE CONSTRAINT separately if needed.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'matches_status_check'
      AND conrelid = 'public.matches'::regclass
  ) THEN
    ALTER TABLE public.matches
      ADD CONSTRAINT matches_status_check
      CHECK (status IN ('pending', 'reviewed_accepted', 'reviewed_rejected'))
      NOT VALID;
  END IF;
END $$;

COMMIT;
