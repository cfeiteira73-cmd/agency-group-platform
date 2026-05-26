-- 000084_institutional_api.sql
-- Institutional API Layer: API keys, rate limits, usage tracking,
-- market data packages, feed subscriptions
-- Wave 43 Agent 6

-- ─── Institutional API clients ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS institutional_api_keys (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  institution_name    TEXT NOT NULL,
  tier                TEXT NOT NULL CHECK (tier IN (
                        'BANK','FAMILY_OFFICE','HEDGE_FUND','SOVEREIGN_WEALTH',
                        'PENSION_FUND','INSURANCE','DEVELOPER'
                      )),
  api_key_hash        TEXT NOT NULL UNIQUE, -- SHA-256 of the actual key
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 60,
  allowed_endpoints   TEXT[] NOT NULL DEFAULT '{}',
  data_access_level   TEXT NOT NULL CHECK (data_access_level IN (
                        'BASIC','STANDARD','PREMIUM','PLATINUM'
                      )) DEFAULT 'STANDARD',
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at        TIMESTAMPTZ,
  usage_count         BIGINT NOT NULL DEFAULT 0,
  aum_eur_cents       BIGINT -- Assets under management in EUR cents
);

COMMENT ON TABLE institutional_api_keys IS
  'API keys for institutional clients accessing the market data platform. Keys are stored as SHA-256 hashes only.';

COMMENT ON COLUMN institutional_api_keys.api_key_hash IS
  'SHA-256 hex digest of the plaintext API key. Never store the plaintext key.';

COMMENT ON COLUMN institutional_api_keys.aum_eur_cents IS
  'Assets under management in EUR cents (bigint). NULL if not disclosed.';

-- ─── Rate limiting (sliding window per minute) ───────────────────────────────

CREATE TABLE IF NOT EXISTS institutional_rate_limits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID NOT NULL REFERENCES institutional_api_keys(id) ON DELETE CASCADE,
  minute_bucket TIMESTAMPTZ NOT NULL, -- truncated to the minute
  call_count    INTEGER NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, minute_bucket)
);

COMMENT ON TABLE institutional_rate_limits IS
  'Sliding window rate limit tracking. One row per (client, minute) bucket.';

-- ─── API usage audit log ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS institutional_api_usage (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES institutional_api_keys(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL,
  response_ms INTEGER,
  status_code INTEGER,
  called_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE institutional_api_usage IS
  'Immutable audit log of all institutional API calls for compliance and analytics.';

-- ─── Published market data packages (tamper-evident) ─────────────────────────

CREATE TABLE IF NOT EXISTS published_market_data_packages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  package_id    TEXT NOT NULL UNIQUE,
  market        TEXT NOT NULL,
  published_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until   TIMESTAMPTZ NOT NULL,
  data_version  TEXT NOT NULL,
  package_hash  TEXT NOT NULL, -- SHA-256 of core fields (tamper-evident)
  payload       JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE published_market_data_packages IS
  'Officially published market data packages. Each package is tamper-evident via SHA-256 hash.';

COMMENT ON COLUMN published_market_data_packages.package_hash IS
  'SHA-256 of JSON.stringify({oli, benchmark, ics, market, published_at}). Verifies data integrity.';

-- ─── Feed subscriptions ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS institutional_feed_subscriptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID NOT NULL REFERENCES institutional_api_keys(id) ON DELETE CASCADE,
  feed_type         TEXT NOT NULL CHECK (feed_type IN (
                      'MARKET_AUTHORITY','SUPPLY_INTELLIGENCE','CAPITAL_FLOWS','FULL_INTELLIGENCE'
                    )),
  frequency         TEXT NOT NULL CHECK (frequency IN (
                      'REALTIME','HOURLY','DAILY','WEEKLY'
                    )),
  format            TEXT NOT NULL CHECK (format IN (
                      'JSON','CSV','PARQUET_SCHEMA'
                    )) DEFAULT 'JSON',
  markets           TEXT[] NOT NULL DEFAULT '{}',
  webhook_url       TEXT,
  last_delivered_at TIMESTAMPTZ,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE institutional_feed_subscriptions IS
  'Data feed subscriptions for institutional clients. Supports webhook delivery.';

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_institutional_api_keys_hash
  ON institutional_api_keys(api_key_hash);

CREATE INDEX IF NOT EXISTS idx_institutional_api_keys_tier
  ON institutional_api_keys(tier, is_active);

CREATE INDEX IF NOT EXISTS idx_institutional_api_keys_tenant
  ON institutional_api_keys(tenant_id, is_active);

CREATE INDEX IF NOT EXISTS idx_institutional_rate_limits_client_minute
  ON institutional_rate_limits(client_id, minute_bucket DESC);

CREATE INDEX IF NOT EXISTS idx_institutional_api_usage_client
  ON institutional_api_usage(client_id, called_at DESC);

CREATE INDEX IF NOT EXISTS idx_institutional_api_usage_endpoint
  ON institutional_api_usage(endpoint, called_at DESC);

CREATE INDEX IF NOT EXISTS idx_institutional_api_usage_status
  ON institutional_api_usage(status_code, called_at DESC);

CREATE INDEX IF NOT EXISTS idx_published_market_data_market
  ON published_market_data_packages(market, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_published_market_data_valid
  ON published_market_data_packages(market, valid_until DESC);

CREATE INDEX IF NOT EXISTS idx_feed_subscriptions_client
  ON institutional_feed_subscriptions(client_id, is_active);

CREATE INDEX IF NOT EXISTS idx_feed_subscriptions_frequency
  ON institutional_feed_subscriptions(frequency, is_active);

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE institutional_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE institutional_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE institutional_api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE published_market_data_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE institutional_feed_subscriptions ENABLE ROW LEVEL SECURITY;

-- Tenant isolation for api keys and published packages
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'institutional_api_keys'
      AND policyname = 'tenant_isolation_institutional_api_keys'
  ) THEN
    CREATE POLICY "tenant_isolation_institutional_api_keys"
      ON institutional_api_keys
      FOR ALL
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'institutional_rate_limits'
      AND policyname = 'service_role_institutional_rate_limits'
  ) THEN
    CREATE POLICY "service_role_institutional_rate_limits"
      ON institutional_rate_limits
      FOR ALL
      USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'institutional_api_usage'
      AND policyname = 'service_role_institutional_api_usage'
  ) THEN
    CREATE POLICY "service_role_institutional_api_usage"
      ON institutional_api_usage
      FOR ALL
      USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'published_market_data_packages'
      AND policyname = 'tenant_isolation_published_packages'
  ) THEN
    CREATE POLICY "tenant_isolation_published_packages"
      ON published_market_data_packages
      FOR ALL
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'institutional_feed_subscriptions'
      AND policyname = 'service_role_feed_subscriptions'
  ) THEN
    CREATE POLICY "service_role_feed_subscriptions"
      ON institutional_feed_subscriptions
      FOR ALL
      USING (true);
  END IF;
END $$;
