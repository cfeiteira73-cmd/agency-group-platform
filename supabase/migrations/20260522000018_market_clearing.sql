-- =============================================================================
-- Agency Group — Market Clearing Tables
-- Migration: 20260522000018_market_clearing.sql
--
-- Tables:
--   market_clearing_snapshots — price discovery results per property
--   zone_clearing_snapshots   — daily zone-level clearing aggregates
--
-- RLS: service_role only on both tables
-- =============================================================================

-- ─── market_clearing_snapshots ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS market_clearing_snapshots (
  id                           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                    uuid        NOT NULL REFERENCES organizations(id),
  property_id                  uuid        REFERENCES properties(id) ON DELETE SET NULL,
  ask_price_eur                numeric,
  clearing_price_eur           numeric     NOT NULL,
  price_discovery_confidence   numeric     NOT NULL DEFAULT 0,
  active_bid_count             integer     NOT NULL DEFAULT 0,
  total_capital_committed_eur  numeric     NOT NULL DEFAULT 0,
  bids_above_ask               integer     NOT NULL DEFAULT 0,
  bids_below_ask               integer     NOT NULL DEFAULT 0,
  supply_pressure              numeric     NOT NULL DEFAULT 0,
  demand_pressure              numeric     NOT NULL DEFAULT 0,
  market_equilibrium           text        NOT NULL DEFAULT 'balanced'
                               CHECK (market_equilibrium IN ('undersupply','balanced','oversupply')),
  price_direction              text        NOT NULL DEFAULT 'stable'
                               CHECK (price_direction IN ('rising','stable','declining')),
  estimated_price_change_30d_pct numeric   NOT NULL DEFAULT 0,
  absorption_rate_days         integer     NOT NULL DEFAULT 90,
  computed_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clearing_property
  ON market_clearing_snapshots(tenant_id, property_id, computed_at DESC);

CREATE INDEX IF NOT EXISTS idx_clearing_tenant
  ON market_clearing_snapshots(tenant_id, computed_at DESC);

-- ─── zone_clearing_snapshots ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS zone_clearing_snapshots (
  id                           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                    uuid        NOT NULL REFERENCES organizations(id),
  zone                         text        NOT NULL,
  active_listings              integer     NOT NULL DEFAULT 0,
  total_bids                   integer     NOT NULL DEFAULT 0,
  avg_clearing_price_eur       numeric,
  avg_price_deviation_pct      numeric     NOT NULL DEFAULT 0,
  zone_supply_pressure         numeric     NOT NULL DEFAULT 0,
  zone_demand_pressure         numeric     NOT NULL DEFAULT 0,
  zone_equilibrium             text        NOT NULL DEFAULT 'balanced'
                               CHECK (zone_equilibrium IN ('undersupply','balanced','oversupply')),
  capital_velocity_eur_per_day numeric     NOT NULL DEFAULT 0,
  snapshot_date                date        NOT NULL DEFAULT CURRENT_DATE,
  computed_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, zone, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_zone_clearing
  ON zone_clearing_snapshots(tenant_id, zone, snapshot_date DESC);

-- ─── RLS: service_role only ───────────────────────────────────────────────────

ALTER TABLE market_clearing_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'market_clearing_snapshots'
      AND policyname = 'service_role_only'
  ) THEN
    CREATE POLICY service_role_only
      ON market_clearing_snapshots
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

ALTER TABLE zone_clearing_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'zone_clearing_snapshots'
      AND policyname = 'service_role_only'
  ) THEN
    CREATE POLICY service_role_only
      ON zone_clearing_snapshots
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
