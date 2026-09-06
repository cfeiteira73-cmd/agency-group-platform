-- =============================================================================
-- Migration 061: Profile Bootstrap — CORRECTED (fail-closed)
-- Creates profile rows for existing public.users entries that lack them.
-- Required because demand_mandates.owner_id FK → profiles(id).
--
-- Design invariant: public.users.id = auth.users.id = profiles.id (same UUID)
-- Live data condition: profiles table may have 0 rows despite active users.
-- This migration closes that gap, idempotently and fail-closed.
--
-- Changes from original:
--   1. Explicit prerequisite guard: RAISE EXCEPTION if public.users absent.
--   2. Verification upgraded: RAISE EXCEPTION (was RAISE WARNING) if any
--      active user still lacks a profile after INSERT — migration fails loud.
--
-- Test project: felxvahczmrrvfqrbvyp ONLY
-- Production: FORBIDDEN until explicit gate
-- Idempotent: ON CONFLICT DO NOTHING — safe to re-run
-- =============================================================================

-- ── Step 1: Prerequisite guard ────────────────────────────────────────────────
-- Fail fast if the source table doesn't exist. Silent no-op is not acceptable.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
  ) THEN
    RAISE EXCEPTION
      'Migration 061 blocked: public.users does not exist. '
      'Cannot bootstrap profiles without a source user table. '
      'If your application uses only auth.users (no public.users table), '
      'this migration should be SKIPPED for this environment.'
      USING ERRCODE = 'P0001';
  END IF;
END $$;

-- ── Step 2: Bootstrap INSERT ──────────────────────────────────────────────────
-- Insert profile rows for any active user that lacks one.
-- Role mapping: 'agent' → 'consultant' (profiles CHECK does not include 'agent')
-- ON CONFLICT (id) DO NOTHING ensures idempotency on re-run.
INSERT INTO public.profiles (id, full_name, email, role, is_active, created_at, updated_at)
SELECT
  u.id,
  COALESCE(NULLIF(TRIM(u.name), ''), SPLIT_PART(u.email, '@', 1), 'Consultor'),
  u.email,
  CASE
    WHEN u.role IN ('admin', 'manager', 'consultant', 'assistant') THEN u.role
    ELSE 'consultant'
  END,
  COALESCE(u.is_active, TRUE),
  NOW(),
  NOW()
FROM public.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
)
  AND u.is_active IS DISTINCT FROM FALSE
ON CONFLICT (id) DO NOTHING;

-- ── Step 3: Fail-closed verification ─────────────────────────────────────────
-- Any active user without a profile after the INSERT is a hard failure.
-- RAISE EXCEPTION (not WARNING) — migration must not succeed silently.
DO $$
DECLARE
  v_missing INT;
  v_created INT;
BEGIN
  SELECT COUNT(*) INTO v_missing
  FROM public.users u
  WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
    AND u.is_active IS DISTINCT FROM FALSE;

  IF v_missing > 0 THEN
    RAISE EXCEPTION
      'Profile bootstrap incomplete: % active user(s) still lack a profile row. '
      'Check for FK violations against auth.users or unexpected role values.',
      v_missing
      USING ERRCODE = 'P0001';
  END IF;

  -- Report how many were created (informational, not blocking)
  SELECT COUNT(*) INTO v_created
  FROM public.profiles
  WHERE created_at >= (NOW() - INTERVAL '5 seconds');

  RAISE NOTICE 'Profile bootstrap complete. Rows created this run: ~%.', v_created;
END $$;
