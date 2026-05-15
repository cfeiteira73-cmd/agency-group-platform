-- =============================================================================
-- AGENCY GROUP — SH-ROS Migration 019: Distributed Infrastructure
-- Ω∞ Phase C — Multi-region workers, shard assignments, economic signals
-- AMI: 22506 | Safe additive migration — all new tables, no existing table changes
-- =============================================================================

-- ─── PART A: worker_registrations ─────────────────────────────────────────────
-- Tracks all registered distributed workers across regions
CREATE TABLE IF NOT EXISTS worker_registrations (
  id               uuid            DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id        text            NOT NULL UNIQUE,
  region           text            NOT NULL,
  partition_count  integer         NOT NULL DEFAULT 0,
  is_healthy       boolean         NOT NULL DEFAULT true,
  error_rate       numeric(5,4)    NOT NULL DEFAULT 0.0,
  last_heartbeat   timestamptz     NOT NULL DEFAULT now(),
  registered_at    timestamptz     NOT NULL DEFAULT now(),
  metadata         jsonb
);

CREATE INDEX IF NOT EXISTS idx_worker_reg_region
  ON worker_registrations(region);

CREATE INDEX IF NOT EXISTS idx_worker_reg_healthy
  ON worker_registrations(is_healthy) WHERE is_healthy = true;

CREATE INDEX IF NOT EXISTS idx_worker_reg_heartbeat
  ON worker_registrations(last_heartbeat DESC);

ALTER TABLE worker_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "worker_registrations_service_only" ON worker_registrations;
CREATE POLICY "worker_registrations_service_only" ON worker_registrations
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);
-- service_role (supabaseAdmin) bypasses RLS automatically

-- ─── PART B: shard_assignments ────────────────────────────────────────────────
-- Tracks which worker owns which partition shard
CREATE TABLE IF NOT EXISTS shard_assignments (
  id               uuid            DEFAULT gen_random_uuid() PRIMARY KEY,
  shard_id         integer         NOT NULL,  -- 0–127 (FNV-1a partitions)
  worker_id        text            NOT NULL,
  region           text            NOT NULL,
  assigned_at      timestamptz     NOT NULL DEFAULT now(),
  UNIQUE(shard_id)
);

CREATE INDEX IF NOT EXISTS idx_shard_worker
  ON shard_assignments(worker_id);

CREATE INDEX IF NOT EXISTS idx_shard_region
  ON shard_assignments(region);

ALTER TABLE shard_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shard_assignments_service_only" ON shard_assignments;
CREATE POLICY "shard_assignments_service_only" ON shard_assignments
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- ─── PART C: economic_signals ─────────────────────────────────────────────────
-- Persisted economic signals after noise filtering
CREATE TABLE IF NOT EXISTS economic_signals (
  id               uuid            DEFAULT gen_random_uuid() PRIMARY KEY,
  signal_id        text            NOT NULL UNIQUE,
  org_id           text            NOT NULL,
  source           text            NOT NULL,  -- deal_closed, match_created, etc.
  entity_type      text            NOT NULL,  -- deal | match | property | contact
  entity_id        text            NOT NULL,
  raw_value        numeric(12,4)   NOT NULL,
  normalized_value numeric(8,6),              -- 0.0–1.0 after normalization
  noise_score      numeric(5,4),              -- 0.0–1.0 (lower = cleaner)
  passed_filter    boolean         NOT NULL DEFAULT true,
  ingested_at      timestamptz     NOT NULL DEFAULT now(),
  context          jsonb
);

CREATE INDEX IF NOT EXISTS idx_econ_signals_org
  ON economic_signals(org_id, ingested_at DESC);

CREATE INDEX IF NOT EXISTS idx_econ_signals_entity
  ON economic_signals(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_econ_signals_source
  ON economic_signals(source);

CREATE INDEX IF NOT EXISTS idx_econ_signals_passed
  ON economic_signals(passed_filter) WHERE passed_filter = true;

ALTER TABLE economic_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "economic_signals_service_only" ON economic_signals;
CREATE POLICY "economic_signals_service_only" ON economic_signals
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- ─── PART D: learning_snapshots ───────────────────────────────────────────────
-- Point-in-time snapshots of learning metrics for regression gating
CREATE TABLE IF NOT EXISTS learning_snapshots (
  id               uuid            DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_id      text            NOT NULL UNIQUE,
  org_id           text            NOT NULL,
  match_precision  numeric(6,5),   -- 0.0–1.0
  close_rate_lift  numeric(6,5),
  revenue_per_pred numeric(12,4),
  false_pos_rate   numeric(6,5),
  calibration_err  numeric(6,5),
  reward_mean      numeric(8,6),
  reward_std       numeric(8,6),
  sample_count     integer         NOT NULL DEFAULT 0,
  update_applied   boolean         NOT NULL DEFAULT false,
  created_at       timestamptz     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learning_snap_org
  ON learning_snapshots(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_learning_snap_applied
  ON learning_snapshots(update_applied);

ALTER TABLE learning_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "learning_snapshots_service_only" ON learning_snapshots;
CREATE POLICY "learning_snapshots_service_only" ON learning_snapshots
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- ─── PART E: failover_log ─────────────────────────────────────────────────────
-- Audit log for all regional failover events
CREATE TABLE IF NOT EXISTS failover_log (
  id               uuid            DEFAULT gen_random_uuid() PRIMARY KEY,
  failover_id      text            NOT NULL UNIQUE,
  from_region      text            NOT NULL,
  to_region        text            NOT NULL,
  trigger          text            NOT NULL,  -- circuit_open | latency_spike | manual
  started_at       timestamptz     NOT NULL DEFAULT now(),
  resolved_at      timestamptz,
  duration_ms      integer,
  outcome          text,           -- success | partial | failed
  metadata         jsonb
);

CREATE INDEX IF NOT EXISTS idx_failover_log_regions
  ON failover_log(from_region, to_region);

CREATE INDEX IF NOT EXISTS idx_failover_log_time
  ON failover_log(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_failover_log_unresolved
  ON failover_log(resolved_at) WHERE resolved_at IS NULL;

ALTER TABLE failover_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "failover_log_service_only" ON failover_log;
CREATE POLICY "failover_log_service_only" ON failover_log
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- =============================================================================
-- Migration 019 complete — 5 new tables, all RLS-protected (service_role only)
-- worker_registrations · shard_assignments · economic_signals
-- learning_snapshots · failover_log
-- =============================================================================
