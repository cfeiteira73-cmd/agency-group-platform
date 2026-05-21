-- =============================================================================
-- Agency Group — Market Microstructure Engine Tables
-- Migration: 20260522000021_market_microstructure.sql
--
-- Creates:
--   bid_competition_events    — competition signals per new bid event
--   perceived_value_cache     — adjusted market value per property (UPSERT cache)
--   market_pressure_snapshots — MPI time series (property / zone / global)
--   network_effect_snapshots  — daily capital market flywheel metrics
-- =============================================================================

-- ---------------------------------------------------------------------------
-- bid_competition_events
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.bid_competition_events (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id           uuid        NOT NULL,
  tenant_id             uuid        NOT NULL,
  event_type            text        NOT NULL
    CHECK (event_type IN ('new_bid', 'outbid', 'urgency_escalation', 'price_discovery_update')),
  trigger_investor_id   uuid,
  affected_investor_ids jsonb       NOT NULL DEFAULT '[]',
  new_clearing_price    numeric(15, 2),
  competition_intensity numeric(5,  4) NOT NULL DEFAULT 0
    CHECK (competition_intensity >= 0 AND competition_intensity <= 1),
  urgency_heat          numeric(5,  4) NOT NULL DEFAULT 0
    CHECK (urgency_heat >= 0 AND urgency_heat <= 1),
  recommended_action    text
    CHECK (recommended_action IN ('hold', 'escalate_bid', 'withdraw', 'accept')),
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bid_competition_property
  ON public.bid_competition_events (tenant_id, property_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bid_competition_trigger
  ON public.bid_competition_events (tenant_id, trigger_investor_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- perceived_value_cache
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.perceived_value_cache (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id           uuid        NOT NULL,
  tenant_id             uuid        NOT NULL,
  base_value            numeric(15, 2) NOT NULL,
  adjusted_value        numeric(15, 2) NOT NULL,
  total_adjustment_pct  numeric(8,  4) NOT NULL,
  factors               jsonb          NOT NULL DEFAULT '{}',
  confidence            numeric(5,  4) NOT NULL DEFAULT 0,
  valid_until           timestamptz    NOT NULL,
  computed_at           timestamptz    NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, property_id)
);

CREATE INDEX IF NOT EXISTS idx_perceived_value_lookup
  ON public.perceived_value_cache (tenant_id, property_id);

CREATE INDEX IF NOT EXISTS idx_perceived_value_expiry
  ON public.perceived_value_cache (valid_until);

-- ---------------------------------------------------------------------------
-- market_pressure_snapshots
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.market_pressure_snapshots (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  scope                text        NOT NULL
    CHECK (scope IN ('property', 'zone', 'global')),
  scope_id             text        NOT NULL,
  tenant_id            uuid        NOT NULL,
  supply_pressure      numeric(6,  2) NOT NULL DEFAULT 0,
  demand_pressure      numeric(6,  2) NOT NULL DEFAULT 0,
  urgency_heat         numeric(6,  2) NOT NULL DEFAULT 0,
  capital_saturation   numeric(6,  2) NOT NULL DEFAULT 0,
  mpi_score            numeric(6,  2) NOT NULL DEFAULT 0,
  mpi_label            text        NOT NULL DEFAULT 'balanced',
  trend                text        NOT NULL DEFAULT 'stable'
    CHECK (trend IN ('rising', 'stable', 'falling')),
  computed_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_market_pressure_lookup
  ON public.market_pressure_snapshots (tenant_id, scope, scope_id, computed_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_pressure_label
  ON public.market_pressure_snapshots (tenant_id, mpi_label, computed_at DESC);

-- ---------------------------------------------------------------------------
-- network_effect_snapshots
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.network_effect_snapshots (
  id                            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                     uuid    NOT NULL,
  period                        date    NOT NULL,
  active_investors              integer NOT NULL DEFAULT 0,
  active_properties             integer NOT NULL DEFAULT 0,
  total_active_bids             integer NOT NULL DEFAULT 0,
  competition_index             numeric(8,  4) NOT NULL DEFAULT 0,
  price_accuracy_score          numeric(6,  2) NOT NULL DEFAULT 0,
  capital_velocity              numeric(15, 2) NOT NULL DEFAULT 0,
  network_density               numeric(5,  4) NOT NULL DEFAULT 0,
  flywheel_score                numeric(6,  2) NOT NULL DEFAULT 0,
  flywheel_stage                text           NOT NULL DEFAULT 'seed'
    CHECK (flywheel_stage IN ('seed', 'growth', 'acceleration', 'maturity')),
  capital_inflow_estimate_eur   numeric(15, 2) NOT NULL DEFAULT 0,
  computed_at                   timestamptz    NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, period)
);

CREATE INDEX IF NOT EXISTS idx_network_effect_lookup
  ON public.network_effect_snapshots (tenant_id, period DESC);

CREATE INDEX IF NOT EXISTS idx_network_effect_stage
  ON public.network_effect_snapshots (tenant_id, flywheel_stage, period DESC);
