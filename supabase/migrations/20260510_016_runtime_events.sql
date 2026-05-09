-- =============================================================================
-- AGENCY GROUP — Migration 016: runtime_events (SH-ROS Durable Event Queue)
-- Persist-before-execute event sourcing table with queue semantics
-- AMI: 22506 | SH-ROS Production Runtime
-- =============================================================================

-- ─── A. runtime_events — immutable event log + queue ─────────────────────────

CREATE TABLE IF NOT EXISTS runtime_events (
  event_id        uuid        NOT NULL DEFAULT gen_random_uuid(),
  org_id          text        NOT NULL,
  type            text        NOT NULL,
  status          text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','processing','completed','failed','dlq')),
  priority        text        NOT NULL DEFAULT 'medium'
                              CHECK (priority IN ('low','medium','high','critical')),
  retry_count     int         NOT NULL DEFAULT 0,
  correlation_id  text        NOT NULL,
  trace_id        text        NOT NULL,
  source_system   text        NOT NULL
                              CHECK (source_system IN ('api','n8n','cron','agent','engine','portal')),
  schema_version  text        NOT NULL DEFAULT 'vFINAL',
  payload         jsonb       NOT NULL DEFAULT '{}',
  result          jsonb,
  agents_triggered text[]     NOT NULL DEFAULT '{}',
  agents_completed text[]     NOT NULL DEFAULT '{}',
  agents_failed    text[]     NOT NULL DEFAULT '{}',
  latency_ms      int,
  economic_score  numeric(10,4),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  processed_at    timestamptz,
  completed_at    timestamptz,
  CONSTRAINT runtime_events_pkey PRIMARY KEY (event_id)
);

-- ─── B. Indexes ───────────────────────────────────────────────────────────────

-- Unique idempotency key
CREATE UNIQUE INDEX IF NOT EXISTS runtime_events_event_id_unique
  ON runtime_events (event_id);

-- Primary query pattern: org queue processing
CREATE INDEX IF NOT EXISTS runtime_events_org_status_idx
  ON runtime_events (org_id, status);

-- HOT memory query: org recent events
CREATE INDEX IF NOT EXISTS runtime_events_org_created_idx
  ON runtime_events (org_id, created_at DESC);

-- DLQ monitoring
CREATE INDEX IF NOT EXISTS runtime_events_dlq_idx
  ON runtime_events (status, created_at DESC)
  WHERE status = 'dlq';

-- Retry processing
CREATE INDEX IF NOT EXISTS runtime_events_failed_retry_idx
  ON runtime_events (status, retry_count)
  WHERE status = 'failed' AND retry_count < 3;

-- Type-based routing analytics
CREATE INDEX IF NOT EXISTS runtime_events_type_org_idx
  ON runtime_events (type, org_id, created_at DESC);

-- ─── C. updated_at trigger ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION runtime_events_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS runtime_events_updated_at ON runtime_events;
CREATE TRIGGER runtime_events_updated_at
  BEFORE UPDATE ON runtime_events
  FOR EACH ROW EXECUTE FUNCTION runtime_events_set_updated_at();

-- ─── D. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE runtime_events ENABLE ROW LEVEL SECURITY;

-- Service role (supabaseAdmin) bypasses RLS — no policy needed for backend
-- Portal authenticated users can only see their own org's events
CREATE POLICY "runtime_events_org_isolation"
  ON runtime_events
  FOR ALL
  USING (org_id = current_setting('request.jwt.claims', true)::jsonb->>'org_id');

-- ─── E. WARM memory view (90-day operational window) ─────────────────────────

CREATE OR REPLACE VIEW runtime_events_warm AS
  SELECT *
  FROM   runtime_events
  WHERE  created_at >= now() - INTERVAL '90 days'
  ORDER BY created_at DESC;

-- ─── F. DLQ summary view ─────────────────────────────────────────────────────

CREATE OR REPLACE VIEW runtime_events_dlq AS
  SELECT
    event_id,
    org_id,
    type,
    retry_count,
    correlation_id,
    payload,
    result,
    created_at,
    updated_at
  FROM   runtime_events
  WHERE  status = 'dlq'
  ORDER BY created_at DESC;
