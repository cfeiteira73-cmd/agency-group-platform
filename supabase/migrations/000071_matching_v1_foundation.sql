-- =============================================================================
-- Phase 2C.C1 — V1 Matching Foundation (Non-Destructive)
-- 000071_matching_v1_foundation.sql
--
-- Changes:
--   1. mandate_id nullable FK on matches (NULL for all V1 contact-level matches)
--   2. Partial unique index protecting mandate-level match identities only
--      (WHERE mandate_id IS NOT NULL — excludes legacy rows, no deletions needed)
--   3. upsert_match_v1() — race-safe advisory-lock persistence function
--
-- INVARIANTS (never violated):
--   All 17 legacy rows are preserved exactly as-is.
--   No historical data deleted, modified, or merged.
--   Contact-level V1 concurrency: advisory lock in upsert_match_v1
--   Mandate-level V1 uniqueness: partial DB unique index
--   Legacy duplicate sets: detected and returned; never mutated.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Pre-flight checks — abort if preconditions fail
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  -- Verify legacy row count is still 17
  IF (SELECT COUNT(*) FROM public.matches) != 17 THEN
    RAISE EXCEPTION 'Pre-flight failed: expected 17 legacy matches, got %',
      (SELECT COUNT(*) FROM public.matches);
  END IF;

  -- Verify mandate_id does not already exist
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'matches'
      AND column_name  = 'mandate_id'
  ) THEN
    RAISE NOTICE 'mandate_id already exists — skipping ADD COLUMN';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 1. Add mandate_id nullable FK
--    NULL for all V1 contact-level matches
--    Non-NULL for future Phase 2C.C2 mandate-driven matches
-- ---------------------------------------------------------------------------

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS mandate_id UUID
    REFERENCES public.demand_mandates(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 2. Partial unique index — mandate-level match identity only
--    Scope: WHERE mandate_id IS NOT NULL
--    Legacy rows (mandate_id IS NULL) are deliberately excluded.
--    This protects future mandate-level match pairs without touching legacy data.
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_unique_mandate_identity
  ON public.matches (lead_id, property_id, mandate_id)
  WHERE mandate_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. upsert_match_v1 — race-safe V1 persistence function
--
--    Algorithm:
--      a) Acquire transaction-scoped advisory lock keyed by match identity
--         (XOR of lead_id + hash of property_id:mandate_id)
--         False-positive lock collisions cause harmless serialization only.
--      b) Count existing rows for this canonical identity
--      c) 0 rows  → INSERT new V1 match, return {result: 'created', id}
--      d) 1 row   → UPDATE algorithm-derived fields only (preserve human fields)
--                   return {result: 'rescored', id}
--      e) >1 rows → Legacy duplicate set: return structured result, NO mutation
--                   return {result: 'legacy_duplicate_set', ...}
--
--    Human-managed fields NEVER overwritten by upsert:
--      status, matched_by (on rescore), notes, created_at
--
--    Caller: supabaseAdmin (service role) via TypeScript rpc()
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

  -- Count existing rows for this canonical match identity
  SELECT COUNT(*), MIN(id)
    INTO v_existing_count, v_existing_id
    FROM public.matches
   WHERE lead_id     = p_lead_id
     AND property_id = p_property_id
     AND (
           (p_mandate_id IS NULL     AND mandate_id IS NULL)
        OR (p_mandate_id IS NOT NULL AND mandate_id = p_mandate_id)
         );

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

-- Grant to service role only — public/anon must not invoke this function
GRANT  EXECUTE ON FUNCTION public.upsert_match_v1 TO service_role;
REVOKE EXECUTE ON FUNCTION public.upsert_match_v1 FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.upsert_match_v1 FROM anon;
REVOKE EXECUTE ON FUNCTION public.upsert_match_v1 FROM authenticated;

-- ---------------------------------------------------------------------------
-- Post-migration integrity check
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_count     INTEGER;
  v_mandate_nulls INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.matches;
  IF v_count != 17 THEN
    RAISE EXCEPTION 'Post-migration check FAILED: expected 17 matches, got %', v_count;
  END IF;

  -- All existing rows should have mandate_id = NULL after ADD COLUMN
  SELECT COUNT(*) INTO v_mandate_nulls
    FROM public.matches WHERE mandate_id IS NOT NULL;
  IF v_mandate_nulls != 0 THEN
    RAISE EXCEPTION 'Post-migration check FAILED: expected 0 non-null mandate_ids, got %', v_mandate_nulls;
  END IF;

  RAISE NOTICE 'Post-migration check PASSED: % matches, all mandate_id = NULL', v_count;
END;
$$;

COMMIT;
