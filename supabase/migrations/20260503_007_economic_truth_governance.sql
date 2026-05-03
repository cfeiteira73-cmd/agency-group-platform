-- =============================================================================
-- Migration 007: Economic Truth, Governance & Closed-Loop Intelligence
-- 20260503_007_economic_truth_governance.sql
--
-- Tables:
--   economic_truth_events         — realized outcome truth per deal
--   transactional_decisions       — idempotency-protected decision log
--   auto_model_updates            — safe auto learning trigger records
--   rollback_events               — model rollback history
--   governance_decisions          — formal governance action log
--   override_events               — human override records
--   distribution_feedback_weights — per-recipient reinforcement weights
--   market_feedback_signals       — external market pressure signals
--
-- Views:
--   v_economic_truth_summary      — zone/class aggregate truth scores
--   v_governance_activity         — recent governance + override activity
--   v_learning_system_health      — auto learning + rollback health
--
-- Safe: all CREATE TABLE IF NOT EXISTS + idempotent
-- =============================================================================

-- ---------------------------------------------------------------------------
-- economic_truth_events
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS economic_truth_events (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id               TEXT NOT NULL,
  deal_id                   TEXT,
  distribution_event_id     TEXT,
  zone_key                  TEXT NOT NULL,
  asset_class               TEXT NOT NULL,
  price_band                TEXT NOT NULL,

  -- Component scores
  avm_accuracy_score        NUMERIC(5,2) NOT NULL,
  negotiation_score         NUMERIC(5,2) NOT NULL,
  time_to_close_score       NUMERIC(5,2) NOT NULL,
  routing_efficiency_score  NUMERIC(5,2) NOT NULL,
  spread_vs_predicted_score NUMERIC(5,2) NOT NULL,

  -- Final scores
  raw_truth_score           NUMERIC(5,2) NOT NULL,
  normalized_truth_score    NUMERIC(6,2),    -- null until batchNormalize runs

  -- Derived metrics
  avm_error_pct             NUMERIC(6,2),
  negotiation_delta_pct     NUMERIC(6,2),
  routing_precision_pct     NUMERIC(6,2),
  spread_error_pct          NUMERIC(6,2),

  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_economic_truth_zone
  ON economic_truth_events(zone_key, asset_class, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_economic_truth_property
  ON economic_truth_events(property_id);
CREATE INDEX IF NOT EXISTS idx_economic_truth_deal
  ON economic_truth_events(deal_id)
  WHERE deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_economic_truth_unnormalized
  ON economic_truth_events(created_at DESC)
  WHERE normalized_truth_score IS NULL;

-- ---------------------------------------------------------------------------
-- transactional_decisions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS transactional_decisions (
  decision_id       TEXT PRIMARY KEY,
  property_id       TEXT NOT NULL,
  opportunity_score NUMERIC(5,2),
  routing_tier      TEXT,
  recipient_count   INTEGER DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','executing','complete','failed','skipped')),
  inputs_snapshot   JSONB,
  result_summary    JSONB,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactional_decisions_property
  ON transactional_decisions(property_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactional_decisions_status
  ON transactional_decisions(status)
  WHERE status IN ('pending','executing');

-- ---------------------------------------------------------------------------
-- auto_model_updates
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS auto_model_updates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name        TEXT NOT NULL,
  from_version      TEXT NOT NULL,
  to_version        TEXT NOT NULL,
  trigger_reason    TEXT,
  metrics_snapshot  JSONB,
  initiated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status            TEXT NOT NULL DEFAULT 'initiated'
                    CHECK (status IN ('initiated','promoted','rolled_back','aborted')),
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_model_updates_model
  ON auto_model_updates(model_name, initiated_at DESC);
CREATE INDEX IF NOT EXISTS idx_auto_model_updates_status
  ON auto_model_updates(status);

-- ---------------------------------------------------------------------------
-- rollback_events
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS rollback_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name        TEXT NOT NULL,
  from_version      TEXT NOT NULL,   -- the version being rolled back
  to_version        TEXT NOT NULL,   -- reverting to this
  reason            TEXT NOT NULL,
  accuracy_drop_pct NUMERIC(6,2),
  severity          TEXT NOT NULL CHECK (severity IN ('warning','critical')),
  triggered_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rollback_events_model
  ON rollback_events(model_name, triggered_at DESC);

-- ---------------------------------------------------------------------------
-- governance_decisions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS governance_decisions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type       TEXT NOT NULL,
  triggered_by      TEXT NOT NULL,
  governance_class  TEXT NOT NULL
                    CHECK (governance_class IN ('routine','requires_approval','requires_super_admin','forbidden')),
  approved_by       TEXT,
  approved_at       TIMESTAMPTZ,
  decision          TEXT NOT NULL CHECK (decision IN ('approved','blocked','pending')),
  audit_reason      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_governance_decisions_action
  ON governance_decisions(action_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_governance_decisions_pending
  ON governance_decisions(decision)
  WHERE decision = 'pending';

-- ---------------------------------------------------------------------------
-- override_events
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS override_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  override_id  TEXT UNIQUE NOT NULL,
  user_email   TEXT NOT NULL,
  user_role    TEXT NOT NULL,
  action_type  TEXT NOT NULL,
  resource_id  TEXT,
  reason       TEXT,
  outcome      TEXT NOT NULL CHECK (outcome IN ('human_wins','system_locked','escalated')),
  winner       TEXT NOT NULL CHECK (winner IN ('human','system')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_override_events_user
  ON override_events(user_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_override_events_action
  ON override_events(action_type);

-- ---------------------------------------------------------------------------
-- distribution_feedback_weights
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS distribution_feedback_weights (
  recipient_email     TEXT PRIMARY KEY,
  acceptance_weight   NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  conversion_weight   NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  speed_weight        NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  composite_weight    NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  outcome_class       TEXT,
  recommended_action  TEXT,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_weights_action
  ON distribution_feedback_weights(recommended_action);
CREATE INDEX IF NOT EXISTS idx_feedback_weights_composite
  ON distribution_feedback_weights(composite_weight DESC);

-- ---------------------------------------------------------------------------
-- market_feedback_signals
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS market_feedback_signals (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_key             TEXT NOT NULL,
  asset_class          TEXT NOT NULL,
  period_label         TEXT NOT NULL,
  absorption_rate      NUMERIC(5,2),
  listing_velocity_chg NUMERIC(7,2),
  price_delta_pct      NUMERIC(7,2),
  demand_supply_ratio  NUMERIC(5,2),
  market_pressure      TEXT,
  market_regime        TEXT,
  market_health_score  NUMERIC(5,2),
  pricing_pressure_idx NUMERIC(5,2),
  computed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_feedback_zone
  ON market_feedback_signals(zone_key, asset_class, computed_at DESC);

-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW v_economic_truth_summary AS
SELECT
  zone_key,
  asset_class,
  COUNT(*)                              AS event_count,
  ROUND(AVG(raw_truth_score)::NUMERIC, 1)       AS avg_raw_truth_score,
  ROUND(AVG(normalized_truth_score)::NUMERIC, 1) AS avg_normalized_score,
  ROUND(AVG(avm_error_pct)::NUMERIC, 2)          AS avg_avm_error_pct,
  ROUND(AVG(negotiation_delta_pct)::NUMERIC, 2)  AS avg_negotiation_delta_pct,
  ROUND(AVG(routing_precision_pct)::NUMERIC, 1)  AS avg_routing_precision_pct,
  MIN(raw_truth_score)                  AS min_score,
  MAX(raw_truth_score)                  AS max_score,
  MAX(created_at)                       AS last_updated
FROM economic_truth_events
GROUP BY zone_key, asset_class;

CREATE OR REPLACE VIEW v_governance_activity AS
SELECT
  g.id,
  g.action_type,
  g.triggered_by,
  g.governance_class,
  g.decision,
  g.approved_by,
  g.created_at,
  o.user_email   AS override_by,
  o.outcome      AS override_outcome
FROM governance_decisions g
LEFT JOIN override_events o
  ON o.action_type = g.action_type
  AND ABS(EXTRACT(EPOCH FROM (o.created_at - g.created_at))) < 60
ORDER BY g.created_at DESC;

CREATE OR REPLACE VIEW v_learning_system_health AS
SELECT
  (SELECT COUNT(*) FROM auto_model_updates WHERE status = 'initiated')    AS active_updates,
  (SELECT COUNT(*) FROM auto_model_updates WHERE status = 'promoted')     AS promoted_updates,
  (SELECT COUNT(*) FROM auto_model_updates WHERE status = 'rolled_back')  AS rolled_back_updates,
  (SELECT COUNT(*) FROM rollback_events WHERE triggered_at > NOW() - INTERVAL '30 days') AS rollbacks_30d,
  (SELECT COUNT(*) FROM rollback_events WHERE severity = 'critical'
   AND triggered_at > NOW() - INTERVAL '7 days')                          AS critical_rollbacks_7d,
  (SELECT model_name || ' → ' || to_version FROM rollback_events
   ORDER BY triggered_at DESC LIMIT 1)                                    AS last_rollback;

SELECT '007_economic_truth_governance: tables + views created' AS status;
