-- =============================================================================
-- Migration 060: Geography Level Correction
-- Adds AUTONOMOUS_REGION to the level CHECK constraint on geography_nodes.
-- Updates the 2 rows incorrectly classified as DISTRICT.
--
-- Test project: felxvahczmrrvfqrbvyp ONLY
-- Production: FORBIDDEN until explicit gate
-- Idempotent: safe to re-run
-- =============================================================================

-- Step 1: Drop the existing level CHECK constraint (name may vary)
DO $$
DECLARE v_conname TEXT;
BEGIN
  SELECT conname INTO v_conname
  FROM pg_constraint
  WHERE conrelid = 'public.geography_nodes'::regclass
    AND contype = 'c'
    AND conname LIKE '%level%';
  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.geography_nodes DROP CONSTRAINT %I', v_conname);
  END IF;
END $$;

-- Step 2: Add new level CHECK with AUTONOMOUS_REGION included
ALTER TABLE public.geography_nodes
  ADD CONSTRAINT geography_nodes_level_check
  CHECK (level IN ('COUNTRY', 'DISTRICT', 'MUNICIPALITY', 'PARISH', 'ZONE', 'AUTONOMOUS_REGION'));

-- Step 3: Update the 2 Autonomous Region rows
UPDATE public.geography_nodes
SET level = 'AUTONOMOUS_REGION'
WHERE level = 'DISTRICT'
  AND name_pt LIKE 'Região Autónoma%';

-- Verification
DO $$
DECLARE v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.geography_nodes
  WHERE level = 'AUTONOMOUS_REGION';
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'Geography correction failed: expected 2 AUTONOMOUS_REGION rows, found %', v_count;
  END IF;
END $$;
