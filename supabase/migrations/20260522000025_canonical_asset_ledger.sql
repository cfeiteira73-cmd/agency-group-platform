-- canonical_assets: 1 property = 1 financial asset
CREATE TABLE IF NOT EXISTS canonical_assets (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id             uuid NOT NULL,
  canonical_hash        text NOT NULL,    -- SHA-256(external_id+source)
  external_id           text NOT NULL,
  source                text NOT NULL CHECK (source IN ('casafari','idealista','crm','broker','manual')),
  title                 text NOT NULL,
  price_eur             numeric(15,2) NOT NULL CHECK (price_eur >= 0),
  area_sqm              numeric(10,2) NOT NULL CHECK (area_sqm >= 0),
  typology              text NOT NULL,
  zone                  text NOT NULL,
  district              text,
  country               char(2) NOT NULL DEFAULT 'PT',
  latitude              numeric(9,6),
  longitude             numeric(9,6),
  price_per_sqm         numeric(10,2),
  liquidity_score       numeric(5,4),
  risk_score            numeric(5,4),
  capital_exposure_eur  numeric(15,2) NOT NULL DEFAULT 0,
  investor_demand_count integer NOT NULL DEFAULT 0,
  decay_factor          numeric(5,4) NOT NULL DEFAULT 1.0,
  fraud_signals         text[] NOT NULL DEFAULT '{}',
  is_suspicious         boolean NOT NULL DEFAULT false,
  valuation_eur         numeric(15,2),
  listed_at             timestamptz NOT NULL,
  last_ingested_at      timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, canonical_hash)
);

-- asset_price_history: time-series price tracking
CREATE TABLE IF NOT EXISTS asset_price_history (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    uuid NOT NULL,
  asset_id     uuid NOT NULL REFERENCES canonical_assets(id) ON DELETE CASCADE,
  price_eur    numeric(15,2) NOT NULL,
  source       text NOT NULL,
  recorded_at  timestamptz NOT NULL DEFAULT now()
);

-- asset_ingestion_log: audit trail for each ingestion run
CREATE TABLE IF NOT EXISTS asset_ingestion_log (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id         uuid NOT NULL,
  run_at            timestamptz NOT NULL DEFAULT now(),
  source            text NOT NULL,
  fetched_count     integer NOT NULL DEFAULT 0,
  normalized_count  integer NOT NULL DEFAULT 0,
  deduplicated_count integer NOT NULL DEFAULT 0,
  flagged_count     integer NOT NULL DEFAULT 0,
  upserted_count    integer NOT NULL DEFAULT 0,
  duration_ms       integer NOT NULL DEFAULT 0,
  errors            text[] NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_canonical_assets_tenant_zone ON canonical_assets (tenant_id, zone);
CREATE INDEX IF NOT EXISTS idx_canonical_assets_tenant_suspicious ON canonical_assets (tenant_id, is_suspicious);
CREATE INDEX IF NOT EXISTS idx_asset_price_history_asset ON asset_price_history (asset_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_asset_ingestion_log_tenant ON asset_ingestion_log (tenant_id, run_at DESC);

ALTER TABLE canonical_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_ingestion_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'canonical_assets' AND policyname = 'service_role_all') THEN
    CREATE POLICY service_role_all ON canonical_assets TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'asset_price_history' AND policyname = 'service_role_all') THEN
    CREATE POLICY service_role_all ON asset_price_history TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'asset_ingestion_log' AND policyname = 'service_role_all') THEN
    CREATE POLICY service_role_all ON asset_ingestion_log TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
