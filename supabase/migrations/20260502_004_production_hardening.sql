-- =============================================================================
-- Agency Group — Production Hardening Layer
-- 20260502_004_production_hardening.sql
--
-- Implements:
--   Phase 1: Operational Control (deal_review_queue, distribution_controls, sla_tracking)
--   Phase 2: Observability (system_alerts, job_queue)
--   Phase 3: Data Quality (data_quality_flags)
--   Phase 4: Commercial Operations (revenue_attribution, commission_records, partner_tiers)
--   Phase 5: Governance (admin_roles, audit_log)
--
-- IDEMPOTENT: all DDL uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
-- ROLLBACK: see 20260502_004_rollback.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Phase 1a — Deal Review Queue
-- Manual approval gate for high-value / critical deals before distribution
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS deal_review_queue (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Property context
  property_id           TEXT        NOT NULL,
  opportunity_score     INTEGER,
  opportunity_grade     TEXT,
  distribution_tier     TEXT,
  -- Routing decision (from routeDeal)
  routing_decision      JSONB       DEFAULT NULL,
  -- Queue lifecycle
  status                TEXT        NOT NULL DEFAULT 'pending',  -- pending/approved/rejected/overridden
  queued_reason         TEXT,                                     -- why it was queued (auto_grade_aplus/manual/etc.)
  auto_queued           BOOLEAN     NOT NULL DEFAULT false,
  -- Review outcome
  reviewer_email        TEXT,
  reviewed_at           TIMESTAMPTZ,
  override_score        INTEGER,
  override_routing      JSONB,
  review_notes          TEXT,
  -- Timestamps
  queued_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drq_status_queued
  ON deal_review_queue (status, queued_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_drq_property
  ON deal_review_queue (property_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Phase 1b — Distribution Controls
-- Pause/resume distribution globally or by zone/tier/asset_type
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS distribution_controls (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Scope
  control_type          TEXT        NOT NULL,    -- global/zone/asset_type/tier
  zone_key              TEXT,                    -- NULL = all zones
  asset_type            TEXT,                    -- NULL = all types
  tier                  TEXT,                    -- NULL = all tiers; A+/A/B
  -- State
  status                TEXT        NOT NULL DEFAULT 'active',   -- active/paused
  reason                TEXT,
  controlled_by         TEXT,
  activated_at          TIMESTAMPTZ,
  deactivated_at        TIMESTAMPTZ,
  -- Timestamps
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Uniqueness: only one control per scope combination
  CONSTRAINT uq_distribution_control UNIQUE (control_type, zone_key, asset_type, tier)
);

CREATE INDEX IF NOT EXISTS idx_dc_status_type
  ON distribution_controls (status, control_type);

-- ---------------------------------------------------------------------------
-- Phase 1c — SLA Tracking
-- Response time tracking for agents/investors/review queue
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sla_tracking (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Event context
  sla_type              TEXT        NOT NULL,    -- agent_response/investor_response/review_queue
  distribution_event_id UUID,
  review_queue_id       UUID,
  property_id           TEXT,
  -- Target
  target_email          TEXT,
  -- SLA config
  sla_threshold_hours   INTEGER     NOT NULL DEFAULT 24,
  -- Timestamps
  started_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_response_at     TIMESTAMPTZ,
  -- Status
  status                TEXT        NOT NULL DEFAULT 'pending',  -- pending/met/breached/na
  breach_alerted        BOOLEAN     NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sla_status_type
  ON sla_tracking (status, sla_type, started_at DESC)
  WHERE status = 'pending';

-- ---------------------------------------------------------------------------
-- Phase 2a — System Alerts
-- Platform-level alerting for cron failures, drift, provider outages, etc.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS system_alerts (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Alert content
  alert_type            TEXT        NOT NULL,    -- cron_failure/provider_failure/score_drift/routing_failure/etc.
  severity              TEXT        NOT NULL DEFAULT 'warning',  -- info/warning/critical
  title                 TEXT        NOT NULL,
  message               TEXT,
  context               JSONB       NOT NULL DEFAULT '{}',
  -- Lifecycle
  status                TEXT        NOT NULL DEFAULT 'active',   -- active/acknowledged/resolved
  acknowledged_by       TEXT,
  acknowledged_at       TIMESTAMPTZ,
  resolved_at           TIMESTAMPTZ,
  -- Dedup key: prevents alert spam
  dedup_key             TEXT        UNIQUE,
  -- Timestamps
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sa_status_severity
  ON system_alerts (status, severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sa_alert_type
  ON system_alerts (alert_type, created_at DESC);

-- ---------------------------------------------------------------------------
-- Phase 2b — Job Queue
-- Persistent retry queue for failed async jobs
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS job_queue (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Job definition
  job_type              TEXT        NOT NULL,    -- avm_compute/score_property/send_distribution/etc.
  payload               JSONB       NOT NULL DEFAULT '{}',
  -- Execution state
  status                TEXT        NOT NULL DEFAULT 'pending',  -- pending/running/completed/failed/dead
  attempts              INTEGER     NOT NULL DEFAULT 0,
  max_attempts          INTEGER     NOT NULL DEFAULT 3,
  next_retry_at         TIMESTAMPTZ,
  last_error            TEXT,
  -- Completion
  completed_at          TIMESTAMPTZ,
  result                JSONB,
  -- Timestamps
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jq_status_retry
  ON job_queue (status, next_retry_at ASC)
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_jq_job_type
  ON job_queue (job_type, created_at DESC);

-- ---------------------------------------------------------------------------
-- Phase 3 — Data Quality Flags
-- Anomaly flags raised during ingestion/scoring
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS data_quality_flags (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Context
  property_id           TEXT,
  provider_listing_id   TEXT,
  source_provider       TEXT,
  -- Flag content
  flag_type             TEXT        NOT NULL,    -- price_anomaly/malformed/impossible_avm/score_outlier/duplicate_risk/stale_data
  severity              TEXT        NOT NULL DEFAULT 'warning',  -- info/warning/critical
  details               JSONB       NOT NULL DEFAULT '{}',
  -- Resolution
  status                TEXT        NOT NULL DEFAULT 'open',  -- open/reviewed/resolved/false_positive
  reviewed_by           TEXT,
  reviewed_at           TIMESTAMPTZ,
  resolution_notes      TEXT,
  -- Timestamps
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dqf_status_severity
  ON data_quality_flags (status, severity, created_at DESC)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_dqf_property
  ON data_quality_flags (property_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Phase 4a — Revenue Attribution
-- deal → route → recipient → close attribution chain
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS revenue_attribution (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Deal context
  property_id           TEXT        NOT NULL,
  distribution_event_id UUID,
  -- Attribution
  agent_email           TEXT,
  investor_id           TEXT,
  -- Outcome
  close_status          TEXT,       -- won/lost
  sale_price            NUMERIC(12,2),
  commission_total      NUMERIC(10,2),
  commission_rate       NUMERIC(5,4)  DEFAULT 0.05,   -- 5% AMI 22506
  -- Attribution metadata
  attributed_source     TEXT,       -- which provider the listing came from
  attributed_score_grade TEXT,
  attributed_tier       TEXT,
  distribution_rank     INTEGER,    -- position in routing list
  -- Timestamps
  closed_at             TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_revenue_attribution UNIQUE (property_id, agent_email, investor_id)
);

CREATE INDEX IF NOT EXISTS idx_ra_agent
  ON revenue_attribution (agent_email, closed_at DESC)
  WHERE close_status = 'won';

CREATE INDEX IF NOT EXISTS idx_ra_grade
  ON revenue_attribution (attributed_score_grade, closed_at DESC);

-- ---------------------------------------------------------------------------
-- Phase 4b — Commission Records
-- 50% CPCV + 50% Escritura split tracking (AMI 22506)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS commission_records (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id           TEXT        NOT NULL,
  agent_email           TEXT        NOT NULL,
  -- Commission amounts
  sale_price            NUMERIC(12,2),
  expected_commission   NUMERIC(10,2),      -- sale_price * 5%
  realized_commission   NUMERIC(10,2),
  -- Split configuration
  split_pct             NUMERIC(5,2)  DEFAULT 100.00,  -- % going to this agent
  split_counterpart_email TEXT,
  -- CPCV / Escritura milestones
  cpcv_date             DATE,
  cpcv_amount           NUMERIC(10,2),      -- 50% at CPCV
  escritura_date        DATE,
  escritura_amount      NUMERIC(10,2),      -- 50% at Escritura
  -- Payout status
  payout_status         TEXT        NOT NULL DEFAULT 'pending',  -- pending/partial/paid/cancelled
  paid_at               TIMESTAMPTZ,
  notes                 TEXT,
  -- Timestamps
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_commission_record UNIQUE (property_id, agent_email)
);

CREATE INDEX IF NOT EXISTS idx_cr_agent_status
  ON commission_records (agent_email, payout_status, created_at DESC);

-- ---------------------------------------------------------------------------
-- Phase 4c — Partner Tiers
-- Auto-classified ELITE/PRIORITY/STANDARD/WATCHLIST
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS partner_tiers (
  partner_email         TEXT        PRIMARY KEY,
  partner_type          TEXT        NOT NULL,    -- agent/investor
  tier                  TEXT        NOT NULL DEFAULT 'STANDARD',  -- ELITE/PRIORITY/STANDARD/WATCHLIST
  tier_score            NUMERIC(5,2),
  tier_computed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  criteria              JSONB       NOT NULL DEFAULT '{}',
  previous_tier         TEXT,
  tier_changed_at       TIMESTAMPTZ,
  -- Timestamps
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pt_tier
  ON partner_tiers (tier, tier_computed_at DESC);

-- ---------------------------------------------------------------------------
-- Phase 5a — Admin Roles
-- super_admin / ops_manager / reviewer / analyst
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS admin_roles (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email            TEXT        NOT NULL UNIQUE,
  role                  TEXT        NOT NULL,    -- super_admin/ops_manager/reviewer/analyst
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  granted_by            TEXT,
  granted_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at            TIMESTAMPTZ,
  revoked_by            TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ar_role_active
  ON admin_roles (role, is_active);

-- ---------------------------------------------------------------------------
-- Phase 5b — Audit Log
-- Immutable event trail for all operational overrides and decisions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_log (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Actor
  actor_email           TEXT,
  actor_role            TEXT,       -- role at time of action
  -- Action
  action_type           TEXT        NOT NULL,    -- approve_deal/reject_deal/override_score/pause_distribution/grant_role/etc.
  resource_type         TEXT,       -- deal_review/distribution_event/property/partner_tier/admin_role
  resource_id           TEXT,
  -- State change (optional — for overrides)
  old_value             JSONB,
  new_value             JSONB,
  -- Request context
  ip_address            TEXT,
  user_agent            TEXT,
  -- Timestamp (immutable)
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log is append-only — no updates index
CREATE INDEX IF NOT EXISTS idx_al_actor
  ON audit_log (actor_email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_al_resource
  ON audit_log (resource_type, resource_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_al_action_type
  ON audit_log (action_type, created_at DESC);

-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------

-- Pending review queue with priority (A+ first, oldest first)
CREATE OR REPLACE VIEW v_review_queue_pending AS
SELECT
  id,
  property_id,
  opportunity_score,
  opportunity_grade,
  distribution_tier,
  routing_decision,
  queued_reason,
  auto_queued,
  queued_at,
  -- SLA: flag if pending >2h
  EXTRACT(EPOCH FROM (NOW() - queued_at)) / 3600 AS hours_pending,
  CASE
    WHEN opportunity_grade = 'A+' THEN 1
    WHEN opportunity_grade = 'A'  THEN 2
    ELSE 3
  END AS priority_order
FROM deal_review_queue
WHERE status = 'pending'
ORDER BY priority_order, queued_at ASC;

-- Active distribution controls
CREATE OR REPLACE VIEW v_active_distribution_controls AS
SELECT *
FROM distribution_controls
WHERE status = 'paused';

-- System health summary
CREATE OR REPLACE VIEW v_system_health AS
SELECT
  (SELECT COUNT(*) FROM deal_review_queue WHERE status = 'pending')               AS pending_reviews,
  (SELECT COUNT(*) FROM deal_review_queue
    WHERE status = 'pending'
    AND EXTRACT(EPOCH FROM (NOW() - queued_at)) / 3600 > 2)                       AS overdue_reviews,
  (SELECT COUNT(*) FROM distribution_controls WHERE status = 'paused')            AS paused_controls,
  (SELECT COUNT(*) FROM system_alerts WHERE status = 'active' AND severity = 'critical') AS critical_alerts,
  (SELECT COUNT(*) FROM system_alerts WHERE status = 'active')                    AS total_active_alerts,
  (SELECT COUNT(*) FROM job_queue WHERE status = 'dead')                          AS dead_jobs,
  (SELECT COUNT(*) FROM job_queue WHERE status IN ('pending', 'failed'))          AS queued_jobs,
  (SELECT COUNT(*) FROM data_quality_flags WHERE status = 'open' AND severity = 'critical') AS critical_quality_flags,
  NOW()                                                                             AS checked_at;

-- Revenue summary by grade
CREATE OR REPLACE VIEW v_revenue_by_grade AS
SELECT
  attributed_score_grade AS grade,
  COUNT(*)               AS total_deals,
  COUNT(*) FILTER (WHERE close_status = 'won') AS won,
  ROUND(
    COUNT(*) FILTER (WHERE close_status = 'won')::NUMERIC
    / NULLIF(COUNT(*), 0) * 100, 1
  )                      AS win_rate_pct,
  SUM(commission_total) FILTER (WHERE close_status = 'won') AS total_commission,
  AVG(sale_price)       FILTER (WHERE close_status = 'won') AS avg_sale_price
FROM revenue_attribution
WHERE attributed_score_grade IS NOT NULL
GROUP BY attributed_score_grade
ORDER BY grade;

-- ---------------------------------------------------------------------------
-- RLS Policies for new tables
-- ---------------------------------------------------------------------------

ALTER TABLE deal_review_queue      ENABLE ROW LEVEL SECURITY;
ALTER TABLE distribution_controls  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_tracking           ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_alerts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_queue              ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_quality_flags     ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_attribution    ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_records     ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_tiers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log              ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tables TEXT[] := ARRAY[
    'deal_review_queue', 'distribution_controls', 'sla_tracking',
    'system_alerts', 'job_queue', 'data_quality_flags',
    'revenue_attribution', 'commission_records', 'partner_tiers',
    'admin_roles', 'audit_log'
  ];
  t TEXT;
  policy_name TEXT;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    policy_name := 'service_role_' || t || '_all';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = policy_name
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR ALL TO service_role USING (true) WITH CHECK (true)',
        policy_name, t
      );
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Completion marker
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  RAISE NOTICE '20260502_004_production_hardening.sql applied successfully';
  RAISE NOTICE '11 new tables: deal_review_queue, distribution_controls, sla_tracking,';
  RAISE NOTICE '  system_alerts, job_queue, data_quality_flags, revenue_attribution,';
  RAISE NOTICE '  commission_records, partner_tiers, admin_roles, audit_log';
END $$;
