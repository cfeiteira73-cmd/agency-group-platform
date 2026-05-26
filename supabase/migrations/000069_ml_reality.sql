-- =============================================================================
-- Agency Group — Wave 41: ML Reality Alignment + Liquidity Execution
-- Migration: 000069_ml_reality.sql
--
-- Tables:
--   1. ml_reality_alignments    — model alignment assessments
--   2. real_outcomes            — real deal outcome records
--   3. drift_reports            — statistical drift analysis
--   4. ml_retraining_queue      — retraining job lifecycle
--   5. external_liquidity_providers — verified buyer/fund registry
--   6. liquidity_matches        — asset-to-provider matching
--   7. external_closing_confirmations — confirmed real estate closings
-- =============================================================================

-- ─── 1. ml_reality_alignments ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ml_reality_alignments (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alignment_id              TEXT UNIQUE NOT NULL,
  tenant_id                 TEXT NOT NULL,
  model_name                TEXT NOT NULL,
  data_quality              TEXT NOT NULL,
  real_training_samples     INT NOT NULL DEFAULT 0,
  simulated_training_samples INT NOT NULL DEFAULT 0,
  real_data_ratio           NUMERIC(4,3) NOT NULL DEFAULT 0,
  drift_score               NUMERIC(4,3) NOT NULL DEFAULT 0,
  drift_severity            TEXT NOT NULL DEFAULT 'NONE',
  last_trained_at           TIMESTAMPTZ,
  last_real_outcome_at      TIMESTAMPTZ,
  prediction_accuracy_pct   NUMERIC(5,2),
  needs_retraining          BOOLEAN NOT NULL DEFAULT false,
  retraining_trigger        TEXT,
  assessed_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ml_reality_alignments_tenant_model
  ON ml_reality_alignments (tenant_id, model_name);

CREATE INDEX IF NOT EXISTS idx_ml_reality_alignments_assessed_at
  ON ml_reality_alignments (tenant_id, assessed_at DESC);

ALTER TABLE ml_reality_alignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ml_reality_alignments_tenant_isolation ON ml_reality_alignments;
CREATE POLICY ml_reality_alignments_tenant_isolation ON ml_reality_alignments
  USING (tenant_id = current_setting('app.tenant_id', true));

-- ─── 2. real_outcomes ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS real_outcomes (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outcome_id                  TEXT UNIQUE NOT NULL,
  tenant_id                   TEXT NOT NULL,
  deal_id                     TEXT NOT NULL,
  predicted_price_eur_cents   BIGINT,
  actual_price_eur_cents      BIGINT NOT NULL,
  predicted_roi_pct           NUMERIC(6,3),
  actual_roi_pct              NUMERIC(6,3) NOT NULL,
  prediction_error_pct        NUMERIC(8,4),
  source                      TEXT NOT NULL,
  recorded_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_real_outcomes_tenant_recorded
  ON real_outcomes (tenant_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_real_outcomes_deal
  ON real_outcomes (tenant_id, deal_id);

ALTER TABLE real_outcomes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS real_outcomes_tenant_isolation ON real_outcomes;
CREATE POLICY real_outcomes_tenant_isolation ON real_outcomes
  USING (tenant_id = current_setting('app.tenant_id', true));

-- ─── 3. drift_reports ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS drift_reports (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id             TEXT UNIQUE NOT NULL,
  tenant_id             TEXT NOT NULL,
  model_name            TEXT NOT NULL,
  window_days           INT NOT NULL DEFAULT 30,
  samples_analyzed      INT NOT NULL DEFAULT 0,
  mean_absolute_error   NUMERIC(12,4) NOT NULL DEFAULT 0,
  mean_percentage_error NUMERIC(8,4) NOT NULL DEFAULT 0,
  max_percentage_error  NUMERIC(8,4) NOT NULL DEFAULT 0,
  drift_score           NUMERIC(4,3) NOT NULL DEFAULT 0,
  drift_detected        BOOLEAN NOT NULL DEFAULT false,
  drift_direction       TEXT NOT NULL DEFAULT 'STABLE',
  p_value               NUMERIC(6,4),
  generated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drift_reports_tenant_model
  ON drift_reports (tenant_id, model_name);

CREATE INDEX IF NOT EXISTS idx_drift_reports_generated_at
  ON drift_reports (tenant_id, generated_at DESC);

ALTER TABLE drift_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS drift_reports_tenant_isolation ON drift_reports;
CREATE POLICY drift_reports_tenant_isolation ON drift_reports
  USING (tenant_id = current_setting('app.tenant_id', true));

-- ─── 4. ml_retraining_queue ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ml_retraining_queue (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id                TEXT UNIQUE NOT NULL,
  tenant_id             TEXT NOT NULL,
  model_name            TEXT NOT NULL,
  trigger               TEXT NOT NULL,
  real_samples_count    INT NOT NULL DEFAULT 0,
  status                TEXT NOT NULL DEFAULT 'QUEUED',
  queued_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  new_accuracy_pct      NUMERIC(5,2),
  previous_accuracy_pct NUMERIC(5,2),
  improvement_pct       NUMERIC(6,3),
  error                 TEXT
);

CREATE INDEX IF NOT EXISTS idx_ml_retraining_queue_tenant_status
  ON ml_retraining_queue (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_ml_retraining_queue_model
  ON ml_retraining_queue (tenant_id, model_name);

ALTER TABLE ml_retraining_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ml_retraining_queue_tenant_isolation ON ml_retraining_queue;
CREATE POLICY ml_retraining_queue_tenant_isolation ON ml_retraining_queue
  USING (tenant_id = current_setting('app.tenant_id', true));

-- ─── 5. external_liquidity_providers ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS external_liquidity_providers (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id                 TEXT UNIQUE NOT NULL,
  tenant_id                   TEXT NOT NULL,
  name                        TEXT NOT NULL,
  provider_type               TEXT NOT NULL,
  country                     TEXT NOT NULL,
  available_capital_eur_cents BIGINT NOT NULL DEFAULT 0,
  preferred_asset_types       JSONB NOT NULL DEFAULT '[]',
  preferred_markets           JSONB NOT NULL DEFAULT '[]',
  kyc_status                  TEXT NOT NULL DEFAULT 'PENDING',
  contact_email               TEXT NOT NULL,
  last_active_at              TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_external_liquidity_providers_tenant
  ON external_liquidity_providers (tenant_id);

CREATE INDEX IF NOT EXISTS idx_external_liquidity_providers_kyc
  ON external_liquidity_providers (tenant_id, kyc_status);

CREATE INDEX IF NOT EXISTS idx_external_liquidity_providers_capital
  ON external_liquidity_providers (tenant_id, available_capital_eur_cents DESC);

ALTER TABLE external_liquidity_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS external_liquidity_providers_tenant_isolation ON external_liquidity_providers;
CREATE POLICY external_liquidity_providers_tenant_isolation ON external_liquidity_providers
  USING (tenant_id = current_setting('app.tenant_id', true));

-- ─── 6. liquidity_matches ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS liquidity_matches (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id                    TEXT UNIQUE NOT NULL,
  tenant_id                   TEXT NOT NULL,
  asset_id                    TEXT NOT NULL,
  provider_id                 TEXT NOT NULL,
  matched_capital_eur_cents   BIGINT NOT NULL,
  match_score                 NUMERIC(4,3) NOT NULL DEFAULT 0,
  status                      TEXT NOT NULL DEFAULT 'PROPOSED',
  proposed_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at                TIMESTAMPTZ,
  executed_at                 TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_liquidity_matches_tenant
  ON liquidity_matches (tenant_id);

CREATE INDEX IF NOT EXISTS idx_liquidity_matches_asset
  ON liquidity_matches (tenant_id, asset_id);

CREATE INDEX IF NOT EXISTS idx_liquidity_matches_provider
  ON liquidity_matches (tenant_id, provider_id);

CREATE INDEX IF NOT EXISTS idx_liquidity_matches_status
  ON liquidity_matches (tenant_id, status);

ALTER TABLE liquidity_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS liquidity_matches_tenant_isolation ON liquidity_matches;
CREATE POLICY liquidity_matches_tenant_isolation ON liquidity_matches
  USING (tenant_id = current_setting('app.tenant_id', true));

-- ─── 7. external_closing_confirmations ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS external_closing_confirmations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               TEXT NOT NULL,
  asset_id                TEXT NOT NULL,
  actual_price_eur_cents  BIGINT NOT NULL,
  buyer_ref               TEXT NOT NULL,
  confirmed_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_external_closing_confirmations_tenant
  ON external_closing_confirmations (tenant_id);

CREATE INDEX IF NOT EXISTS idx_external_closing_confirmations_asset
  ON external_closing_confirmations (tenant_id, asset_id);

ALTER TABLE external_closing_confirmations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS external_closing_confirmations_tenant_isolation ON external_closing_confirmations;
CREATE POLICY external_closing_confirmations_tenant_isolation ON external_closing_confirmations
  USING (tenant_id = current_setting('app.tenant_id', true));
