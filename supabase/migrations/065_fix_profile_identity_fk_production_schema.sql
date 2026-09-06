-- =============================================================================
-- Migration 065: Fix Profile Identity FK (Production-Schema Corrected)
-- Replace profiles.id → auth.users(id) with profiles.id → public.users(id)
-- =============================================================================
--
-- GOVERNANCE:
--   Migration 064 attempted production 2026-09-06.
--   FAILED: production profiles table lacks email, is_active, ami_number columns.
--   PostgreSQL transaction rolled back automatically. ZERO production mutations.
--   Migration 064 preserved in repository as historical evidence.
--   Migration 065 supersedes 064 for production execution.
--
-- OWNER DECISION (2026-09-05): Option B approved.
--   public.users is the canonical application identity table.
--   auth.users has 0 rows and is NOT part of the runtime login path.
--   session.user.id = public.users.id (set by NextAuth jwt callback).
--
-- CANONICAL PRODUCTION public.profiles SCHEMA (audited 2026-09-06):
--   id          uuid         NOT NULL
--   full_name   text         NULL
--   avatar_url  text         NULL
--   role        text         NOT NULL  DEFAULT 'agent'
--   agency_id   text         NULL
--   phone       text         NULL
--   created_at  timestamptz  NOT NULL  DEFAULT now()
--   updated_at  timestamptz  NOT NULL  DEFAULT now()
--   CHECK: role IN ('admin', 'agent', 'viewer')
--   FK (pre-migration): profiles.id → auth.users(id) ON DELETE CASCADE
--
-- ROLE MAPPING (public.users.role → profiles.role):
--   'admin'  → 'admin'   (direct — in CHECK)
--   'agent'  → 'agent'   (direct — in CHECK)
--   'viewer' → 'viewer'  (direct — in CHECK)
--   any other → 'agent'  (fallback — always valid in CHECK; only active prod user is 'admin')
--
-- IS_ACTIVE SEMANTICS (matches auth.ts runtime):
--   Active = is_active IS DISTINCT FROM FALSE
--   i.e., is_active = true OR is_active IS NULL
--   Inactive users are NOT bootstrapped.
--
-- RUNTIME DEPENDENCY AUDIT (2026-09-06):
--   profiles.email      — 0 active runtime references. NOT REQUIRED.
--   profiles.is_active  — 0 active runtime references. NOT REQUIRED.
--   profiles.ami_number — 0 active runtime references. NOT REQUIRED.
--
-- MIGRATION 063 COMPATIBILITY:
--   create_demand_mandate_v1 uses only profiles.id (via demand_mandates.owner_id FK).
--   No dependency on email/is_active/ami_number. COMPATIBLE.
--
-- PREREQUISITE: Migration 059 applied (demand_mandates schema exists).
-- IDEMPOTENT: Safe to re-run. All steps check current state before acting.
-- =============================================================================

BEGIN;

-- ─── STEP 1: PREFLIGHT GUARDS ─────────────────────────────────────────────────

DO $$
DECLARE
  v_users_exists     BOOLEAN;
  v_profiles_exists  BOOLEAN;
  v_users_id_type    TEXT;
  v_profiles_id_type TEXT;
  v_orphaned_count   INT;
BEGIN
  -- 1a. public.users exists.
  SELECT EXISTS(
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='users'
  ) INTO v_users_exists;
  IF NOT v_users_exists THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: public.users does not exist. '
      'Cannot bootstrap profiles without the canonical identity table.'
      USING ERRCODE='P0001';
  END IF;

  -- 1b. public.profiles exists.
  SELECT EXISTS(
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles'
  ) INTO v_profiles_exists;
  IF NOT v_profiles_exists THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: public.profiles does not exist.'
      USING ERRCODE='P0001';
  END IF;

  -- 1c. public.users.id is UUID-compatible.
  SELECT data_type INTO v_users_id_type
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='users' AND column_name='id';
  IF v_users_id_type IS NULL OR v_users_id_type NOT IN ('uuid','USER-DEFINED') THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: public.users.id is not UUID type (found: %).',
      COALESCE(v_users_id_type,'NOT FOUND')
      USING ERRCODE='P0001';
  END IF;

  -- 1d. public.profiles.id is UUID-compatible.
  SELECT data_type INTO v_profiles_id_type
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='profiles' AND column_name='id';
  IF v_profiles_id_type IS NULL OR v_profiles_id_type NOT IN ('uuid','USER-DEFINED') THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: public.profiles.id is not UUID type (found: %).',
      COALESCE(v_profiles_id_type,'NOT FOUND')
      USING ERRCODE='P0001';
  END IF;

  -- 1e. No orphaned profiles (profiles.id not in public.users).
  SELECT COUNT(*) INTO v_orphaned_count
  FROM public.profiles p WHERE NOT EXISTS(SELECT 1 FROM public.users u WHERE u.id=p.id);
  IF v_orphaned_count > 0 THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: % profiles row(s) have id not in public.users. '
      'Resolve orphaned profiles before running this migration.',
      v_orphaned_count
      USING ERRCODE='P0001';
  END IF;

  -- 1f. profiles.role column exists.
  IF NOT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='role'
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: profiles.role column does not exist.'
      USING ERRCODE='P0001';
  END IF;

  -- 1g. profiles.role CHECK constraint allows 'agent' (our fallback for unmapped roles).
  IF NOT EXISTS(
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.profiles'::regclass
      AND contype='c'
      AND pg_get_constraintdef(oid) LIKE '%agent%'
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: profiles.role CHECK constraint does not allow ''agent''. '
      'Cannot guarantee safe role fallback for bootstrap.'
      USING ERRCODE='P0001';
  END IF;

  RAISE NOTICE '[065 PREFLIGHT] PASSED — public.users: %, public.profiles: %, '
    'id types: UUID/UUID, orphaned profiles: 0, role CHECK compatible.',
    v_users_exists, v_profiles_exists;
END $$;

-- ─── STEP 2: REMOVE INCORRECT FK (profiles.id → auth.users) ─────────────────
-- Locate by catalog inspection — do not assume constraint name.

DO $$
DECLARE
  v_old_constraint     TEXT;
  v_already_correct    BOOLEAN;
  v_profiles_id_attnum SMALLINT;
BEGIN
  SELECT attnum INTO v_profiles_id_attnum
  FROM pg_attribute WHERE attrelid='public.profiles'::regclass AND attname='id';

  -- Check if FK already points to public.users (idempotent — already applied).
  SELECT EXISTS(
    SELECT 1 FROM pg_constraint c
    JOIN pg_class ref     ON ref.oid=c.confrelid
    JOIN pg_namespace rn  ON rn.oid=ref.relnamespace
    WHERE c.conrelid='public.profiles'::regclass AND c.contype='f'
      AND rn.nspname='public' AND ref.relname='users'
      AND c.conkey=ARRAY[v_profiles_id_attnum]
  ) INTO v_already_correct;

  IF v_already_correct THEN
    RAISE NOTICE '[065 STEP 2] FK already points to public.users — skipping DROP (idempotent).';
    RETURN;
  END IF;

  -- Find the incorrect FK pointing to auth.users.
  SELECT c.conname INTO v_old_constraint
  FROM pg_constraint c
  JOIN pg_class ref     ON ref.oid=c.confrelid
  JOIN pg_namespace rn  ON rn.oid=ref.relnamespace
  WHERE c.conrelid='public.profiles'::regclass AND c.contype='f'
    AND rn.nspname='auth' AND ref.relname='users'
    AND c.conkey=ARRAY[v_profiles_id_attnum];

  IF v_old_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', v_old_constraint);
    RAISE NOTICE '[065 STEP 2] Dropped old FK: % (profiles.id → auth.users)', v_old_constraint;
  ELSE
    RAISE NOTICE '[065 STEP 2] No profiles.id → auth.users FK found. Proceeding.';
  END IF;
END $$;

-- ─── STEP 3: ADD CORRECT FK (profiles.id → public.users ON DELETE RESTRICT) ──
-- ON DELETE RESTRICT: physical deletion of a user row requires explicit profile
-- deletion first. Enforces audit-safe deactivation (is_active=false) over deletion.

DO $$
DECLARE
  v_already_correct    BOOLEAN;
  v_profiles_id_attnum SMALLINT;
BEGIN
  SELECT attnum INTO v_profiles_id_attnum
  FROM pg_attribute WHERE attrelid='public.profiles'::regclass AND attname='id';

  SELECT EXISTS(
    SELECT 1 FROM pg_constraint c
    JOIN pg_class ref     ON ref.oid=c.confrelid
    JOIN pg_namespace rn  ON rn.oid=ref.relnamespace
    WHERE c.conrelid='public.profiles'::regclass AND c.contype='f'
      AND rn.nspname='public' AND ref.relname='users'
      AND c.conkey=ARRAY[v_profiles_id_attnum]
  ) INTO v_already_correct;

  IF v_already_correct THEN
    RAISE NOTICE '[065 STEP 3] Correct FK already exists — skipping ADD (idempotent).';
  ELSE
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_id_fkey
      FOREIGN KEY (id) REFERENCES public.users(id)
      ON DELETE RESTRICT;
    RAISE NOTICE '[065 STEP 3] Added FK: profiles.id → public.users(id) ON DELETE RESTRICT';
  END IF;
END $$;

-- ─── STEP 4: BOOTSTRAP PROFILES FROM public.users ────────────────────────────
-- Insert only columns confirmed to exist in production profiles table:
--   id, full_name, role, created_at, updated_at
-- Optional columns (avatar_url, agency_id, phone) left at schema defaults (NULL).
-- Role mapping: direct pass-through for roles in CHECK ('admin','agent','viewer');
--   all other users.role values map to 'agent' (the CHECK-safe fallback).
-- Bootstrap only active users: is_active IS DISTINCT FROM FALSE.
-- Inactive users (is_active = false) are NOT bootstrapped.

INSERT INTO public.profiles (id, full_name, role, created_at, updated_at)
SELECT
  u.id,
  COALESCE(NULLIF(TRIM(u.name), ''), SPLIT_PART(u.email, '@', 1), 'Consultor') AS full_name,
  CASE
    WHEN u.role IN ('admin', 'agent', 'viewer') THEN u.role
    ELSE 'agent'
  END AS role,
  NOW() AS created_at,
  NOW() AS updated_at
FROM public.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
  AND u.is_active IS DISTINCT FROM FALSE
ON CONFLICT (id) DO NOTHING;

-- ─── STEP 5: FAIL-CLOSED VERIFICATION ────────────────────────────────────────

DO $$
DECLARE
  v_missing        INT;
  v_bootstrapped   INT;
  v_total_profiles INT;
BEGIN
  SELECT COUNT(*) INTO v_missing
  FROM public.users u
  WHERE NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=u.id)
    AND u.is_active IS DISTINCT FROM FALSE;

  IF v_missing > 0 THEN
    RAISE EXCEPTION 'BOOTSTRAP INCOMPLETE: % active user(s) still lack a profile row. '
      'Migration 065 rolled back — no changes applied.',
      v_missing
      USING ERRCODE='P0001';
  END IF;

  SELECT COUNT(*) INTO v_bootstrapped
  FROM public.profiles WHERE created_at >= (NOW() - INTERVAL '30 seconds');
  SELECT COUNT(*) INTO v_total_profiles FROM public.profiles;

  RAISE NOTICE '[065 STEP 5] VERIFICATION PASSED — Bootstrapped this run: ~%, total profiles: %, missing: 0.',
    v_bootstrapped, v_total_profiles;
END $$;

-- ─── STEP 6: UPDATE TABLE COMMENT ────────────────────────────────────────────

COMMENT ON TABLE public.profiles IS
  'CRM profiles for Agency Group consultants and staff. '
  'Linked 1:1 to public.users — the canonical application identity table. '
  'Identity model (Option B, approved 2026-09-05): '
  '  NextAuth/Auth.js authenticates against public.users via bcrypt. '
  '  session.user.id = public.users.id = profiles.id. '
  '  Supabase auth.users is not part of the runtime login path (0 rows in production). '
  'Migration 065 corrected FK: auth.users → public.users (064 failed, 065 supersedes). '
  'DO NOT re-link to auth.users. '
  'Deletion policy: ON DELETE RESTRICT — deactivate users (is_active=false), do not delete.';

COMMIT;

-- =============================================================================
-- POST-APPLICATION CHECKLIST
-- =============================================================================
-- 1. SELECT conname, confrelid::regclass, confdeltype FROM pg_constraint
--      WHERE conrelid='public.profiles'::regclass AND contype='f'
--      AND conkey=ARRAY[(SELECT attnum FROM pg_attribute
--        WHERE attrelid='public.profiles'::regclass AND attname='id')];
--    → profiles_id_fkey | public.users | r (RESTRICT)
--
-- 2. SELECT COUNT(*) FROM public.profiles;  → must be ≥ 1
-- 3. SELECT COUNT(*) FROM public.users WHERE is_active IS DISTINCT FROM FALSE;  → must match above
-- 4. Run migration 063 (create_demand_mandate_v1 RPC).
-- 5. POST /api/mandates with valid session → must return 201.
-- =============================================================================
