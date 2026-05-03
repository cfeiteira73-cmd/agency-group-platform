-- =============================================================================
-- Agency Group — Platform Config Table
-- Migration: 20260503_008_platform_config.sql
--
-- Creates a DB-backed configuration table for business thresholds that were
-- previously hardcoded in API routes. This enables ops_manager+ to tune
-- scoring thresholds, alert cooldowns, and revenue parameters without
-- code deploys.
--
-- CATEGORIES:
--   scoring      — lead/deal scoring thresholds
--   alerts       — alert trigger and cooldown controls
--   distribution — routing and decay settings
--   revenue      — commission and split parameters
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS platform_config (
  config_key     TEXT         PRIMARY KEY,
  value_numeric  NUMERIC,
  value_text     TEXT,
  value_boolean  BOOLEAN,
  value_json     JSONB,
  config_type    TEXT         NOT NULL DEFAULT 'numeric'
                   CHECK (config_type IN ('numeric','text','boolean','json')),
  description    TEXT,
  category       TEXT         NOT NULL DEFAULT 'general',
  is_sensitive   BOOLEAN      NOT NULL DEFAULT false,
  updated_by     TEXT,
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE platform_config IS
  'DB-backed platform configuration for business thresholds. Replaces hardcoded magic numbers.';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_platform_config_category
  ON platform_config (category);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE platform_config ENABLE ROW LEVEL SECURITY;

-- Service role (backend) can do everything
CREATE POLICY "service_role_all_platform_config"
  ON platform_config
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can read (the API layer enforces ops_manager+)
CREATE POLICY "authenticated_read_platform_config"
  ON platform_config
  FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- Seed: default values for all known thresholds
-- ---------------------------------------------------------------------------

INSERT INTO platform_config
  (config_key, value_numeric, config_type, category, description)
VALUES
  -- SCORING ----------------------------------------------------------------
  ('scoring.ataque_threshold',         88,   'numeric', 'scoring',
   'Lead score ≥ this value triggers red Ataque! alert (P0 + WA)'),
  ('scoring.high_priority_threshold',  80,   'numeric', 'scoring',
   'Lead score ≥ this value → P0 alert (email + WhatsApp)'),
  ('scoring.money_priority_threshold', 60,   'numeric', 'scoring',
   'money_priority_score ≥ this value → P0 alert (combined with high_priority)'),
  ('scoring.cpcv_readiness_threshold', 80,   'numeric', 'scoring',
   'deal_readiness_score ≥ this → CPCV trigger classification'),
  ('scoring.qualification_threshold',  70,   'numeric', 'scoring',
   'lead_score ≥ this → basic qualified lead'),
  ('scoring.scarcity_threshold',       60,   'numeric', 'scoring',
   'scarcity_score ≥ this → zone scarcity detected'),
  ('scoring.master_attack_rank_min',   75,   'numeric', 'scoring',
   'master_attack_rank ≥ this → P0 alert tier'),
  ('scoring.cpcv_probability_min',     65,   'numeric', 'scoring',
   'cpcv_prob ≥ this (combined with readiness_threshold for CPCV_TRIGGER)'),

  -- ALERTS -----------------------------------------------------------------
  ('alerts.p0_cooldown_hours',          6,   'numeric', 'alerts',
   'Minimum hours between repeated P0 alerts for same lead'),
  ('alerts.p1_cooldown_hours',         24,   'numeric', 'alerts',
   'Minimum hours between repeated P1 alerts for same lead'),
  ('alerts.deal_pack_auto_score',      80,   'numeric', 'alerts',
   'Lead score ≥ this → automatically generate and send deal pack'),

  -- DISTRIBUTION -----------------------------------------------------------
  ('distribution.max_active_agents',   10,   'numeric', 'distribution',
   'Maximum agents to route a lead to in parallel'),
  ('distribution.score_decay_days',    14,   'numeric', 'distribution',
   'Days before a lead score is considered stale and recalculated'),

  -- REVENUE ----------------------------------------------------------------
  ('revenue.commission_pct',          5.0,   'numeric', 'revenue',
   'Standard commission percentage (AMI 22506)'),
  ('revenue.cpcv_split_pct',         50.0,   'numeric', 'revenue',
   'Percentage of commission collected at CPCV signing'),
  ('revenue.escritura_split_pct',    50.0,   'numeric', 'revenue',
   'Percentage of commission collected at Escritura')

ON CONFLICT (config_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Updated_at trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_platform_config_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_platform_config_updated_at ON platform_config;
CREATE TRIGGER trg_platform_config_updated_at
  BEFORE UPDATE ON platform_config
  FOR EACH ROW EXECUTE FUNCTION update_platform_config_updated_at();
