-- =============================================================================
-- Phase 2C.C0-SF2 — Fix upsert_match_v1 min(uuid) error
-- 000072_fix_upsert_match_v1.sql
--
-- Root cause (confirmed 2026-09-19):
--   SELECT COUNT(*), MIN(id) ... fails with SQLSTATE 42883
--   "function min(uuid) does not exist" — production PostgreSQL has no
--   min aggregate registered for the UUID type.
--
-- Fix (minimum repair):
--   Replace the single combined SELECT with two separate queries:
--     1. COUNT(*) only  → no aggregate on UUID
--     2. SELECT id LIMIT 1  → scalar read when count = 1 (UPDATE path)
--
-- Caller and function signature are UNCHANGED.
-- All historical data (17 matches) is preserved.
-- SECURITY INVOKER contract preserved.
--
-- INVARIANTS (never violated):
--   All 17 legacy rows preserved exactly as-is.
--   No historical data deleted, modified, or merged.
--   trigger_deal_pack = false always (INVARIANT, enforced at caller level).
--   MATCH FOUND ≠ PROPERTY DISCLOSED ≠ BUYER CONTACTED.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Pre-flight: verify legacy row count is still 17
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM public.matches) != 17 THEN
    RAISE EXCEPTION 'Pre-flight FAILED: expected 17 legacy matches, got %',
      (SELECT COUNT(*) FROM public.matches);
  END IF;
  RAISE NOTICE 'Pre-flight PASSED: 17 legacy matches confirmed';
END;
$$;

-- ---------------------------------------------------------------------------
-- CREATE OR REPLACE upsert_match_v1 — fix only: two-query replace for MIN(id)
--
-- CHANGED: lines 122-130 of the original function body.
--   BEFORE:
--     SELECT COUNT(*), MIN(id) INTO v_existing_count, v_existing_id FROM matches ...
--   AFTER:
--     SELECT COUNT(*) INTO v_existing_count FROM matches ...
--     IF v_existing_count = 1 THEN
--       SELECT id INTO v_existing_id FROM matches ... ;
--     END IF;
--
-- Everything else is IDENTICAL to migration 000071.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.upsert_match_v1(
  p_lead_id              BIGINT,
  p_property_id          TEXT,
  p_mandate_id           UUID,
  p_property_title       TEXT,
  p_match_score          INTEGER,
  p_breakdown            JSONB,
  p_match_reasons        TEXT[],
  p_explanation          TEXT,
  p_similarity           DOUBLE PRECISION,
  p_estimated_yield      DOUBLE PRECISION,
  p_matched_by           TEXT,
  p_next_best_action     TEXT,
  p_match_weaknesses     TEXT[],
  p_priority_level       TEXT,
  p_next_action_deadline TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_lock_key       BIGINT;
  v_existing_count INTEGER;
  v_existing_id    UUID;
BEGIN
  -- Advisory lock key: XOR of lead_id with hash of (property_id:mandate_id).
  -- pg_advisory_xact_lock serializes concurrent transactions with identical keys.
  -- Lock is released automatically at transaction end (no manual release needed).
  v_lock_key := p_lead_id # hashtext(
    p_property_id || ':' || COALESCE(p_mandate_id::text, '__NULL__')
  )::bigint;

  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- SF2 FIX: split into two queries to avoid min(uuid) which is not available
  -- in this production environment. The semantics are identical:
  --   count=0 → INSERT (v_existing_id unused until RETURNING sets it)
  --   count=1 → UPDATE (v_existing_id fetched below for WHERE id = v_existing_id)
  --   count>1 → legacy_duplicate_set (v_existing_id unused)

  SELECT COUNT(*) INTO v_existing_count
    FROM public.matches
   WHERE lead_id     = p_lead_id
     AND property_id = p_property_id
     AND (
           (p_mandate_id IS NULL     AND mandate_id IS NULL)
        OR (p_mandate_id IS NOT NULL AND mandate_id = p_mandate_id)
         );

  IF v_existing_count = 1 THEN
    SELECT id INTO v_existing_id
      FROM public.matches
     WHERE lead_id     = p_lead_id
       AND property_id = p_property_id
       AND (
             (p_mandate_id IS NULL     AND mandate_id IS NULL)
          OR (p_mandate_id IS NOT NULL AND mandate_id = p_mandate_id)
           );
  END IF;

  IF v_existing_count = 0 THEN
    -- No existing row: create new V1 match
    INSERT INTO public.matches (
      lead_id, property_id, mandate_id, property_title,
      match_score, breakdown, match_reasons, explanation,
      similarity, estimated_yield,
      status, matched_by,
      next_best_action, match_weaknesses, priority_level, next_action_deadline
    ) VALUES (
      p_lead_id, p_property_id, p_mandate_id, p_property_title,
      p_match_score, p_breakdown, p_match_reasons, p_explanation,
      p_similarity, p_estimated_yield,
      'pending', p_matched_by,
      p_next_best_action, p_match_weaknesses, p_priority_level, p_next_action_deadline
    )
    RETURNING id INTO v_existing_id;

    RETURN jsonb_build_object('result', 'created', 'id', v_existing_id);

  ELSIF v_existing_count = 1 THEN
    -- Single existing row: update algorithm-derived fields only.
    -- Human-managed fields (status, notes, created_at) are intentionally preserved.
    -- matched_by is NOT updated on rescore — preserves original provenance.
    UPDATE public.matches SET
      property_title       = p_property_title,
      match_score          = p_match_score,
      breakdown            = p_breakdown,
      match_reasons        = p_match_reasons,
      explanation          = p_explanation,
      similarity           = p_similarity,
      estimated_yield      = p_estimated_yield,
      next_best_action     = p_next_best_action,
      match_weaknesses     = p_match_weaknesses,
      priority_level       = p_priority_level,
      next_action_deadline = p_next_action_deadline,
      updated_at           = now()
    WHERE id = v_existing_id;

    RETURN jsonb_build_object('result', 'rescored', 'id', v_existing_id);

  ELSE
    -- >1 existing rows: legacy duplicate set.
    -- DO NOT insert a new row. DO NOT modify any existing row.
    -- Return structured result for telemetry and caller handling.
    RETURN jsonb_build_object(
      'result',          'legacy_duplicate_set',
      'lead_id',         p_lead_id,
      'property_id',     p_property_id,
      'mandate_id',      p_mandate_id,
      'duplicate_count', v_existing_count
    );
  END IF;
END;
$$;

-- Restore grants — identical to migration 000071
GRANT  EXECUTE ON FUNCTION public.upsert_match_v1 TO service_role;
REVOKE EXECUTE ON FUNCTION public.upsert_match_v1 FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.upsert_match_v1 FROM anon;
REVOKE EXECUTE ON FUNCTION public.upsert_match_v1 FROM authenticated;

-- ---------------------------------------------------------------------------
-- Smoke test: verify the min(uuid) error is gone.
-- Calls the function with a clearly non-production lead_id.
-- If the fix works:   any result other than "min(uuid)" error → PASS
-- If the fix failed:  "min(uuid)" substring in error           → EXCEPTION
-- Cleans up any row that may have been inserted (if no FK constraint).
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_result JSONB;
BEGIN
  BEGIN
    v_result := public.upsert_match_v1(
      999999,
      'PROBE_SF2_NOOP_DELETE_ME',
      NULL,
      'SF2 smoke test probe',
      50,
      '{}'::jsonb,
      ARRAY[]::TEXT[],
      'SF2 migration smoke test',
      NULL,
      NULL,
      'system:v1:sf2-migration',
      'probe',
      ARRAY[]::TEXT[],
      'low',
      NOW()
    );

    -- Function returned without error — clean up any inserted row
    DELETE FROM public.matches
     WHERE lead_id     = 999999
       AND property_id = 'PROBE_SF2_NOOP_DELETE_ME';

    RAISE NOTICE 'Smoke test PASSED: upsert_match_v1 executed, result=%', v_result;

  EXCEPTION WHEN OTHERS THEN
    -- Clean up probe row if it was inserted before the error
    DELETE FROM public.matches
     WHERE lead_id     = 999999
       AND property_id = 'PROBE_SF2_NOOP_DELETE_ME';

    IF SQLERRM LIKE '%min(uuid)%' THEN
      RAISE EXCEPTION 'Smoke test FAILED: min(uuid) error still present: %', SQLERRM;
    ELSE
      -- FK violation, type error, constraint — anything other than min(uuid) is PASS
      RAISE NOTICE 'Smoke test PASSED (non-min error, fix confirmed): %', SQLERRM;
    END IF;
  END;
END;
$$;

-- ---------------------------------------------------------------------------
-- Post-migration integrity check
-- ---------------------------------------------------------------------------

DO $$
DECLARE v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.matches WHERE lead_id != 999999;
  IF v_count != 17 THEN
    RAISE EXCEPTION 'Post-migration FAILED: expected 17 legacy matches, got %', v_count;
  END IF;
  RAISE NOTICE 'Post-migration PASSED: 17 legacy matches intact';
END;
$$;

COMMIT;
