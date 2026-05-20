-- =============================================================================
-- Agency Group · Migration 20260521000001
-- audit_log — Add Security-Event Columns
--
-- PURPOSE:
--   The audit_log table was originally designed as a diff-log (table_name,
--   operation, record_id, old_data, new_data). The observability layer
--   (unifiedTimeline.ts, ai-timeline page) also needs security-event columns
--   (action, actor_id, resource_type, result, risk_level, metadata) that were
--   never added to the original DDL.
--
--   This migration is ADDITIVE and NON-BREAKING — every new column is nullable
--   with a safe default. Existing trigger-written rows (which use the diff-log
--   columns) are unaffected.
--
-- COLUMN MAPPING:
--   diff-log origin      security-event alias
--   ─────────────────    ─────────────────────
--   actor_email          → use directly (already exists)
--   correlation_id UUID  → correlation_id_text TEXT (cast-free alias for joins)
--   table_name / op      → action synthesised at write time; fallback in queries
--
-- SAFETY: All IF NOT EXISTS / CONCURRENTLY — idempotent, zero downtime.
-- =============================================================================

-- ── New security-event columns ────────────────────────────────────────────────

ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS actor_id          TEXT         DEFAULT NULL;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS actor_type        TEXT         DEFAULT NULL;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS action            TEXT         DEFAULT NULL;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS resource_type     TEXT         DEFAULT NULL;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS resource_id       TEXT         DEFAULT NULL;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS result            TEXT         DEFAULT NULL;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS risk_level        TEXT         DEFAULT NULL;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS metadata          JSONB        DEFAULT '{}'::jsonb;

-- correlation_id already exists as UUID — add a TEXT alias so timeline queries
-- can join / filter without casting and without touching the original column.
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS correlation_id_text TEXT       DEFAULT NULL;

-- ── Indexes for timeline queries ──────────────────────────────────────────────

-- AI timeline: fast lookup of ai:execute / ai:deny / ai:escalate rows
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_action
  ON audit_log (action, created_at DESC)
  WHERE action IS NOT NULL;

-- Unified timeline actor lookup via new actor_id column
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_actor_id
  ON audit_log (actor_id, created_at DESC)
  WHERE actor_id IS NOT NULL;

-- Resource-type scoped queries (e.g. all 'ai_call' resources)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_resource_type
  ON audit_log (resource_type, created_at DESC)
  WHERE resource_type IS NOT NULL;

-- correlation_id_text index (complements existing UUID correlation_id index)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_correlation_text
  ON audit_log (correlation_id_text, created_at DESC)
  WHERE correlation_id_text IS NOT NULL;

-- ── Done ─────────────────────────────────────────────────────────────────────
SELECT 'audit_log security columns + indexes added' AS status;
