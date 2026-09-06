-- =============================================================================
-- Migration 064: Fix Profile Identity FK
-- Replace profiles.id → auth.users(id) with profiles.id → public.users(id)
-- =============================================================================
--
-- OWNER DECISION (2026-09-05): Option B approved.
--   public.users is the canonical application identity table.
--   Supabase auth.users is NOT part of the runtime login path.
--   session.user.id = public.users.id (set by NextAuth jwt callback).
--
-- ROOT CAUSE:
--   Migration 001 created profiles with REFERENCES auth.users(id).
--   The application was built using NextAuth + bcrypt against public.users.
--   auth.users has 0 rows in production. profiles therefore had 0 rows.
--   demand_mandates.owner_id → profiles.id → blocked: every POST /api/mandates
--   returned HTTP 409 "Your user account has no CRM profile."
--
-- THIS MIGRATION:
--   A. Preflight guards — fail-closed on unexpected state.
--   B. Removes the incorrect FK: profiles.id → auth.users(id).
--   C. Adds the correct FK: profiles.id → public.users(id) ON DELETE RESTRICT.
--   D. Bootstraps profile rows from eligible active public.users rows.
--   E. Fail-closed verification: all active users must have a profile after bootstrap.
--   F. Updates table comment to reflect corrected identity model.
--
-- DELETION SEMANTICS: ON DELETE RESTRICT (intentional)
--   - Employees who leave should have is_active = false in public.users,
--     not be physically deleted. Physical deletion of a user who has a profile
--     requires explicit reassignment of their mandates, then profile deletion,
--     then user deletion — this is the correct audit-safe sequence.
--   - demand_mandates.owner_id → profiles.id ALREADY uses ON DELETE RESTRICT
--     (migration 059). Consistency preserved.
--
-- SUPERSEDES: Migration 061 — DO NOT APPLY 061 TO PRODUCTION.
--   Migration 061 assumed auth.users canonicality (wrong). It remains in the
--   repository as historical evidence only.
--
-- DOES NOT APPLY: Migrations 060, 062 remain excluded per prior directives.
-- PREREQUISITE: Migration 059 applied (demand_mandates schema exists).
-- IDEMPOTENT: Safe to re-run. All steps check current state before acting.
-- TEST PROJECT: felxvahczmrrvfqrbvyp ONLY
-- PRODUCTION: FORBIDDEN until explicit production approval gate.
-- =============================================================================

BEGIN;

-- ─── STEP 1: PREFLIGHT GUARDS ─────────────────────────────────────────────────
-- Fail closed on any unexpected condition before modifying schema.

DO $$
DECLARE
  v_users_exists     BOOLEAN;
  v_profiles_exists  BOOLEAN;
  v_users_id_type    TEXT;
  v_profiles_id_type TEXT;
  v_orphaned_count   INT;
BEGIN
  -- 1a. Verify public.users exists.
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
  ) INTO v_users_exists;

  IF NOT v_users_exists THEN
    RAISE EXCEPTION
      'PREFLIGHT FAILED: public.users does not exist. '
      'This application uses public.users as canonical identity. '
      'Cannot proceed without the source identity table.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 1b. Verify public.profiles exists.
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) INTO v_profiles_exists;

  IF NOT v_profiles_exists THEN
    RAISE EXCEPTION
      'PREFLIGHT FAILED: public.profiles does not exist. '
      'Run migration 001 before this migration.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 1c. Verify public.users.id is UUID type.
  SELECT data_type INTO v_users_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'id';

  IF v_users_id_type IS NULL OR v_users_id_type NOT IN ('uuid', 'USER-DEFINED') THEN
    RAISE EXCEPTION
      'PREFLIGHT FAILED: public.users.id is not UUID type (found: %). '
      'profiles.id is UUID — types must match for FK.',
      COALESCE(v_users_id_type, 'NOT FOUND')
      USING ERRCODE = 'P0001';
  END IF;

  -- 1d. Verify profiles.id is UUID type.
  SELECT data_type INTO v_profiles_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'id';

  IF v_profiles_id_type IS NULL OR v_profiles_id_type NOT IN ('uuid', 'USER-DEFINED') THEN
    RAISE EXCEPTION
      'PREFLIGHT FAILED: public.profiles.id is not UUID type (found: %). '
      'Types must match for FK.',
      COALESCE(v_profiles_id_type, 'NOT FOUND')
      USING ERRCODE = 'P0001';
  END IF;

  -- 1e. Verify no profiles rows exist whose id has no match in public.users.
  -- (Expected 0, since profiles was empty due to old auth.users FK blocking all inserts.
  --  Fail-closed: any unexpected orphan means state is unknown — abort.)
  SELECT COUNT(*) INTO v_orphaned_count
  FROM public.profiles p
  WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p.id);

  IF v_orphaned_count > 0 THEN
    RAISE EXCEPTION
      'PREFLIGHT FAILED: % profiles row(s) have id values not present in public.users. '
      'These rows would violate the new FK. '
      'Resolve orphaned profiles before running this migration.',
      v_orphaned_count
      USING ERRCODE = 'P0001';
  END IF;

  RAISE NOTICE '[064 PREFLIGHT] PASSED — public.users: %, public.profiles: %, '
    'id types: UUID/UUID, orphaned profiles: 0',
    v_users_exists, v_profiles_exists;
END $$;

-- ─── STEP 2: REMOVE INCORRECT FK (profiles.id → auth.users) ─────────────────
-- Locate the constraint by catalog inspection — do not assume constraint name.
-- Handles: constraint exists, constraint already removed, migration already applied.

DO $$
DECLARE
  v_old_constraint   TEXT;
  v_already_correct  BOOLEAN;
  v_profiles_id_attnum SMALLINT;
BEGIN
  -- Get the attnum of profiles.id column.
  SELECT attnum INTO v_profiles_id_attnum
  FROM pg_attribute
  WHERE attrelid = 'public.profiles'::regclass AND attname = 'id';

  -- Check if FK already points to public.users (already applied — idempotent).
  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class ref     ON ref.oid = c.confrelid
    JOIN pg_namespace rn  ON rn.oid = ref.relnamespace
    WHERE c.conrelid = 'public.profiles'::regclass
      AND c.contype  = 'f'
      AND rn.nspname = 'public'
      AND ref.relname = 'users'
      AND c.conkey = ARRAY[v_profiles_id_attnum]
  ) INTO v_already_correct;

  IF v_already_correct THEN
    RAISE NOTICE '[064 STEP 2] FK already points to public.users — skipping DROP (idempotent).';
    RETURN;
  END IF;

  -- Find the FK constraint on profiles.id referencing auth.users.
  SELECT c.conname INTO v_old_constraint
  FROM pg_constraint c
  JOIN pg_class ref     ON ref.oid = c.confrelid
  JOIN pg_namespace rn  ON rn.oid = ref.relnamespace
  WHERE c.conrelid = 'public.profiles'::regclass
    AND c.contype  = 'f'
    AND rn.nspname = 'auth'
    AND ref.relname = 'users'
    AND c.conkey = ARRAY[v_profiles_id_attnum];

  IF v_old_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', v_old_constraint);
    RAISE NOTICE '[064 STEP 2] Dropped old FK constraint: % (profiles.id → auth.users)', v_old_constraint;
  ELSE
    RAISE NOTICE '[064 STEP 2] No profiles.id → auth.users FK found. Proceeding (clean or partially applied state).';
  END IF;
END $$;

-- ─── STEP 3: ADD CORRECT FK (profiles.id → public.users) ────────────────────
-- ON DELETE RESTRICT: cannot delete a public.users row while a profiles row exists.
-- Forces explicit deactivation (is_active = false) instead of physical deletion.

DO $$
DECLARE
  v_already_correct  BOOLEAN;
  v_profiles_id_attnum SMALLINT;
BEGIN
  SELECT attnum INTO v_profiles_id_attnum
  FROM pg_attribute
  WHERE attrelid = 'public.profiles'::regclass AND attname = 'id';

  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class ref     ON ref.oid = c.confrelid
    JOIN pg_namespace rn  ON rn.oid = ref.relnamespace
    WHERE c.conrelid = 'public.profiles'::regclass
      AND c.contype  = 'f'
      AND rn.nspname = 'public'
      AND ref.relname = 'users'
      AND c.conkey = ARRAY[v_profiles_id_attnum]
  ) INTO v_already_correct;

  IF v_already_correct THEN
    RAISE NOTICE '[064 STEP 3] Correct FK already exists — skipping ADD (idempotent).';
  ELSE
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_id_fkey
      FOREIGN KEY (id)
      REFERENCES public.users(id)
      ON DELETE RESTRICT;
    RAISE NOTICE '[064 STEP 3] Added FK: profiles.id → public.users(id) ON DELETE RESTRICT';
  END IF;
END $$;

-- ─── STEP 4: BOOTSTRAP PROFILES FROM public.users ────────────────────────────
-- Insert profile rows for all active public.users entries that lack profiles.
-- Role mapping: 'agent' → 'consultant' (profiles CHECK constraint does not include 'agent').
-- avatar_url, phone, whatsapp_number, monthly_target left at schema defaults (NULL).
-- ami_number defaults to 'AMI 22506' — the Agency Group license number.
-- ON CONFLICT (id) DO NOTHING: idempotent if profile already exists.

INSERT INTO public.profiles (
  id,
  full_name,
  email,
  role,
  is_active,
  ami_number,
  created_at,
  updated_at
)
SELECT
  u.id,
  COALESCE(NULLIF(TRIM(u.name), ''), SPLIT_PART(u.email, '@', 1), 'Consultor') AS full_name,
  u.email,
  CASE
    WHEN u.role IN ('admin', 'manager', 'consultant', 'assistant') THEN u.role
    ELSE 'consultant'   -- maps 'agent' and any other unlisted role → 'consultant'
  END AS role,
  COALESCE(u.is_active, TRUE) AS is_active,
  'AMI 22506'           AS ami_number,
  NOW()                 AS created_at,
  NOW()                 AS updated_at
FROM public.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
)
  AND u.is_active IS DISTINCT FROM FALSE
ON CONFLICT (id) DO NOTHING;

-- ─── STEP 5: FAIL-CLOSED VERIFICATION ────────────────────────────────────────
-- After bootstrap, every active public.users row must have a profile.
-- RAISE EXCEPTION (not WARNING) — migration fails loud if any are missing.

DO $$
DECLARE
  v_missing     INT;
  v_bootstrapped INT;
  v_total_profiles INT;
BEGIN
  -- Count active users without a profile.
  SELECT COUNT(*) INTO v_missing
  FROM public.users u
  WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
    AND u.is_active IS DISTINCT FROM FALSE;

  IF v_missing > 0 THEN
    RAISE EXCEPTION
      'BOOTSTRAP INCOMPLETE: % active user(s) still lack a profile row after bootstrap. '
      'Check for unexpected role values or constraint violations. '
      'Migration 064 rolled back — no changes applied.',
      v_missing
      USING ERRCODE = 'P0001';
  END IF;

  -- Count rows created in this run (approximate — within last 30 seconds).
  SELECT COUNT(*) INTO v_bootstrapped
  FROM public.profiles
  WHERE created_at >= (NOW() - INTERVAL '30 seconds');

  SELECT COUNT(*) INTO v_total_profiles FROM public.profiles;

  RAISE NOTICE '[064 STEP 5] VERIFICATION PASSED — '
    'Profiles bootstrapped this run: ~%, total profiles: %, missing: 0.',
    v_bootstrapped, v_total_profiles;
END $$;

-- ─── STEP 6: UPDATE TABLE COMMENT ────────────────────────────────────────────

COMMENT ON TABLE public.profiles IS
  'CRM profiles for Agency Group consultants and staff. '
  'Linked 1:1 to public.users — the application canonical identity table. '
  'Identity model (Option B, approved 2026-09-05): '
  '  NextAuth/Auth.js authenticates against public.users via bcrypt. '
  '  session.user.id = public.users.id = profiles.id. '
  '  Supabase auth.users is not part of the runtime login path. '
  'Migration 064 corrected FK: auth.users → public.users. '
  'DO NOT re-link to auth.users. '
  'Deletion policy: ON DELETE RESTRICT — deactivate users (is_active=false), do not delete.';

COMMIT;

-- =============================================================================
-- POST-APPLICATION CHECKLIST (for Production Approval Gate)
-- =============================================================================
-- After applying this migration, verify:
--   SELECT COUNT(*) FROM public.profiles;                    -- must be >= 1
--   SELECT COUNT(*) FROM public.users WHERE is_active != false;  -- must match above
--   SELECT conname, confrelid::regclass FROM pg_constraint
--     WHERE conrelid = 'public.profiles'::regclass AND contype = 'f'
--     AND conkey = ARRAY[(SELECT attnum FROM pg_attribute
--       WHERE attrelid = 'public.profiles'::regclass AND attname = 'id')];
--   -- Must return: profiles_id_fkey | public.users
-- Then run migration 063 (create_demand_mandate_v1 RPC).
-- Then run POST /api/mandates with a valid session — must return 201, not 409.
-- =============================================================================
