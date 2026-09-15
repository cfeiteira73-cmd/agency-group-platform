-- Migration 069: B2 — Add 'archived' to properties status enum
-- Phase 2C.B2 | 2026-09-15
-- ARCHIVED ≠ SOLD ≠ OFF-MARKET
-- Soft-archive sets status='archived' AND is_off_market=true
-- RLS SELECT policy "Public read active listings" already excludes archived rows
-- (status='active' AND is_off_market=false) — no RLS change needed.

BEGIN;

-- 1. Drop the current CHECK constraint
ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_status_check;

-- 2. Re-add with 'archived' included
ALTER TABLE public.properties
  ADD CONSTRAINT properties_status_check
  CHECK (status = ANY (ARRAY[
    'active'::text,
    'sold'::text,
    'reserved'::text,
    'pending_review'::text,
    'archived'::text
  ]));

COMMIT;
