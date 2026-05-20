-- =============================================================================
-- Migration: 20260520000016_wave23_investor_marketplace
-- Wave 23: Investor Network Effect Engine
--   investor_watchlists, deal_subscriptions,
--   investor_engagement_events, liquidity_heatmap
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. investor_watchlists
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS investor_watchlists (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL REFERENCES organizations(id)
              DEFAULT '00000000-0000-0000-0000-000000000001',
  investor_id uuid        NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  property_id uuid        NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  priority    text        NOT NULL DEFAULT 'normal'
              CHECK (priority IN ('urgent','high','normal','low')),
  notes       text,
  added_at    timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz,
  UNIQUE(investor_id, property_id)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_investor
  ON investor_watchlists(tenant_id, investor_id, added_at DESC);
CREATE INDEX IF NOT EXISTS idx_watchlist_property
  ON investor_watchlists(tenant_id, property_id);

ALTER TABLE investor_watchlists ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'investor_watchlists'
      AND policyname = 'investor_watchlists_service_role'
  ) THEN
    CREATE POLICY investor_watchlists_service_role ON investor_watchlists
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. deal_subscriptions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS deal_subscriptions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid        NOT NULL REFERENCES organizations(id)
                      DEFAULT '00000000-0000-0000-0000-000000000001',
  investor_id         uuid        NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  min_price_eur       numeric,
  max_price_eur       numeric,
  min_yield_pct       numeric,
  geography           text[],
  property_types      text[],
  min_match_score     integer     DEFAULT 60,
  active              boolean     NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  last_triggered_at   timestamptz,
  trigger_count       integer     NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_investor
  ON deal_subscriptions(tenant_id, investor_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active
  ON deal_subscriptions(tenant_id, active) WHERE active = true;

ALTER TABLE deal_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'deal_subscriptions'
      AND policyname = 'deal_subscriptions_service_role'
  ) THEN
    CREATE POLICY deal_subscriptions_service_role ON deal_subscriptions
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. investor_engagement_events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS investor_engagement_events (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid        NOT NULL REFERENCES organizations(id)
                      DEFAULT '00000000-0000-0000-0000-000000000001',
  investor_id         uuid        NOT NULL REFERENCES investors(id),
  event_type          text        NOT NULL
                      CHECK (event_type IN (
                        'match_viewed','property_saved','deal_pack_opened',
                        'call_booked','offer_made','deal_closed',
                        'offer_rejected','unsubscribed'
                      )),
  property_id         uuid        REFERENCES properties(id),
  match_score         integer,
  response_time_hours numeric,
  metadata            jsonb       NOT NULL DEFAULT '{}',
  occurred_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_engagement_investor
  ON investor_engagement_events(tenant_id, investor_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_type
  ON investor_engagement_events(tenant_id, event_type, occurred_at DESC);

ALTER TABLE investor_engagement_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'investor_engagement_events'
      AND policyname = 'investor_engagement_events_service_role'
  ) THEN
    CREATE POLICY investor_engagement_events_service_role ON investor_engagement_events
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. liquidity_heatmap
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS liquidity_heatmap (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid        NOT NULL REFERENCES organizations(id)
                   DEFAULT '00000000-0000-0000-0000-000000000001',
  zone             text        NOT NULL,
  country          text        NOT NULL DEFAULT 'PT',
  active_listings  integer     NOT NULL DEFAULT 0,
  active_investors integer     NOT NULL DEFAULT 0,
  pending_matches  integer     NOT NULL DEFAULT 0,
  avg_match_score  numeric,
  demand_score     numeric,
  supply_score     numeric,
  heat_index       numeric,
  snapshot_date    date        NOT NULL,
  computed_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, zone, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_heatmap_zone
  ON liquidity_heatmap(tenant_id, zone, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_heatmap_heat
  ON liquidity_heatmap(tenant_id, heat_index DESC, snapshot_date DESC);

ALTER TABLE liquidity_heatmap ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'liquidity_heatmap'
      AND policyname = 'liquidity_heatmap_service_role'
  ) THEN
    CREATE POLICY liquidity_heatmap_service_role ON liquidity_heatmap
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
