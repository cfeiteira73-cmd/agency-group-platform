-- =============================================================================
-- Agency Group — Capital Intelligence Tables
-- Migration: 000075_capital_intel.sql
-- Wave 42: Investor profiling, matching, demand signals, ROI simulations
-- All EUR amounts in bigint (cents) — never float for money
-- =============================================================================

-- ─── investor_capital_profiles ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS investor_capital_profiles (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id                 text NOT NULL,
  tenant_id                   text NOT NULL,
  segment                     text,
  available_capital_eur_cents bigint  DEFAULT 0,
  preferred_markets           jsonb   DEFAULT '[]',
  preferred_property_types    jsonb   DEFAULT '[]',
  min_ticket_eur_cents        bigint  DEFAULT 0,
  max_ticket_eur_cents        bigint  DEFAULT 0,
  target_roi_pct              numeric(6,3) DEFAULT 8,
  risk_tolerance              text    DEFAULT 'MEDIUM',
  avg_days_to_decision        int,
  bid_win_rate                numeric(4,3) DEFAULT 0,
  last_activity_at            timestamptz,
  profile_confidence          numeric(4,3) DEFAULT 0.5,
  updated_at                  timestamptz DEFAULT now(),
  UNIQUE (investor_id, tenant_id)
);

ALTER TABLE investor_capital_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_investor_capital_profiles ON investor_capital_profiles;
CREATE POLICY tenant_isolation_investor_capital_profiles
  ON investor_capital_profiles
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_investor_capital_profiles_investor_tenant
  ON investor_capital_profiles (investor_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_investor_capital_profiles_tenant_segment
  ON investor_capital_profiles (tenant_id, segment);

-- ─── capital_appetite_snapshots ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS capital_appetite_snapshots (
  id                                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                         text,
  total_investors                   int,
  active_investors                  int,
  total_available_capital_eur_cents bigint,
  by_segment                        jsonb DEFAULT '{}',
  by_market                         jsonb DEFAULT '{}',
  avg_ticket_eur_cents              bigint,
  generated_at                      timestamptz DEFAULT now()
);

ALTER TABLE capital_appetite_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_capital_appetite_snapshots ON capital_appetite_snapshots;
CREATE POLICY tenant_isolation_capital_appetite_snapshots
  ON capital_appetite_snapshots
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_capital_appetite_snapshots_tenant_generated
  ON capital_appetite_snapshots (tenant_id, generated_at DESC);

-- ─── opportunity_demand_signals ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS opportunity_demand_signals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id  text NOT NULL,
  tenant_id       text NOT NULL,
  view_count      int  DEFAULT 0,
  bid_count       int  DEFAULT 0,
  close_count     int  DEFAULT 0,
  reject_count    int  DEFAULT 0,
  demand_score    int  DEFAULT 0,
  last_signal_at  timestamptz DEFAULT now(),
  UNIQUE (opportunity_id, tenant_id)
);

ALTER TABLE opportunity_demand_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_opportunity_demand_signals ON opportunity_demand_signals;
CREATE POLICY tenant_isolation_opportunity_demand_signals
  ON opportunity_demand_signals
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_opportunity_demand_signals_opportunity
  ON opportunity_demand_signals (opportunity_id);

CREATE INDEX IF NOT EXISTS idx_opportunity_demand_signals_tenant_score
  ON opportunity_demand_signals (tenant_id, demand_score DESC);

-- ─── opportunity_investor_matches ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS opportunity_investor_matches (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id              text UNIQUE NOT NULL,
  tenant_id             text,
  opportunity_id        text NOT NULL,
  investor_id           text NOT NULL,
  match_score           numeric(5,2),
  match_reasons         jsonb DEFAULT '[]',
  bid_likelihood        numeric(4,3),
  expected_bid_eur_cents bigint,
  priority              text DEFAULT 'MEDIUM',
  notification_sent     boolean DEFAULT false,
  notified_at           timestamptz,
  investor_response     text,
  responded_at          timestamptz,
  created_at            timestamptz DEFAULT now(),
  UNIQUE (opportunity_id, investor_id)
);

ALTER TABLE opportunity_investor_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_opportunity_investor_matches ON opportunity_investor_matches;
CREATE POLICY tenant_isolation_opportunity_investor_matches
  ON opportunity_investor_matches
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_opp_investor_matches_opportunity_investor
  ON opportunity_investor_matches (opportunity_id, investor_id);

CREATE INDEX IF NOT EXISTS idx_opp_investor_matches_tenant_score
  ON opportunity_investor_matches (tenant_id, match_score DESC);

CREATE INDEX IF NOT EXISTS idx_opp_investor_matches_tenant_created
  ON opportunity_investor_matches (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_opp_investor_matches_investor_tenant
  ON opportunity_investor_matches (investor_id, tenant_id);

-- ─── roi_simulations ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS roi_simulations (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id            text UNIQUE,
  tenant_id                text,
  opportunity_id           text,
  simulations_run          int     DEFAULT 1000,
  roi_p10                  numeric(8,4),
  roi_p50                  numeric(8,4),
  roi_p90                  numeric(8,4),
  roi_mean                 numeric(8,4),
  roi_std                  numeric(8,4),
  scenario_bull_eur_cents  bigint,
  scenario_base_eur_cents  bigint,
  scenario_bear_eur_cents  bigint,
  probability_of_loss      numeric(4,3),
  max_drawdown_pct         numeric(8,4),
  sharpe_ratio             numeric(6,3),
  simulated_at             timestamptz DEFAULT now()
);

ALTER TABLE roi_simulations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_roi_simulations ON roi_simulations;
CREATE POLICY tenant_isolation_roi_simulations
  ON roi_simulations
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_roi_simulations_opportunity
  ON roi_simulations (opportunity_id);

CREATE INDEX IF NOT EXISTS idx_roi_simulations_tenant_simulated
  ON roi_simulations (tenant_id, simulated_at DESC);

CREATE INDEX IF NOT EXISTS idx_roi_simulations_opportunity_simulated
  ON roi_simulations (opportunity_id, simulated_at DESC);
