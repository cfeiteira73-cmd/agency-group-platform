-- =============================================================================
-- AGENCY GROUP — SH-ROS Migration 017: runtime_events patch
-- Adds event_timestamp (original event timestamp) and event_chain (queryable column)
-- AMI: 22506 | SH-ROS Production Runtime
-- Safe to run multiple times (IF NOT EXISTS guards on columns)
-- =============================================================================

-- ─── Add event_timestamp column ───────────────────────────────────────────────
-- Stores the original event timestamp from the RuntimeEvent contract.
-- created_at is the DB row insertion time; event_timestamp is what the emitter set.
-- Both are preserved for observability and replay.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'runtime_events'
      AND column_name  = 'event_timestamp'
  ) THEN
    ALTER TABLE public.runtime_events
      ADD COLUMN event_timestamp timestamptz NULL;

    COMMENT ON COLUMN public.runtime_events.event_timestamp
      IS 'Original event timestamp from RuntimeEvent.timestamp (emitter wall-clock). '
         'created_at is the DB insert time. Both are kept for replay and latency analysis.';
  END IF;
END $$;

-- ─── Add event_chain column ───────────────────────────────────────────────────
-- Queryable array of event_id values that form the causality chain.
-- Enables tracing which events triggered follow-up events through the system.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'runtime_events'
      AND column_name  = 'event_chain'
  ) THEN
    ALTER TABLE public.runtime_events
      ADD COLUMN event_chain text[] NOT NULL DEFAULT '{}';

    COMMENT ON COLUMN public.runtime_events.event_chain
      IS 'Ordered array of event_id values from the originating event to this one. '
         'Allows querying the full causality chain via array containment operators.';
  END IF;
END $$;

-- ─── Index: event_chain containment queries ───────────────────────────────────
-- Enables efficient @> queries: "find all events in chain X"

CREATE INDEX IF NOT EXISTS idx_runtime_events_event_chain
  ON public.runtime_events USING gin (event_chain);

-- ─── Index: event_timestamp range queries ────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_runtime_events_event_timestamp
  ON public.runtime_events (org_id, event_timestamp)
  WHERE event_timestamp IS NOT NULL;

-- ─── Backfill: set event_timestamp = created_at for existing rows ─────────────
-- Approximate only — existing rows don't have the original emitter timestamp.
-- New rows inserted by the orchestrator will have the correct value.

UPDATE public.runtime_events
SET event_timestamp = created_at
WHERE event_timestamp IS NULL;

-- After backfill complete, we do NOT add NOT NULL — historical data is approximate.
-- The orchestrator sets event_timestamp on all new inserts from this point forward.

-- =============================================================================
-- Verify
-- =============================================================================
DO $$
DECLARE
  col_count int;
BEGIN
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'runtime_events'
    AND column_name  IN ('event_timestamp', 'event_chain');

  IF col_count < 2 THEN
    RAISE EXCEPTION 'Migration 017 failed: expected 2 new columns, found %', col_count;
  END IF;
END $$;

-- Migration complete ✓
