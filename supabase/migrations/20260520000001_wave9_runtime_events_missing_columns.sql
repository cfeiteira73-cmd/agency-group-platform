-- =============================================================================
-- Wave 9: Add missing columns to runtime_events table
-- Fixes critical schema drift: priority_weight, last_error, agent_id
-- are written by dbFallbackProvider, queueDeadLetter, queueReplayWorker
-- but were absent from all migrations.
-- Also adds columns that migration 016 expected but 20260521000002 omitted.
-- =============================================================================

ALTER TABLE public.runtime_events
  ADD COLUMN IF NOT EXISTS priority_weight   int           NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS last_error        text,
  ADD COLUMN IF NOT EXISTS agent_id          text,
  ADD COLUMN IF NOT EXISTS trace_id          text,
  ADD COLUMN IF NOT EXISTS source_system     text,
  ADD COLUMN IF NOT EXISTS schema_version    text          NOT NULL DEFAULT 'vFINAL',
  ADD COLUMN IF NOT EXISTS agents_completed  text[]        NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS economic_score    numeric(10,4),
  ADD COLUMN IF NOT EXISTS processed_at      timestamptz;

-- Back-fill priority_weight from existing priority text column (if it exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'runtime_events' AND column_name = 'priority'
  ) THEN
    UPDATE public.runtime_events
    SET priority_weight = CASE priority
      WHEN 'critical' THEN 4
      WHEN 'high'     THEN 3
      WHEN 'medium'   THEN 2
      ELSE 1
    END
    WHERE priority_weight = 2 AND priority IS NOT NULL;
  END IF;
END $$;

-- Index for atomic dequeue ordering (priority DESC, oldest first)
CREATE INDEX IF NOT EXISTS idx_runtime_events_priority_dequeue
  ON public.runtime_events (org_id, status, priority_weight DESC, created_at ASC)
  WHERE status = 'pending';

-- Atomic dequeue RPC to prevent double-processing race condition
-- Replaces the non-atomic SELECT + UPDATE in dbFallbackProvider.ts
CREATE OR REPLACE FUNCTION public.dequeue_runtime_events(
  p_org_id  text,
  p_count   int DEFAULT 10
)
RETURNS SETOF public.runtime_events
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH claimed AS (
    SELECT event_id
    FROM   public.runtime_events
    WHERE  org_id = p_org_id
      AND  status = 'pending'
    ORDER  BY priority_weight DESC, created_at ASC
    LIMIT  p_count
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.runtime_events re
  SET    status     = 'processing',
         updated_at = now()
  FROM   claimed
  WHERE  re.event_id = claimed.event_id
  RETURNING re.*;
$$;

-- Fix event_history cross-tenant RLS leak (all authenticated users could read all rows)
-- Drop permissive policy and replace with tenant-scoped one
DROP POLICY IF EXISTS "authenticated_read_event_history" ON public.event_history;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'event_history' AND column_name = 'tenant_id') THEN
    EXECUTE $policy$
      CREATE POLICY "tenant_scoped_read_event_history"
        ON public.event_history
        FOR SELECT TO authenticated
        USING (tenant_id = current_setting('app.tenant_id', true))
    $policy$;
  ELSE
    -- No tenant_id column: fall back to denying public access
    EXECUTE $policy$
      CREATE POLICY "deny_crossteant_event_history"
        ON public.event_history
        FOR SELECT TO authenticated
        USING (false)
    $policy$;
  END IF;
END $$;
