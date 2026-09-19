-- =============================================================================
-- Migration 000100: Deal Pack Authorization Safety
-- Phase 2C.D2-B-DEALPACK-AUTH — 2026-09-19
-- =============================================================================
-- Documents and formalises deal_packs.match_id which already exists in
-- production (confirmed D0-SV 2026-09-19) but was never defined in a
-- migration file. ADD COLUMN IF NOT EXISTS is safe — idempotent if present.
--
-- ZERO DATA CHANGES. ZERO DELETIONS. Additive only.
-- =============================================================================

BEGIN;

-- deal_packs.match_id: FK to matches for match-driven pack generation.
-- Confirmed EXISTS in production. This migration is a safety net only.
ALTER TABLE public.deal_packs
  ADD COLUMN IF NOT EXISTS match_id UUID NULL
  REFERENCES public.matches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_deal_packs_match_id
  ON public.deal_packs(match_id)
  WHERE match_id IS NOT NULL;

COMMIT;
