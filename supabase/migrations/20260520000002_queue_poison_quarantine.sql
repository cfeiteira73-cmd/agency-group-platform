-- =============================================================================
-- Wave 9 follow-up: Create queue_poison_quarantine table
-- Required by lib/security/queuePoisonProtection.ts
-- Stores poison messages that repeatedly fail processing
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.queue_poison_quarantine (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  original_id       TEXT        NOT NULL,
  queue_name        TEXT        NOT NULL,
  org_id            TEXT        NOT NULL DEFAULT 'agency-group',
  payload           JSONB,
  failure_reason    TEXT,
  failure_count     INT         NOT NULL DEFAULT 1,
  first_seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved          BOOLEAN     NOT NULL DEFAULT false,
  resolved_at       TIMESTAMPTZ,
  resolved_by       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: one quarantine record per (original_id, queue_name)
CREATE UNIQUE INDEX IF NOT EXISTS uq_queue_poison_quarantine_orig_queue
  ON public.queue_poison_quarantine (original_id, queue_name);

-- Index for listing unresolved messages (primary query pattern)
CREATE INDEX IF NOT EXISTS idx_queue_poison_unresolved
  ON public.queue_poison_quarantine (queue_name, resolved, last_seen_at DESC)
  WHERE resolved = false;

-- Index for org-scoped queries
CREATE INDEX IF NOT EXISTS idx_queue_poison_org
  ON public.queue_poison_quarantine (org_id, resolved);

-- RLS: service_role only (poison queue is internal-only)
ALTER TABLE public.queue_poison_quarantine ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_poison_quarantine"
  ON public.queue_poison_quarantine
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_queue_poison_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_queue_poison_updated_at ON public.queue_poison_quarantine;
CREATE TRIGGER trg_queue_poison_updated_at
  BEFORE UPDATE ON public.queue_poison_quarantine
  FOR EACH ROW EXECUTE FUNCTION public.update_queue_poison_updated_at();
