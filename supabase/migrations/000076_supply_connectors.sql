-- =============================================================================
-- Agency Group — Supply Connectors Migration
-- supabase/migrations/000076_supply_connectors.sql
--
-- Creates:
--   1. public_registry_transactions — official AT/INE/Predial transaction data
--
-- Note: raw_opportunity_stream already created by 000072_supply_layer.sql.
--       All connectors (Citius, Bank NPL, Broker CRM) write to that table.
--
-- RLS: tenant_isolation on all tables.
-- Indexes: optimised for price calibration and market truth queries.
-- =============================================================================

-- ─── 1. public_registry_transactions ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public_registry_transactions (
  id                           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id               text          UNIQUE NOT NULL,
  tenant_id                    text          NOT NULL DEFAULT 'system',
  country                      text          NOT NULL,
  city                         text          NOT NULL,
  district                     text,
  property_type                text          NOT NULL DEFAULT 'RESIDENTIAL',
  size_sqm                     numeric(10,2),
  transaction_price_eur_cents  bigint        NOT NULL,
  price_per_sqm_eur_cents      bigint,
  transaction_date             timestamptz,
  is_official                  boolean       NOT NULL DEFAULT true,
  confidence_score             numeric(4,3)  NOT NULL DEFAULT 0.95,
  raw_payload                  jsonb         NOT NULL DEFAULT '{}',
  ingested_at                  timestamptz   NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_prt_country_city_date
  ON public_registry_transactions (country, city, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_prt_city_type_date
  ON public_registry_transactions (city, property_type, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_prt_price_per_sqm
  ON public_registry_transactions (price_per_sqm_eur_cents);

CREATE INDEX IF NOT EXISTS idx_prt_tenant_id
  ON public_registry_transactions (tenant_id);

CREATE INDEX IF NOT EXISTS idx_prt_ingested_at
  ON public_registry_transactions (ingested_at DESC);

-- RLS
ALTER TABLE public_registry_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON public_registry_transactions;
CREATE POLICY "tenant_isolation"
  ON public_registry_transactions
  USING (
    tenant_id = current_setting('app.tenant_id', true)
    OR tenant_id = 'system'
  );
