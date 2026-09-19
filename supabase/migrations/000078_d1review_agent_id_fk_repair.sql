-- =============================================================================
-- Migration 078: D1-REVIEW Agent ID FK Repair
-- Phase 2C.D1-REVIEW — 2026-09-19
-- =============================================================================
-- PROBLEM: activities.agent_id has a FK to auth.users(id) (Supabase Auth table).
-- The Portal uses NextAuth, NOT Supabase Auth. Reviewer UUIDs come from
-- public.users (populated from NextAuth sessions). They are NOT in auth.users.
-- This causes all D1-REVIEW activity inserts to fail with FK violation 23503.
--
-- FIX: Drop the auth.users FK. Re-add pointing to public.users(id) ON DELETE SET NULL.
-- All existing agent_id values (if any) that are in public.users remain valid.
-- ZERO DATA DELETIONS. ZERO MATCH MUTATIONS. Additive FK repair only.
-- =============================================================================

BEGIN;

-- Drop the incorrect FK (auth.users)
ALTER TABLE public.activities
  DROP CONSTRAINT IF EXISTS activities_agent_id_fkey;

-- Re-add pointing to public.users (NextAuth users)
ALTER TABLE public.activities
  ADD CONSTRAINT activities_agent_id_fkey
  FOREIGN KEY (agent_id) REFERENCES public.users(id) ON DELETE SET NULL
  NOT VALID;

COMMIT;
