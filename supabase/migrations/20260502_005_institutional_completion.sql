-- =============================================================================
-- Migration 005: Institutional Completion Sprint
-- Created: 2026-05-02
--
-- New tables:
--   transaction_outcomes        — full economic truth per closed deal
--   negotiation_events          — timeline of negotiation steps
--   opportunity_rejections      — structured rejection taxonomy
--   calibration_recommendations — persisted scoring recommendations (admin workflow)
--   distribution_outcomes       — per-recipient distribution results
--   recipient_performance_profiles — cached aggregated recipient performance
--   feature_flags               — global/subsystem kill-switches + rollout control
--   operator_tasks              — operational task queue + assignments
--   incident_log                — incident lifecycle tracking
--
-- Idempotent: all CREATE TABLE use IF NOT EXISTS
-- Rollback:   see 20260502_005_rollback.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PHASE 1: Economic Truth Capture
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS transaction_outcomes (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id               TEXT NOT NULL,
  distribution_event_id     TEXT,
  agent_email               TEXT,
  investor_id               TEXT,

  -- Prices
  asking_price              NUMERIC(15,2),
  final_sale_price          NUMERIC(15,2),
  avm_value_at_time         NUMERIC(15,2),

  -- Computed deltas (stored for fast analytics)
  negotiation_delta_pct     NUMERIC(8,4),       -- (sale - ask) / ask * 100
  avm_error_pct             NUMERIC(8,4),        -- (avm - sale) / sale * 100
  negotiation_duration_days INTEGER,

  -- Outcome classification
  outcome_type              TEXT NOT NULL CHECK (outcome_type IN ('won','lost','withdrawn')),
  closing_friction          TEXT CHECK (closing_friction IN (
    'financing','due_diligence','legal','timing','valuation','seller_withdrawal',
    'buyer_mismatch','competition','other'
  )),

  -- Context at time of distribution
  score_at_time             INTEGER,
  grade_at_time             TEXT,
  distribution_rank_at_time INTEGER,
  distribution_tier_at_time TEXT,

  -- Metadata
  closed_at                 TIMESTAMPTZ,
  recorded_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_by               TEXT,
  notes                     TEXT,

  UNIQUE (property_id, COALESCE(distribution_event_id,''), COALESCE(agent_email,''))
);

CREATE INDEX IF NOT EXISTS idx_to_property    ON transaction_outcomes(property_id);
CREATE INDEX IF NOT EXISTS idx_to_outcome     ON transaction_outcomes(outcome_type);
CREATE INDEX IF NOT EXISTS idx_to_closed_at   ON transaction_outcomes(closed_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_to_agent       ON transaction_outcomes(agent_email);

ALTER TABLE transaction_outcomes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='transaction_outcomes' AND policyname='service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON transaction_outcomes FOR ALL TO service_role USING (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS negotiation_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     TEXT NOT NULL,
  outcome_id      UUID REFERENCES transaction_outcomes(id) ON DELETE SET NULL,
  event_type      TEXT NOT NULL CHECK (event_type IN (
    'offer_submitted','counter_offer','accepted','rejected','withdrawn','stalled','due_diligence_started','financing_confirmed'
  )),
  event_date      DATE,
  offer_price     NUMERIC(15,2),
  counter_price   NUMERIC(15,2),
  notes           TEXT,
  recorded_by     TEXT,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ne_property  ON negotiation_events(property_id);
CREATE INDEX IF NOT EXISTS idx_ne_outcome   ON negotiation_events(outcome_id);
CREATE INDEX IF NOT EXISTS idx_ne_type      ON negotiation_events(event_type);

ALTER TABLE negotiation_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='negotiation_events' AND policyname='service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON negotiation_events FOR ALL TO service_role USING (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS opportunity_rejections (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id           TEXT NOT NULL,
  distribution_event_id TEXT,
  recipient_email       TEXT,
  recipient_type        TEXT CHECK (recipient_type IN ('agent','investor')),

  -- Structured taxonomy
  rejection_category    TEXT NOT NULL CHECK (rejection_category IN (
    'price','location','condition','timing','financing',
    'competition','buyer_mismatch','valuation_mismatch',
    'due_diligence','seller_withdrawal','portfolio_full','other'
  )),
  rejection_reason      TEXT,
  lost_to_competitor    BOOLEAN NOT NULL DEFAULT FALSE,
  competitor_price      NUMERIC(15,2),

  -- Context
  score_at_time         INTEGER,
  grade_at_time         TEXT,
  responded_at          TIMESTAMPTZ,
  recorded_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_or_property   ON opportunity_rejections(property_id);
CREATE INDEX IF NOT EXISTS idx_or_category   ON opportunity_rejections(rejection_category);
CREATE INDEX IF NOT EXISTS idx_or_recipient  ON opportunity_rejections(recipient_email);

ALTER TABLE opportunity_rejections ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='opportunity_rejections' AND policyname='service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON opportunity_rejections FOR ALL TO service_role USING (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- PHASE 2: Calibration Admin Workflow
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS calibration_recommendations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  priority      TEXT NOT NULL CHECK (priority IN ('CRITICAL','HIGH','MEDIUM','LOW')),
  dimension     TEXT NOT NULL,
  observation   TEXT NOT NULL,
  suggestion    TEXT NOT NULL,
  evidence      TEXT,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','applied','dismissed','deferred')),
  reviewed_by   TEXT,
  reviewed_at   TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (report_date, dimension, priority)
);

CREATE INDEX IF NOT EXISTS idx_cr_status_date   ON calibration_recommendations(status, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_cr_priority      ON calibration_recommendations(priority);

ALTER TABLE calibration_recommendations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='calibration_recommendations' AND policyname='service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON calibration_recommendations FOR ALL TO service_role USING (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- PHASE 4: Distribution Intelligence
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS distribution_outcomes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_event_id TEXT NOT NULL,
  property_id           TEXT NOT NULL,
  recipient_email       TEXT NOT NULL,
  recipient_type        TEXT NOT NULL CHECK (recipient_type IN ('agent','investor')),
  recipient_tier        TEXT,
  distribution_rank     INTEGER,

  -- Response timeline
  opened_at             TIMESTAMPTZ,
  replied_at            TIMESTAMPTZ,
  meeting_booked_at     TIMESTAMPTZ,
  offer_submitted_at    TIMESTAMPTZ,
  closed_at             TIMESTAMPTZ,

  -- Outcome
  outcome               TEXT CHECK (outcome IN (
    'no_response','opened','replied','meeting','offer','won','lost'
  )),
  rejection_reason      TEXT,

  -- Computed timing
  time_to_reply_hours   NUMERIC(8,2),
  time_to_close_days    INTEGER,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (distribution_event_id, recipient_email)
);

CREATE INDEX IF NOT EXISTS idx_do_event      ON distribution_outcomes(distribution_event_id);
CREATE INDEX IF NOT EXISTS idx_do_recipient  ON distribution_outcomes(recipient_email);
CREATE INDEX IF NOT EXISTS idx_do_outcome    ON distribution_outcomes(outcome);
CREATE INDEX IF NOT EXISTS idx_do_property   ON distribution_outcomes(property_id);

ALTER TABLE distribution_outcomes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='distribution_outcomes' AND policyname='service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON distribution_outcomes FOR ALL TO service_role USING (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS recipient_performance_profiles (
  recipient_email          TEXT PRIMARY KEY,
  recipient_type           TEXT NOT NULL CHECK (recipient_type IN ('agent','investor')),
  current_tier             TEXT,

  -- Rolling counts
  total_distributions      INTEGER NOT NULL DEFAULT 0,
  total_opens              INTEGER NOT NULL DEFAULT 0,
  total_replies            INTEGER NOT NULL DEFAULT 0,
  total_meetings           INTEGER NOT NULL DEFAULT 0,
  total_offers             INTEGER NOT NULL DEFAULT 0,
  total_won                INTEGER NOT NULL DEFAULT 0,

  -- Conversion rates
  open_rate                NUMERIC(5,4),
  reply_rate               NUMERIC(5,4),
  meeting_rate             NUMERIC(5,4),
  offer_rate               NUMERIC(5,4),
  close_rate               NUMERIC(5,4),

  -- Economic
  avg_commission           NUMERIC(15,2),
  total_commission         NUMERIC(15,2),
  roi_score                NUMERIC(8,2),

  -- Fatigue controls
  distributions_last_7d    INTEGER NOT NULL DEFAULT 0,
  distributions_last_30d   INTEGER NOT NULL DEFAULT 0,
  last_distributed_at      TIMESTAMPTZ,
  fatigue_score            NUMERIC(5,2) NOT NULL DEFAULT 0,
  is_fatigued              BOOLEAN NOT NULL DEFAULT FALSE,
  cooldown_until           TIMESTAMPTZ,

  last_computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rpp_type     ON recipient_performance_profiles(recipient_type);
CREATE INDEX IF NOT EXISTS idx_rpp_fatigued ON recipient_performance_profiles(is_fatigued) WHERE is_fatigued = TRUE;
CREATE INDEX IF NOT EXISTS idx_rpp_tier     ON recipient_performance_profiles(current_tier);

ALTER TABLE recipient_performance_profiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='recipient_performance_profiles' AND policyname='service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON recipient_performance_profiles FOR ALL TO service_role USING (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- PHASE 8: Feature Flags / Kill Switches
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS feature_flags (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key      TEXT NOT NULL UNIQUE,
  flag_name     TEXT NOT NULL,
  description   TEXT,
  flag_scope    TEXT NOT NULL DEFAULT 'global' CHECK (flag_scope IN ('global','subsystem','zone','tier')),
  subsystem     TEXT,                             -- 'distribution' | 'scoring' | 'avm' | 'alerts'

  -- State
  is_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  rollout_pct   INTEGER NOT NULL DEFAULT 100 CHECK (rollout_pct BETWEEN 0 AND 100),
  config        JSONB NOT NULL DEFAULT '{}',

  -- Type
  is_kill_switch  BOOLEAN NOT NULL DEFAULT FALSE,
  is_canary       BOOLEAN NOT NULL DEFAULT FALSE,

  -- Lifecycle
  enabled_by    TEXT,
  enabled_at    TIMESTAMPTZ,
  disabled_by   TEXT,
  disabled_at   TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ff_scope      ON feature_flags(flag_scope);
CREATE INDEX IF NOT EXISTS idx_ff_enabled    ON feature_flags(is_enabled);
CREATE INDEX IF NOT EXISTS idx_ff_subsystem  ON feature_flags(subsystem) WHERE subsystem IS NOT NULL;

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='feature_flags' AND policyname='service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON feature_flags FOR ALL TO service_role USING (true);
  END IF;
END $$;

-- Seed default kill switches (off by default)
INSERT INTO feature_flags (flag_key, flag_name, description, flag_scope, subsystem, is_enabled, is_kill_switch)
VALUES
  ('kill_distribution',       'Kill: Distribution',         'Halt all outbound distribution globally',       'global', 'distribution', FALSE, TRUE),
  ('kill_scoring',            'Kill: Scoring',              'Halt automatic property scoring',               'global', 'scoring',      FALSE, TRUE),
  ('kill_avm',                'Kill: AVM Compute',          'Halt AVM computation pipeline',                 'global', 'avm',          FALSE, TRUE),
  ('kill_alerts',             'Kill: Alerts',               'Suppress all outbound alerts',                  'global', 'alerts',       FALSE, TRUE),
  ('kill_investor_alerts',    'Kill: Investor Alerts',      'Halt investor alert emails/notifications',      'global', 'distribution', FALSE, TRUE),
  ('enable_confidence_gate',  'Enable: Confidence Gate',    'Require manual review for low-confidence deals','global', 'distribution', TRUE,  FALSE),
  ('enable_fatigue_controls', 'Enable: Fatigue Controls',   'Enforce recipient fatigue/cooldown limits',     'global', 'distribution', TRUE,  FALSE),
  ('enable_calibration_cron', 'Enable: Calibration Cron',   'Allow weekly calibration recompute to run',     'global', 'scoring',      TRUE,  FALSE),
  ('canary_v2_scoring',       'Canary: Scoring V2',         'Route X% of properties to scoring V2',          'global', 'scoring',      FALSE, FALSE)
ON CONFLICT (flag_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- PHASE 10: Operator Tasks
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS operator_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type       TEXT NOT NULL CHECK (task_type IN (
    'review_queue','distribution_check','calibration_review',
    'quality_review','escalation','data_fix','incident_response','other'
  )),
  title           TEXT NOT NULL,
  description     TEXT,
  priority        TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('CRITICAL','HIGH','MEDIUM','LOW')),

  -- Assignment
  assigned_to     TEXT,
  assigned_by     TEXT,
  assigned_at     TIMESTAMPTZ,

  -- References
  property_id     TEXT,
  review_queue_id UUID,
  alert_id        UUID,
  incident_id     UUID,

  -- Status
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending','in_progress','completed','cancelled','escalated'
  )),
  due_at          TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  completed_by    TEXT,

  -- Notes
  ops_notes       TEXT,
  resolution      TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ot_status_priority ON operator_tasks(status, priority);
CREATE INDEX IF NOT EXISTS idx_ot_assigned_to     ON operator_tasks(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ot_due_at          ON operator_tasks(due_at) WHERE due_at IS NOT NULL;

ALTER TABLE operator_tasks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='operator_tasks' AND policyname='service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON operator_tasks FOR ALL TO service_role USING (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- PHASE 7: Incident Log
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS incident_log (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_type         TEXT NOT NULL,
  title                 TEXT NOT NULL,
  description           TEXT,
  severity              TEXT NOT NULL CHECK (severity IN ('critical','warning','info')),

  -- Status lifecycle
  status                TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open','investigating','mitigated','resolved'
  )),

  -- Impact
  affected_systems      TEXT[] DEFAULT '{}',
  affected_count        INTEGER,

  -- Root cause
  root_cause            TEXT,
  root_cause_category   TEXT CHECK (root_cause_category IN (
    'code_bug','data_quality','external_provider','config','infra','human_error','unknown'
  )),

  -- Timeline
  started_at            TIMESTAMPTZ,
  detected_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  mitigated_at          TIMESTAMPTZ,
  resolved_at           TIMESTAMPTZ,
  duration_minutes      INTEGER GENERATED ALWAYS AS (
    CASE WHEN resolved_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM (resolved_at - detected_at))::INTEGER / 60
    ELSE NULL END
  ) STORED,

  -- Ownership
  detected_by           TEXT,
  owned_by              TEXT,
  alert_id              UUID,
  post_mortem           TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_il_status_severity ON incident_log(status, severity);
CREATE INDEX IF NOT EXISTS idx_il_detected_at     ON incident_log(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_il_type            ON incident_log(incident_type);

ALTER TABLE incident_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='incident_log' AND policyname='service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON incident_log FOR ALL TO service_role USING (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- VIEWS
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW v_outcome_summary AS
SELECT
  outcome_type,
  grade_at_time                                                   AS grade,
  COUNT(*)                                                        AS total,
  AVG(negotiation_delta_pct)                                      AS avg_negotiation_delta_pct,
  AVG(avm_error_pct)                                              AS avg_avm_error_pct,
  AVG(negotiation_duration_days)                                  AS avg_duration_days,
  AVG(final_sale_price)                                           AS avg_sale_price,
  SUM(CASE WHEN lost_to_competitor THEN 1 ELSE 0 END)             AS lost_to_competitor_count,
  NULL::BIGINT                                                    AS lost_to_competitor_count_placeholder
FROM transaction_outcomes to_
LEFT JOIN opportunity_rejections orj
  ON to_.property_id = orj.property_id
  AND to_.distribution_event_id = orj.distribution_event_id
GROUP BY 1, 2;

CREATE OR REPLACE VIEW v_rejection_taxonomy AS
SELECT
  rejection_category,
  COUNT(*)                                       AS total,
  COUNT(*) FILTER (WHERE lost_to_competitor)     AS lost_to_competitor,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) AS pct_of_total
FROM opportunity_rejections
GROUP BY rejection_category
ORDER BY total DESC;

CREATE OR REPLACE VIEW v_active_feature_flags AS
SELECT
  flag_key,
  flag_name,
  flag_scope,
  subsystem,
  is_enabled,
  rollout_pct,
  is_kill_switch,
  is_canary,
  config,
  enabled_by,
  enabled_at,
  expires_at
FROM feature_flags
WHERE (expires_at IS NULL OR expires_at > NOW())
ORDER BY is_kill_switch DESC, is_enabled DESC, flag_key;

CREATE OR REPLACE VIEW v_distribution_roi AS
SELECT
  recipient_email,
  recipient_type,
  current_tier,
  total_distributions,
  total_won,
  close_rate,
  roi_score,
  total_commission,
  is_fatigued,
  fatigue_score,
  last_distributed_at
FROM recipient_performance_profiles
ORDER BY roi_score DESC NULLS LAST;

CREATE OR REPLACE VIEW v_pending_operator_tasks AS
SELECT
  id,
  task_type,
  title,
  priority,
  assigned_to,
  due_at,
  CASE
    WHEN due_at < NOW() THEN TRUE
    ELSE FALSE
  END                                       AS is_overdue,
  EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 AS hours_pending,
  created_at
FROM operator_tasks
WHERE status IN ('pending','in_progress')
ORDER BY
  CASE priority WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
  due_at NULLS LAST;

CREATE OR REPLACE VIEW v_open_incidents AS
SELECT
  id,
  incident_type,
  title,
  severity,
  status,
  affected_systems,
  detected_at,
  EXTRACT(EPOCH FROM (NOW() - detected_at)) / 3600 AS hours_open,
  owned_by
FROM incident_log
WHERE status IN ('open','investigating','mitigated')
ORDER BY
  CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
  detected_at ASC;

-- ---------------------------------------------------------------------------
-- END
-- ---------------------------------------------------------------------------
