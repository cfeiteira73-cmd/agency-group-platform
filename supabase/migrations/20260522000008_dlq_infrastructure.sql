-- =============================================================================
-- Agency Group — DLQ Infrastructure
-- supabase/migrations/20260522000008_dlq_infrastructure.sql
--
-- Creates the `dlq_messages` table used as a durable fallback when the Kafka
-- DLQ topic is unreachable.  dlqProducer.ts writes here automatically on
-- Kafka failure.  Operators can replay or discard rows via the admin portal.
--
-- RLS: authenticated users cannot read DLQ data; only service_role (backend)
-- can INSERT / UPDATE / SELECT.
-- =============================================================================

-- ─── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dlq_messages (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Origin
  original_topic      text        NOT NULL,
  original_partition  integer     NOT NULL,
  original_offset     text        NOT NULL,
  consumer_group      text        NOT NULL,

  -- Event identity (best-effort extraction from payload)
  event_type          text,
  event_id            text,
  tenant_id           uuid        REFERENCES organizations(id) ON DELETE SET NULL,

  -- Raw payload (full message body, may be partially parseable)
  payload             jsonb       NOT NULL DEFAULT '{}',

  -- Failure metadata
  error_message       text        NOT NULL,
  retry_count         integer     NOT NULL DEFAULT 0,

  -- Lifecycle
  status              text        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'replayed', 'discarded')),
  failed_at           timestamptz NOT NULL DEFAULT now(),
  replayed_at         timestamptz,

  -- Deduplication (prevents double-insert on retried fallback calls)
  idempotency_key     text        UNIQUE
);

COMMENT ON TABLE dlq_messages IS
  'Durable fallback storage for Kafka DLQ messages when Redpanda is unreachable. '
  'Written by lib/events/dlqProducer.ts. Replay via admin portal or cron job.';

COMMENT ON COLUMN dlq_messages.status IS
  'pending = awaiting replay; replayed = successfully reprocessed; discarded = manually rejected';

-- ─── Indexes ──────────────────────────────────────────────────────────────────

-- Primary operational query: list pending failures by topic, newest first
CREATE INDEX IF NOT EXISTS idx_dlq_topic_status
  ON dlq_messages (original_topic, status, failed_at DESC);

-- Tenant-scoped queries (per-tenant support investigation)
CREATE INDEX IF NOT EXISTS idx_dlq_tenant
  ON dlq_messages (tenant_id, failed_at DESC)
  WHERE tenant_id IS NOT NULL;

-- Consumer group monitoring
CREATE INDEX IF NOT EXISTS idx_dlq_consumer_group
  ON dlq_messages (consumer_group, status, failed_at DESC);

-- Pending replay queue (partial index — only un-processed rows)
CREATE INDEX IF NOT EXISTS idx_dlq_pending
  ON dlq_messages (failed_at ASC)
  WHERE status = 'pending';

-- ─── Row-Level Security ───────────────────────────────────────────────────────

ALTER TABLE dlq_messages ENABLE ROW LEVEL SECURITY;

-- No authenticated user policies: DLQ data is internal infrastructure.
-- Only service_role (bypasses RLS) and postgres superuser can access rows.

-- Explicit deny policy for authenticated clients (safety net)
DROP POLICY IF EXISTS dlq_messages_authenticated_deny ON dlq_messages;
CREATE POLICY dlq_messages_authenticated_deny
  ON dlq_messages
  FOR ALL
  TO authenticated
  USING (false);

-- service_role bypass is implicit in Supabase (RLS is skipped for service_role).
-- The backend (dlqProducer.ts) always uses SUPABASE_SERVICE_ROLE_KEY.

-- ─── Grant ────────────────────────────────────────────────────────────────────

-- service_role has superuser-equivalent grants in Supabase by default.
-- Explicit grants here for clarity and forward-compatibility with Supabase v3.
GRANT SELECT, INSERT, UPDATE ON dlq_messages TO service_role;

-- ─── Replay helper function ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION mark_dlq_replayed(p_id uuid, p_replayed_at timestamptz DEFAULT now())
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE dlq_messages
     SET status      = 'replayed',
         replayed_at = p_replayed_at
   WHERE id = p_id
     AND status = 'pending';
END;
$$;

COMMENT ON FUNCTION mark_dlq_replayed IS
  'Marks a DLQ message as replayed. Called by the replay job after successful reprocessing.';

GRANT EXECUTE ON FUNCTION mark_dlq_replayed TO service_role;

-- ─── Discard helper function ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION mark_dlq_discarded(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE dlq_messages
     SET status = 'discarded'
   WHERE id = p_id
     AND status = 'pending';
END;
$$;

COMMENT ON FUNCTION mark_dlq_discarded IS
  'Marks a DLQ message as discarded (will not be replayed). '
  'Use for schema_invalid messages that require a code fix.';

GRANT EXECUTE ON FUNCTION mark_dlq_discarded TO service_role;
