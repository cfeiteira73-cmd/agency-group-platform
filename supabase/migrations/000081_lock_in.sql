-- =============================================================================
-- Agency Group — Wave 43: Capital Lock-In & Network Effect Tables
-- supabase/migrations/000081_lock_in.sql
--
-- Creates:
--   investor_lock_in_scores       — per-investor lock-in component scores + churn risk
--   retention_cohorts             — monthly cohort retention rates
--   retention_interventions       — queued/executed re-engagement actions
--   network_effect_snapshots_v2   — Metcalfe-inspired network value snapshots
--
-- All EUR amounts in bigint (cents) — never float for money.
-- All tables: IF NOT EXISTS, RLS enabled, tenant isolation policy, indexes.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- investor_lock_in_scores
-- Tracks how locked in each investor is — cost of leaving the system.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS investor_lock_in_scores (
  id                       uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  lock_in_id               text           UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  tenant_id                text           NOT NULL,
  investor_id              text           NOT NULL,
  lock_in_score            numeric(5,2)   NOT NULL DEFAULT 0,
  deal_dependency_score    numeric(5,2)   NOT NULL DEFAULT 0,
  data_integration_score   numeric(5,2)   NOT NULL DEFAULT 0,
  switching_cost_score     numeric(5,2)   NOT NULL DEFAULT 0,
  habit_score              numeric(5,2)   NOT NULL DEFAULT 0,
  consecutive_active_days  int            NOT NULL DEFAULT 0,
  last_bid_days_ago        int,
  deals_via_system         int            NOT NULL DEFAULT 0,
  total_deals              int,
  dependency_ratio         numeric(6,4)   NOT NULL DEFAULT 0,
  lock_in_tier             text           NOT NULL DEFAULT 'CHURNING',
  churn_risk               text           NOT NULL DEFAULT 'HIGH',
  churn_probability        numeric(4,3)   NOT NULL DEFAULT 1,
  computed_at              timestamptz    NOT NULL DEFAULT now(),
  UNIQUE (investor_id, tenant_id)
);

ALTER TABLE investor_lock_in_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_investor_lock_in_scores ON investor_lock_in_scores;
CREATE POLICY tenant_isolation_investor_lock_in_scores
  ON investor_lock_in_scores
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_investor_lock_in_scores_investor_tenant
  ON investor_lock_in_scores (investor_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_investor_lock_in_scores_churn_risk_tenant
  ON investor_lock_in_scores (churn_risk, tenant_id);

CREATE INDEX IF NOT EXISTS idx_investor_lock_in_scores_tenant_computed
  ON investor_lock_in_scores (tenant_id, computed_at DESC);

-- ---------------------------------------------------------------------------
-- retention_cohorts
-- Monthly cohort retention analysis.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS retention_cohorts (
  id                                uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id                         text           UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  tenant_id                         text           NOT NULL,
  cohort_period                     text           NOT NULL,
  investors_joined                  int            NOT NULL DEFAULT 0,
  active_30d                        int            NOT NULL DEFAULT 0,
  active_90d                        int            NOT NULL DEFAULT 0,
  active_180d                       int            NOT NULL DEFAULT 0,
  retention_rate_30d                numeric(4,3)   NOT NULL DEFAULT 0,
  retention_rate_90d                numeric(4,3)   NOT NULL DEFAULT 0,
  retention_rate_180d               numeric(4,3)   NOT NULL DEFAULT 0,
  avg_capital_deployed_eur_cents    bigint         NOT NULL DEFAULT 0,
  churned_count                     int            NOT NULL DEFAULT 0,
  computed_at                       timestamptz    NOT NULL DEFAULT now(),
  UNIQUE (cohort_period, tenant_id)
);

ALTER TABLE retention_cohorts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_retention_cohorts ON retention_cohorts;
CREATE POLICY tenant_isolation_retention_cohorts
  ON retention_cohorts
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_retention_cohorts_period_tenant
  ON retention_cohorts (cohort_period, tenant_id);

CREATE INDEX IF NOT EXISTS idx_retention_cohorts_tenant_computed
  ON retention_cohorts (tenant_id, computed_at DESC);

-- ---------------------------------------------------------------------------
-- retention_interventions
-- Queued / executed re-engagement actions per investor.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS retention_interventions (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id   text          UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  tenant_id         text          NOT NULL,
  investor_id       text          NOT NULL,
  trigger           text          NOT NULL,
  action            text          NOT NULL,
  status            text          NOT NULL DEFAULT 'QUEUED',
  queued_at         timestamptz   NOT NULL DEFAULT now(),
  executed_at       timestamptz
);

ALTER TABLE retention_interventions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_retention_interventions ON retention_interventions;
CREATE POLICY tenant_isolation_retention_interventions
  ON retention_interventions
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_retention_interventions_investor_tenant
  ON retention_interventions (investor_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_retention_interventions_status_tenant
  ON retention_interventions (status, tenant_id);

CREATE INDEX IF NOT EXISTS idx_retention_interventions_tenant_queued
  ON retention_interventions (tenant_id, queued_at DESC);

-- ---------------------------------------------------------------------------
-- network_effect_snapshots_v2
-- Metcalfe-inspired network value snapshots.
-- Uses _v2 to avoid collision with any existing network_effect_snapshots table.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS network_effect_snapshots_v2 (
  id                        uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id               text           UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  tenant_id                 text           NOT NULL,
  investor_count            int            NOT NULL DEFAULT 0,
  active_listing_count      int            NOT NULL DEFAULT 0,
  connection_density        numeric(8,6)   NOT NULL DEFAULT 0,
  value_score               numeric(5,2)   NOT NULL DEFAULT 0,
  investor_count_score      numeric(5,2)   NOT NULL DEFAULT 0,
  liquidity_depth_score     numeric(5,2)   NOT NULL DEFAULT 0,
  match_quality_score       numeric(5,2)   NOT NULL DEFAULT 0,
  geographic_spread_score   numeric(5,2)   NOT NULL DEFAULT 0,
  network_stage             text           NOT NULL DEFAULT 'SPARK',
  cycle_velocity            numeric(6,4)   NOT NULL DEFAULT 0,
  positive_cycle            boolean        NOT NULL DEFAULT false,
  computed_at               timestamptz    NOT NULL DEFAULT now()
);

ALTER TABLE network_effect_snapshots_v2 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_network_effect_snapshots_v2 ON network_effect_snapshots_v2;
CREATE POLICY tenant_isolation_network_effect_snapshots_v2
  ON network_effect_snapshots_v2
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_network_effect_snapshots_v2_tenant_computed
  ON network_effect_snapshots_v2 (tenant_id, computed_at DESC);

CREATE INDEX IF NOT EXISTS idx_network_effect_snapshots_v2_snapshot_id
  ON network_effect_snapshots_v2 (snapshot_id);
