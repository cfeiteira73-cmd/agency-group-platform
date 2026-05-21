-- =============================================================================
-- Agency Group — Behavioral Investor Model & Capital Allocation Engine
-- Migration: 20260522000022_behavioral_investor.sql
--
-- Creates:
--   • investor_behavioral_profiles   — per-investor behavioral signals
--   • capital_deployment_patterns    — monthly capital flow tracking
--   • allocation_decisions           — property-level allocation decisions
-- =============================================================================

-- ─── investor_behavioral_profiles ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.investor_behavioral_profiles (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id                 uuid NOT NULL,
  tenant_id                   uuid NOT NULL,
  investor_type               text NOT NULL DEFAULT 'hnwi',
  avg_bid_to_ask_ratio        numeric(6,4)  NOT NULL DEFAULT 0.9500,
  avg_time_to_decision_days   numeric(8,2)  NOT NULL DEFAULT 30,
  preferred_zones             jsonb         NOT NULL DEFAULT '[]',
  preferred_property_types    jsonb         NOT NULL DEFAULT '[]',
  preferred_price_range_min   numeric(15,2) NOT NULL DEFAULT 0,
  preferred_price_range_max   numeric(15,2) NOT NULL DEFAULT 10000000,
  avg_capital_deployment_eur  numeric(15,2) NOT NULL DEFAULT 0,
  conversion_rate             numeric(5,4)  NOT NULL DEFAULT 0,
  urgency_pattern             text          NOT NULL DEFAULT 'deliberate'
                                CHECK (urgency_pattern IN ('decisive', 'deliberate', 'opportunistic')),
  capital_velocity_score      numeric(5,4)  NOT NULL DEFAULT 0,
  market_sensitivity          numeric(5,4)  NOT NULL DEFAULT 0,
  loyalty_score               numeric(5,4)  NOT NULL DEFAULT 0,
  updated_at                  timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, investor_id)
);

CREATE INDEX IF NOT EXISTS idx_ibp_tenant_investor
  ON public.investor_behavioral_profiles(tenant_id, investor_id);

CREATE INDEX IF NOT EXISTS idx_ibp_tenant_type
  ON public.investor_behavioral_profiles(tenant_id, investor_type);

COMMENT ON TABLE public.investor_behavioral_profiles IS
  'Statistical behavioral model per investor — derived from bid history and deal outcomes.';

COMMENT ON COLUMN public.investor_behavioral_profiles.avg_bid_to_ask_ratio IS
  'Historical ratio of bid_price / ask_price — 0.95 means bids at 95% of ask.';

COMMENT ON COLUMN public.investor_behavioral_profiles.urgency_pattern IS
  'decisive = mostly immediate urgency; deliberate = within_90d; opportunistic = flexible.';

COMMENT ON COLUMN public.investor_behavioral_profiles.capital_velocity_score IS
  '0–1 score: how quickly this investor deploys capital (fast decisions + high activity).';

-- ─── capital_deployment_patterns ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.capital_deployment_patterns (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id             uuid    NOT NULL,
  tenant_id               uuid    NOT NULL,
  period                  text    NOT NULL,  -- 'YYYY-MM'
  capital_committed_eur   numeric(15,2) NOT NULL DEFAULT 0,
  capital_deployed_eur    numeric(15,2) NOT NULL DEFAULT 0,
  capital_withdrawn_eur   numeric(15,2) NOT NULL DEFAULT 0,
  avg_days_to_close       numeric(8,2),
  deployment_rate         numeric(5,4)  NOT NULL DEFAULT 0,
  zone_allocation         jsonb         NOT NULL DEFAULT '{}',
  type_allocation         jsonb         NOT NULL DEFAULT '{}',
  is_active_deployer      boolean       NOT NULL DEFAULT false,
  deployment_trend        text          NOT NULL DEFAULT 'stable'
                            CHECK (deployment_trend IN ('increasing', 'stable', 'decreasing')),
  computed_at             timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, investor_id, period)
);

CREATE INDEX IF NOT EXISTS idx_cdp_tenant_investor
  ON public.capital_deployment_patterns(tenant_id, investor_id);

CREATE INDEX IF NOT EXISTS idx_cdp_tenant_period
  ON public.capital_deployment_patterns(tenant_id, period);

CREATE INDEX IF NOT EXISTS idx_cdp_active_deployers
  ON public.capital_deployment_patterns(tenant_id, period, is_active_deployer)
  WHERE is_active_deployer = true;

COMMENT ON TABLE public.capital_deployment_patterns IS
  'Monthly capital flow tracking per investor — committed vs deployed vs withdrawn.';

COMMENT ON COLUMN public.capital_deployment_patterns.deployment_rate IS
  'Ratio of capital_deployed_eur / capital_committed_eur (0–1).';

COMMENT ON COLUMN public.capital_deployment_patterns.deployment_trend IS
  'Trend vs previous 2 months: increasing (>1.2×), decreasing (<0.8×), or stable.';

-- ─── allocation_decisions ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.allocation_decisions (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id                     uuid          NOT NULL,
  tenant_id                       uuid          NOT NULL,
  strategy                        text          NOT NULL DEFAULT 'balanced',
  ranked_investors                jsonb         NOT NULL DEFAULT '[]',
  recommended_ask_adjustment_pct  numeric(8,4)  NOT NULL DEFAULT 0,
  time_sensitivity                text          NOT NULL DEFAULT 'standard'
                                    CHECK (time_sensitivity IN ('urgent', 'standard', 'flexible')),
  allocation_confidence           numeric(5,4)  NOT NULL DEFAULT 0,
  computed_at                     timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, property_id)
);

CREATE INDEX IF NOT EXISTS idx_allocation_tenant_property
  ON public.allocation_decisions(tenant_id, property_id);

CREATE INDEX IF NOT EXISTS idx_allocation_tenant_sensitivity
  ON public.allocation_decisions(tenant_id, time_sensitivity);

CREATE INDEX IF NOT EXISTS idx_allocation_confidence
  ON public.allocation_decisions(tenant_id, allocation_confidence DESC);

COMMENT ON TABLE public.allocation_decisions IS
  'One active allocation decision per property — which investors to contact and in what order.';

COMMENT ON COLUMN public.allocation_decisions.ranked_investors IS
  'JSON array of {investor_id, rank, optimized_score, expected_yield, expected_close_days, conviction, recommended_action}.';

COMMENT ON COLUMN public.allocation_decisions.recommended_ask_adjustment_pct IS
  'Positive = raise ask; negative = lower ask. Based on avg bid vs current ask.';
