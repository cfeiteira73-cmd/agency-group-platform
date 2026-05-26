-- =============================================================================
-- Agency Group — Feedback & Distribution Tables
-- supabase/migrations/000077_feedback_distribution.sql
--
-- Creates 5 tables for Wave 42:
--   1. feedback_signals           — every action on an opportunity
--   2. opportunity_outcomes       — predicted vs actual outcomes
--   3. detection_accuracy_reports — accuracy reports per period
--   4. distribution_queue         — per-investor distribution jobs
--   5. distribution_batches       — batch run summaries
--
-- RLS: tenant_isolation on all tables.
-- EUR cents arithmetic: bigint, never float for money.
-- =============================================================================

-- ─── 1. feedback_signals ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS feedback_signals (
  id                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id               text          UNIQUE      DEFAULT gen_random_uuid()::text,
  tenant_id               text          NOT NULL,
  opportunity_id          text          NOT NULL,
  asset_id                text,
  investor_id             text,
  signal_type             text          NOT NULL,
  signal_weight           int           NOT NULL DEFAULT 1,
  metadata                jsonb         NOT NULL DEFAULT '{}',
  is_truth_label          boolean       NOT NULL DEFAULT false,
  actual_price_eur_cents  bigint,
  actual_days_to_close    int,
  occurred_at             timestamptz   NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_feedback_signals_tenant_opp
  ON feedback_signals (tenant_id, opportunity_id);

CREATE INDEX IF NOT EXISTS idx_feedback_signals_tenant_occurred
  ON feedback_signals (tenant_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_signals_signal_type
  ON feedback_signals (signal_type);

-- RLS
ALTER TABLE feedback_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feedback_signals_tenant_isolation ON feedback_signals;
CREATE POLICY feedback_signals_tenant_isolation ON feedback_signals
  USING (tenant_id = current_setting('app.tenant_id', true));

-- ─── 2. opportunity_outcomes ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS opportunity_outcomes (
  id                          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  outcome_id                  text          UNIQUE      DEFAULT gen_random_uuid()::text,
  tenant_id                   text          NOT NULL,
  opportunity_id              text,
  asset_id                    text,
  opportunity_type            text,
  predicted_opportunity_score numeric(5,2),
  predicted_roi_pct           numeric(8,4),
  predicted_days_to_close     int,
  actual_outcome              text,
  actual_price_eur_cents      bigint,
  actual_roi_pct              numeric(8,4),
  actual_days_to_close        int,
  score_accuracy              numeric(6,4),
  roi_prediction_error_pct    numeric(8,4),
  recorded_at                 timestamptz   NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_opportunity_outcomes_tenant
  ON opportunity_outcomes (tenant_id);

CREATE INDEX IF NOT EXISTS idx_opportunity_outcomes_opp
  ON opportunity_outcomes (opportunity_id);

CREATE INDEX IF NOT EXISTS idx_opportunity_outcomes_recorded
  ON opportunity_outcomes (tenant_id, recorded_at DESC);

-- RLS
ALTER TABLE opportunity_outcomes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS opportunity_outcomes_tenant_isolation ON opportunity_outcomes;
CREATE POLICY opportunity_outcomes_tenant_isolation ON opportunity_outcomes
  USING (tenant_id = current_setting('app.tenant_id', true));

-- ─── 3. detection_accuracy_reports ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS detection_accuracy_reports (
  id                          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id                   text          UNIQUE,
  tenant_id                   text          NOT NULL,
  period_start                timestamptz,
  period_end                  timestamptz,
  total_opportunities         int,
  closed                      int,
  failed                      int,
  expired                     int,
  close_rate                  numeric(4,3),
  avg_predicted_score         numeric(5,2),
  avg_actual_roi_pct          numeric(8,4),
  score_to_close_correlation  numeric(6,4),
  best_performing_type        text,
  worst_performing_type       text,
  generated_at                timestamptz   NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_detection_accuracy_reports_tenant
  ON detection_accuracy_reports (tenant_id, generated_at DESC);

-- RLS
ALTER TABLE detection_accuracy_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS detection_accuracy_reports_tenant_isolation ON detection_accuracy_reports;
CREATE POLICY detection_accuracy_reports_tenant_isolation ON detection_accuracy_reports
  USING (tenant_id = current_setting('app.tenant_id', true));

-- ─── 4. distribution_queue ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS distribution_queue (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id           text        UNIQUE      DEFAULT gen_random_uuid()::text,
  tenant_id        text        NOT NULL,
  opportunity_id   text,
  investor_id      text,
  channel          text,
  priority         text        NOT NULL DEFAULT 'MEDIUM',
  status           text        NOT NULL DEFAULT 'QUEUED',
  message_content  text,
  sent_at          timestamptz,
  delivered_at     timestamptz,
  error            text,
  queued_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (opportunity_id, investor_id, channel)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_distribution_queue_tenant_status
  ON distribution_queue (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_distribution_queue_priority_queued
  ON distribution_queue (priority, queued_at)
  WHERE status = 'QUEUED';

CREATE INDEX IF NOT EXISTS idx_distribution_queue_investor
  ON distribution_queue (investor_id);

-- RLS
ALTER TABLE distribution_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS distribution_queue_tenant_isolation ON distribution_queue;
CREATE POLICY distribution_queue_tenant_isolation ON distribution_queue
  USING (tenant_id = current_setting('app.tenant_id', true));

-- ─── 5. distribution_batches ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS distribution_batches (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id    text        UNIQUE      DEFAULT gen_random_uuid()::text,
  tenant_id   text        NOT NULL,
  total_jobs  int,
  sent        int,
  failed      int,
  suppressed  int,
  run_at      timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_distribution_batches_tenant
  ON distribution_batches (tenant_id, run_at DESC);

-- RLS
ALTER TABLE distribution_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS distribution_batches_tenant_isolation ON distribution_batches;
CREATE POLICY distribution_batches_tenant_isolation ON distribution_batches
  USING (tenant_id = current_setting('app.tenant_id', true));

-- ─── 6. opportunity_demand_signals (upsert target for feedback scoring) ───────

CREATE TABLE IF NOT EXISTS opportunity_demand_signals (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        text        NOT NULL,
  opportunity_id   text        NOT NULL,
  demand_score     numeric(5,2) NOT NULL DEFAULT 50,
  signal_count     int          NOT NULL DEFAULT 0,
  net_feedback     int          NOT NULL DEFAULT 0,
  last_updated_at  timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, opportunity_id)
);

CREATE INDEX IF NOT EXISTS idx_opportunity_demand_signals_tenant
  ON opportunity_demand_signals (tenant_id);

ALTER TABLE opportunity_demand_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS opportunity_demand_signals_tenant_isolation ON opportunity_demand_signals;
CREATE POLICY opportunity_demand_signals_tenant_isolation ON opportunity_demand_signals
  USING (tenant_id = current_setting('app.tenant_id', true));
