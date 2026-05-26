-- Agency Group — Data Provider Infrastructure
-- Migration: 000096_providers.sql

-- Provider connection registry
CREATE TABLE IF NOT EXISTS provider_connections (
  provider_id       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID         NOT NULL,
  provider_name     TEXT         NOT NULL,
  provider_type     TEXT         NOT NULL,  -- 'PROPERTY_LISTING' | 'JUDICIAL_AUCTION' | 'BANK_NPL' | 'MARKET_DATA'
  status            TEXT         NOT NULL DEFAULT 'NOT_CONFIGURED',
  env_var_key       TEXT         NOT NULL,
  base_url          TEXT,
  trust_score       NUMERIC(4,2),
  is_configured     BOOLEAN      NOT NULL DEFAULT FALSE,
  last_health_check TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, provider_name)
);

-- Provider sync logs
CREATE TABLE IF NOT EXISTS provider_sync_logs (
  sync_id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID         NOT NULL,
  provider          TEXT         NOT NULL,
  started_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  synced_at         TIMESTAMPTZ,
  status            TEXT         NOT NULL DEFAULT 'RUNNING',  -- RUNNING | COMPLETED | FAILED | SKIPPED
  records_fetched   INTEGER      DEFAULT 0,
  records_inserted  INTEGER      DEFAULT 0,
  records_updated   INTEGER      DEFAULT 0,
  error_message     TEXT,
  duration_ms       INTEGER
);

-- Property records from external providers
CREATE TABLE IF NOT EXISTS external_property_listings (
  listing_id        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID         NOT NULL,
  provider          TEXT         NOT NULL,
  external_id       TEXT         NOT NULL,
  property_type     TEXT         NOT NULL,
  transaction_type  TEXT         NOT NULL,
  price_eur         NUMERIC(15,2),
  price_per_sqm_eur NUMERIC(10,2),
  area_sqm          NUMERIC(10,2),
  bedrooms          INTEGER,
  bathrooms         INTEGER,
  municipality      TEXT,
  district          TEXT,
  country           TEXT         NOT NULL DEFAULT 'PT',
  latitude          NUMERIC(10,7),
  longitude         NUMERIC(10,7),
  listing_url       TEXT,
  days_on_market    INTEGER,
  status            TEXT         NOT NULL DEFAULT 'ACTIVE',
  trust_score       NUMERIC(4,2),
  raw_data          JSONB,
  first_seen        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_seen         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, provider, external_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_provider_sync_logs_provider_synced ON provider_sync_logs(provider, synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_external_listings_tenant_provider ON external_property_listings(tenant_id, provider, last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_external_listings_municipality ON external_property_listings(municipality, country);

-- RLS
ALTER TABLE provider_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_property_listings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'provider_connections' AND policyname = 'service_role_provider_connections') THEN
    CREATE POLICY service_role_provider_connections ON provider_connections FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'provider_sync_logs' AND policyname = 'service_role_provider_sync_logs') THEN
    CREATE POLICY service_role_provider_sync_logs ON provider_sync_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'external_property_listings' AND policyname = 'service_role_external_listings') THEN
    CREATE POLICY service_role_external_listings ON external_property_listings FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Seed known providers
INSERT INTO provider_connections (tenant_id, provider_name, provider_type, env_var_key, trust_score, base_url)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Idealista', 'PROPERTY_LISTING', 'IDEALISTA_API_KEY', 0.85, 'https://api.idealista.com/3.5/'),
  ('00000000-0000-0000-0000-000000000001', 'Casafari', 'PROPERTY_LISTING', 'CASAFARI_API_KEY', 0.82, 'https://api.casafari.com/v1'),
  ('00000000-0000-0000-0000-000000000001', 'Citius', 'JUDICIAL_AUCTION', 'CITIUS_PARTNER_KEY', 0.92, 'https://www.citius.mj.pt'),
  ('00000000-0000-0000-0000-000000000001', 'Novo Banco NPL', 'BANK_NPL', 'NOVOBANCO_NPL_API_KEY', 0.90, null),
  ('00000000-0000-0000-0000-000000000001', 'BCP NPL', 'BANK_NPL', 'BCP_NPL_API_KEY', 0.90, null),
  ('00000000-0000-0000-0000-000000000001', 'CGD NPL', 'BANK_NPL', 'CGD_NPL_API_KEY', 0.90, null),
  ('00000000-0000-0000-0000-000000000001', 'Santander PT NPL', 'BANK_NPL', 'SANTANDER_NPL_API_KEY', 0.90, null)
ON CONFLICT (tenant_id, provider_name) DO NOTHING;
