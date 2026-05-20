-- =============================================================================
-- Wave 17 — learning_events: DB-level idempotency key
-- Migration: 20260522000001_learning_events_idempotency.sql
-- =============================================================================
--
-- PROBLEM:
--   lib/trackLearningEvent.ts uses an in-process Map (30s TTL) as dedup guard.
--   On Vercel (multi-instance), each cold start has its own Map. Parallel requests
--   or retries from different instances bypass the guard entirely, creating duplicate
--   deal_created / cpcv_signed / closed events that corrupt ML training data and
--   revenue attribution aggregates.
--
--   The migration referenced in trackLearningEvent.ts comments
--   ('20260430_002_event_idempotency.sql') never existed.
--
-- FIX:
--   1. Add idempotency_key TEXT column to learning_events (idempotent — IF NOT EXISTS)
--   2. Add UNIQUE index on idempotency_key WHERE NOT NULL (partial — only applies when key
--      is supplied, existing rows without a key are unaffected)
--   3. trackLearningEvent callers should set idempotency_key = SHA256(event_type+entity_id)
--      or a supplied X-Idempotency-Key header. Rows with idempotency_key=NULL are
--      still inserted as before (no breaking change).
--
-- SAFE: Column is nullable, partial index only. Zero downtime. No existing rows affected.
-- =============================================================================

ALTER TABLE learning_events
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Partial unique index: only deduplicates rows that carry an explicit idempotency_key.
-- Rows with idempotency_key IS NULL are still freely inserted (backward compatible).
CREATE UNIQUE INDEX IF NOT EXISTS
  idx_learning_events_idempotency_key
  ON learning_events (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Index for fast lookup by event_type + tenant (used by anomaly-monitor + replay-dlq)
CREATE INDEX IF NOT EXISTS
  idx_learning_events_type_tenant
  ON learning_events (event_type, tenant_id)
  WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN learning_events.idempotency_key IS
  'Optional SHA-256(event_type||entity_id||caller_ref) for cross-instance dedup. '
  'NULL = legacy insert (no dedup). UNIQUE WHERE NOT NULL. '
  'Set by trackLearningEvent or eventBus producers at emit time.';
