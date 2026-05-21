-- =============================================================================
-- Migration: 20260522000005_european_market_layer
-- Phase 5: European Real Estate Liquidity Infrastructure
--
-- Creates:
--   1. country_market_data       — per-country real-time market indicators
--   2. cross_border_deals        — deals with cross-country investor matching
--   3. institutional_investor_profiles — extends investors for institutional
--
-- All tables use RLS. Service role bypasses RLS. Tenant isolation enforced.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. country_market_data
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS country_market_data (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  country      text        NOT NULL,
  city         text,
  metric_type  text        NOT NULL,
  -- metric_type values: 'avg_price_m2', 'avg_yield', 'transaction_volume',
  --                     'days_to_close', 'liquidity_index', 'transaction_tax_pct'
  value        numeric     NOT NULL,
  currency     text        NOT NULL DEFAULT 'EUR',
  period       text        NOT NULL,  -- e.g. '2026-Q1', '2026-Q2'
  source       text,
  recorded_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(country, city, metric_type, period)
);

CREATE INDEX IF NOT EXISTS idx_country_market_data_lookup
  ON country_market_data(country, metric_type, period DESC);
CREATE INDEX IF NOT EXISTS idx_country_market_data_city
  ON country_market_data(country, city, metric_type, period DESC);

ALTER TABLE country_market_data ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'country_market_data'
      AND policyname = 'country_market_data_service_role'
  ) THEN
    CREATE POLICY country_market_data_service_role ON country_market_data
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Public read access — market data is not tenant-sensitive
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'country_market_data'
      AND policyname = 'country_market_data_authenticated_read'
  ) THEN
    CREATE POLICY country_market_data_authenticated_read ON country_market_data
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. cross_border_deals
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cross_border_deals (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid        NOT NULL REFERENCES organizations(id),
  deal_id                 text,
  property_country        text        NOT NULL,
  investor_nationality    text,
  institutional_type      text,
  deal_value_eur          numeric,
  net_yield_pct           numeric,
  deal_structure          text,
  -- deal_structure: 'direct', 'spe', 'fund', 'forward_purchase', 'reit_vehicle'
  transaction_costs_eur   numeric,
  cross_border_score      numeric,     -- final score from crossBorderRouting
  routing_recommendation  text,
  -- routing_recommendation: 'prioritize', 'include', 'deprioritize', 'exclude'
  status                  text        NOT NULL DEFAULT 'prospect',
  -- status: 'prospect', 'active', 'under_offer', 'closed', 'cancelled'
  metadata                jsonb       NOT NULL DEFAULT '{}',
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cross_border_deals_tenant
  ON cross_border_deals(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cross_border_deals_country
  ON cross_border_deals(tenant_id, property_country, status);

ALTER TABLE cross_border_deals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'cross_border_deals'
      AND policyname = 'cross_border_deals_service_role'
  ) THEN
    CREATE POLICY cross_border_deals_service_role ON cross_border_deals
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'cross_border_deals'
      AND policyname = 'cross_border_deals_tenant_isolation'
  ) THEN
    CREATE POLICY cross_border_deals_tenant_isolation ON cross_border_deals
      FOR ALL TO authenticated
      USING (
        tenant_id IN (
          SELECT organization_id FROM organization_members
          WHERE user_id = auth.uid()
        )
      )
      WITH CHECK (
        tenant_id IN (
          SELECT organization_id FROM organization_members
          WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_cross_border_deals_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_cross_border_deals_updated_at'
  ) THEN
    CREATE TRIGGER trg_cross_border_deals_updated_at
      BEFORE UPDATE ON cross_border_deals
      FOR EACH ROW EXECUTE FUNCTION update_cross_border_deals_updated_at();
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. institutional_investor_profiles
-- Extends the investors table with institutional-grade metadata.
-- One row per investor per tenant (UNIQUE constraint).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS institutional_investor_profiles (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id              uuid        NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  tenant_id                uuid        NOT NULL REFERENCES organizations(id),
  institutional_type       text        NOT NULL,
  -- institutional_type: 'bank', 'private_equity', 'reit', 'family_office',
  --                     'sovereign_wealth', 'pension_fund', 'hedge_fund'

  -- Capital
  aum_eur                  numeric,
  deployment_capacity_eur  numeric,
  min_ticket_eur           numeric,
  max_ticket_eur           numeric,

  -- Investment preferences
  target_countries         text[],
  target_property_types    text[],
  target_yield_min_pct     numeric,
  target_yield_max_pct     numeric,
  hold_period_min_years    numeric,
  hold_period_max_years    numeric,
  preferred_deal_structure text,
  -- preferred_deal_structure: 'direct', 'forward_purchase', 'portfolio', 'fund'

  -- Risk
  risk_tier                text,
  -- risk_tier: 'core', 'core_plus', 'value_add', 'opportunistic'
  leverage_target_pct      numeric     CHECK (leverage_target_pct BETWEEN 0 AND 100),

  -- Network
  co_investment_interest   boolean     NOT NULL DEFAULT false,
  anchor_deal_min_eur      numeric,

  -- Compliance
  fatf_compliant           boolean     NOT NULL DEFAULT true,
  kyc_verified             boolean     NOT NULL DEFAULT false,
  aml_cleared              boolean     NOT NULL DEFAULT false,
  kyc_verified_at          timestamptz,
  aml_cleared_at           timestamptz,

  -- Flexible extra data
  profile_data             jsonb       NOT NULL DEFAULT '{}',

  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),

  UNIQUE(investor_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_institutional_profiles_tenant
  ON institutional_investor_profiles(tenant_id, institutional_type);
CREATE INDEX IF NOT EXISTS idx_institutional_profiles_capacity
  ON institutional_investor_profiles(tenant_id, deployment_capacity_eur DESC)
  WHERE kyc_verified = true AND aml_cleared = true;
CREATE INDEX IF NOT EXISTS idx_institutional_profiles_ticket
  ON institutional_investor_profiles(tenant_id, min_ticket_eur, max_ticket_eur);

ALTER TABLE institutional_investor_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'institutional_investor_profiles'
      AND policyname = 'institutional_investor_profiles_service_role'
  ) THEN
    CREATE POLICY institutional_investor_profiles_service_role
      ON institutional_investor_profiles
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'institutional_investor_profiles'
      AND policyname = 'institutional_investor_profiles_tenant_isolation'
  ) THEN
    CREATE POLICY institutional_investor_profiles_tenant_isolation
      ON institutional_investor_profiles
      FOR ALL TO authenticated
      USING (
        tenant_id IN (
          SELECT organization_id FROM organization_members
          WHERE user_id = auth.uid()
        )
      )
      WITH CHECK (
        tenant_id IN (
          SELECT organization_id FROM organization_members
          WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_institutional_profiles_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_institutional_profiles_updated_at'
  ) THEN
    CREATE TRIGGER trg_institutional_profiles_updated_at
      BEFORE UPDATE ON institutional_investor_profiles
      FOR EACH ROW EXECUTE FUNCTION update_institutional_profiles_updated_at();
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Seed: Q2 2026 market data baseline for all 8 EU countries
-- ---------------------------------------------------------------------------
INSERT INTO country_market_data (country, city, metric_type, value, currency, period, source)
VALUES
  -- Portugal
  ('PT', 'Lisbon',    'avg_price_m2',         5000, 'EUR', '2026-Q2', 'Confidencial Imobiliário'),
  ('PT', 'Porto',     'avg_price_m2',         3643, 'EUR', '2026-Q2', 'Confidencial Imobiliário'),
  ('PT', 'Algarve',   'avg_price_m2',         3941, 'EUR', '2026-Q2', 'Confidencial Imobiliário'),
  ('PT', 'Cascais',   'avg_price_m2',         4713, 'EUR', '2026-Q2', 'Confidencial Imobiliário'),
  ('PT', NULL,        'avg_yield',            4.5,  'PCT', '2026-Q2', 'CBRE Portugal'),
  ('PT', NULL,        'days_to_close',        90,   'DAYS','2026-Q2', 'INE'),
  ('PT', NULL,        'liquidity_index',      78,   'IDX', '2026-Q2', 'Agency Group'),
  -- Spain
  ('ES', 'Madrid',    'avg_price_m2',         4500, 'EUR', '2026-Q2', 'Idealista'),
  ('ES', 'Barcelona', 'avg_price_m2',         4200, 'EUR', '2026-Q2', 'Idealista'),
  ('ES', 'Marbella',  'avg_price_m2',         5500, 'EUR', '2026-Q2', 'Idealista'),
  ('ES', NULL,        'avg_yield',            4.8,  'PCT', '2026-Q2', 'CBRE Spain'),
  ('ES', NULL,        'days_to_close',        75,   'DAYS','2026-Q2', 'INE Spain'),
  ('ES', NULL,        'liquidity_index',      82,   'IDX', '2026-Q2', 'Agency Group'),
  -- France
  ('FR', 'Paris',     'avg_price_m2',        10000, 'EUR', '2026-Q2', 'Chambre des notaires'),
  ('FR', 'Lyon',      'avg_price_m2',         4500, 'EUR', '2026-Q2', 'Chambre des notaires'),
  ('FR', NULL,        'avg_yield',            3.8,  'PCT', '2026-Q2', 'CBRE France'),
  ('FR', NULL,        'days_to_close',        90,   'DAYS','2026-Q2', 'FNAIM'),
  ('FR', NULL,        'liquidity_index',      70,   'IDX', '2026-Q2', 'Agency Group'),
  -- Germany
  ('DE', 'Berlin',    'avg_price_m2',         5500, 'EUR', '2026-Q2', 'Destatis'),
  ('DE', 'Munich',    'avg_price_m2',         8500, 'EUR', '2026-Q2', 'Destatis'),
  ('DE', 'Frankfurt', 'avg_price_m2',         6500, 'EUR', '2026-Q2', 'Destatis'),
  ('DE', NULL,        'avg_yield',            3.5,  'PCT', '2026-Q2', 'JLL Germany'),
  ('DE', NULL,        'days_to_close',        60,   'DAYS','2026-Q2', 'Destatis'),
  ('DE', NULL,        'liquidity_index',      85,   'IDX', '2026-Q2', 'Agency Group'),
  -- Netherlands
  ('NL', 'Amsterdam', 'avg_price_m2',         7000, 'EUR', '2026-Q2', 'CBS Netherlands'),
  ('NL', NULL,        'avg_yield',            3.8,  'PCT', '2026-Q2', 'CBRE Netherlands'),
  ('NL', NULL,        'days_to_close',        45,   'DAYS','2026-Q2', 'NVM'),
  ('NL', NULL,        'liquidity_index',      88,   'IDX', '2026-Q2', 'Agency Group'),
  -- Italy
  ('IT', 'Milan',     'avg_price_m2',         6000, 'EUR', '2026-Q2', 'Agenzia delle Entrate'),
  ('IT', 'Rome',      'avg_price_m2',         4500, 'EUR', '2026-Q2', 'Agenzia delle Entrate'),
  ('IT', NULL,        'avg_yield',            5.2,  'PCT', '2026-Q2', 'Scenari Immobiliari'),
  ('IT', NULL,        'days_to_close',       120,   'DAYS','2026-Q2', 'Agenzia delle Entrate'),
  ('IT', NULL,        'liquidity_index',      60,   'IDX', '2026-Q2', 'Agency Group'),
  -- Belgium
  ('BE', 'Brussels',  'avg_price_m2',         3500, 'EUR', '2026-Q2', 'Statbel'),
  ('BE', NULL,        'avg_yield',            4.0,  'PCT', '2026-Q2', 'BNP Paribas RE'),
  ('BE', NULL,        'days_to_close',        60,   'DAYS','2026-Q2', 'Statbel'),
  ('BE', NULL,        'liquidity_index',      72,   'IDX', '2026-Q2', 'Agency Group'),
  -- Austria
  ('AT', 'Vienna',    'avg_price_m2',         6000, 'EUR', '2026-Q2', 'WKO Austria'),
  ('AT', NULL,        'avg_yield',            3.6,  'PCT', '2026-Q2', 'EHL Immobilien'),
  ('AT', NULL,        'days_to_close',        60,   'DAYS','2026-Q2', 'WKO Austria'),
  ('AT', NULL,        'liquidity_index',      75,   'IDX', '2026-Q2', 'Agency Group')
ON CONFLICT (country, city, metric_type, period) DO UPDATE
  SET value = EXCLUDED.value,
      source = EXCLUDED.source,
      recorded_at = now();
