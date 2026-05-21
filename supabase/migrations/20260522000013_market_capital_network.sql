-- =============================================================================
-- Agency Group — Market Capital Network
-- Migration: 20260522000013_market_capital_network.sql
--
-- Tables: investor_bids, bid_books, market_depth_snapshots, capital_flows
-- RLS: service_role only for all 4 tables
-- =============================================================================

-- ─── investor_bids ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS investor_bids (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid        NOT NULL REFERENCES organizations(id),
  property_id      uuid        NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  investor_id      uuid        NOT NULL REFERENCES investors(id)  ON DELETE CASCADE,
  max_price_eur    numeric     NOT NULL,
  yield_target_pct numeric     NOT NULL,
  urgency_level    text        NOT NULL CHECK (urgency_level  IN ('immediate','within_30d','within_90d','flexible')),
  risk_tolerance   text        NOT NULL CHECK (risk_tolerance IN ('low','medium','high','opportunistic')),
  bid_price_eur    numeric     NOT NULL,
  bid_score        numeric     NOT NULL DEFAULT 0,
  status           text        NOT NULL DEFAULT 'active' CHECK (status IN ('active','withdrawn','accepted','outbid')),
  submitted_at     timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_investor_bids_property
  ON investor_bids(tenant_id, property_id, status);

CREATE INDEX IF NOT EXISTS idx_investor_bids_investor
  ON investor_bids(tenant_id, investor_id, status);

-- ─── bid_books (materialized snapshot) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS bid_books (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid        NOT NULL REFERENCES organizations(id),
  property_id           uuid        NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  total_bids            integer     NOT NULL DEFAULT 0,
  active_bids           integer     NOT NULL DEFAULT 0,
  highest_bid_eur       numeric,
  lowest_bid_eur        numeric,
  avg_bid_eur           numeric,
  demand_pressure_score numeric     NOT NULL DEFAULT 0,
  competitive_intensity numeric     NOT NULL DEFAULT 0,
  bid_spread_pct        numeric,
  capital_committed_eur numeric     NOT NULL DEFAULT 0,
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, property_id)
);

-- ─── market_depth_snapshots ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS market_depth_snapshots (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid        NOT NULL REFERENCES organizations(id),
  property_id           uuid        REFERENCES properties(id) ON DELETE SET NULL,
  zone                  text,
  liquidity_score       numeric,
  price_pressure_index  numeric,
  capital_committed_eur numeric,
  active_bids           integer,
  market_verdict        text,
  snapshot_date         date        NOT NULL DEFAULT CURRENT_DATE,
  computed_at           timestamptz NOT NULL DEFAULT now()
);

-- ─── capital_flows ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS capital_flows (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid        NOT NULL REFERENCES organizations(id),
  zone           text        NOT NULL,
  flow_date      date        NOT NULL DEFAULT CURRENT_DATE,
  capital_eur    numeric     NOT NULL DEFAULT 0,
  bid_count      integer     NOT NULL DEFAULT 0,
  deal_count     integer     NOT NULL DEFAULT 0,
  velocity_index numeric,
  UNIQUE(tenant_id, zone, flow_date)
);

-- ─── Row Level Security ───────────────────────────────────────────────────────

-- investor_bids
ALTER TABLE investor_bids ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'investor_bids' AND policyname = 'investor_bids_service_role'
  ) THEN
    CREATE POLICY investor_bids_service_role ON investor_bids
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- bid_books
ALTER TABLE bid_books ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'bid_books' AND policyname = 'bid_books_service_role'
  ) THEN
    CREATE POLICY bid_books_service_role ON bid_books
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- market_depth_snapshots
ALTER TABLE market_depth_snapshots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'market_depth_snapshots' AND policyname = 'market_depth_snapshots_service_role'
  ) THEN
    CREATE POLICY market_depth_snapshots_service_role ON market_depth_snapshots
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- capital_flows
ALTER TABLE capital_flows ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'capital_flows' AND policyname = 'capital_flows_service_role'
  ) THEN
    CREATE POLICY capital_flows_service_role ON capital_flows
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
