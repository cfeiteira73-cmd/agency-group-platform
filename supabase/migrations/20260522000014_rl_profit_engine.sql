-- Agency Group — RL Profit Engine
-- Migration: 20260522000014_rl_profit_engine.sql
--
-- Creates:
--   rl_episodes    — one row per recommendation action/outcome episode
--   profit_labels  — ground-truth profit quality labels for ML training
--
-- RLS: service_role full access only (no authenticated read).

-- ============================================================
-- rl_episodes
-- ============================================================

CREATE TABLE IF NOT EXISTS rl_episodes (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid        NOT NULL REFERENCES organizations(id),
  property_id          text        NOT NULL,
  investor_id          text        NOT NULL,
  action               text        NOT NULL CHECK (action IN ('recommend','rank_high','rank_low','reject')),
  state                jsonb       NOT NULL DEFAULT '{}',
  action_taken_at      timestamptz NOT NULL DEFAULT now(),
  reward               numeric,
  actual_profit_eur    numeric,
  time_to_close_days   integer,
  liquidity_efficiency numeric,
  outcome_recorded_at  timestamptz,
  episode_complete     boolean     NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_rl_episodes_tenant
  ON rl_episodes(tenant_id, episode_complete, action_taken_at DESC);

CREATE INDEX IF NOT EXISTS idx_rl_episodes_entity
  ON rl_episodes(tenant_id, property_id, investor_id);

-- RLS
ALTER TABLE rl_episodes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'rl_episodes'
      AND policyname = 'service_role_rl_episodes'
  ) THEN
    CREATE POLICY service_role_rl_episodes
      ON rl_episodes
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- profit_labels
-- ============================================================

CREATE TABLE IF NOT EXISTS profit_labels (
  id                         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                  uuid        NOT NULL REFERENCES organizations(id),
  deal_id                    text        NOT NULL,
  property_id                text,
  investor_id                text,
  gross_deal_value_eur       numeric     NOT NULL,
  commission_eur             numeric     NOT NULL,
  net_profit_eur             numeric     NOT NULL,
  profit_margin_pct          numeric     NOT NULL,
  time_to_close_days         integer     NOT NULL,
  days_on_market             integer,
  time_efficiency_score      numeric     NOT NULL,
  competing_bids_count       integer     NOT NULL DEFAULT 0,
  final_price_vs_ask_pct     numeric     NOT NULL DEFAULT 0,
  liquidity_efficiency_score numeric     NOT NULL DEFAULT 0,
  label_value                numeric     NOT NULL,
  label_class                text        NOT NULL CHECK (label_class IN ('excellent','good','acceptable','poor')),
  created_at                 timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profit_labels_tenant
  ON profit_labels(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_profit_labels_deal
  ON profit_labels(deal_id);

-- RLS
ALTER TABLE profit_labels ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profit_labels'
      AND policyname = 'service_role_profit_labels'
  ) THEN
    CREATE POLICY service_role_profit_labels
      ON profit_labels
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
