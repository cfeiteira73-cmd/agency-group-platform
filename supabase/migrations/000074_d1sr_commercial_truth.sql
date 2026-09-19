-- =============================================================================
-- Migration 074: D1-SR Commercial Truth & Schema Repair
-- Phase 2C.D1-SR — 2026-09-19
-- =============================================================================
-- Adds the three columns that were ABSENT from production but required by the
-- commission engine and match→deal traceability chain.
--
-- ZERO DATA DELETIONS. ZERO MATCH MUTATIONS. ZERO LEGACY ROW CHANGES.
-- All changes are additive (ADD COLUMN IF NOT EXISTS) or pure backfill
-- (UPDATE WHERE deal_value IS NULL).
-- =============================================================================

BEGIN;

-- 1. deals.deal_value — canonical DECIMAL for commission engine
--    Previously absent → POST /api/deals returned 503, commission always €0.
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS deal_value DECIMAL(12,2) NULL;

-- 2. deals.match_id — match→deal traceability FK
--    ON DELETE SET NULL: if a match is ever removed, the deal is not orphaned.
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS match_id UUID NULL
  REFERENCES public.matches(id) ON DELETE SET NULL;

-- 3. activities.match_id — match→activity traceability FK
--    ON DELETE SET NULL: symmetric with deals.match_id behavior.
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS match_id UUID NULL
  REFERENCES public.matches(id) ON DELETE SET NULL;

-- 4. Backfill deal_value from valor
--    Safety guard: only plain numeric strings (no '€', '.', spaces) are cast.
--    The WHERE clause mirrors the probe-confirmed production data format.
--    8 production deals confirmed parseable via d0sv_probe.cjs (2026-09-19).
UPDATE public.deals
  SET deal_value = valor::DECIMAL(12,2)
  WHERE valor IS NOT NULL
    AND valor ~ '^[0-9]+(\.[0-9]+)?$'
    AND deal_value IS NULL;

COMMIT;
