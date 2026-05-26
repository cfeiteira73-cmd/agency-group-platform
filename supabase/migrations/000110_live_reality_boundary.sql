-- Agency Group — Live Reality Boundary Store
-- Migration: 000110_live_reality_boundary.sql
-- Wave 48 GAP 1 — Provider heartbeat, trust decay, SLA verification persistence

CREATE TABLE IF NOT EXISTS provider_trust_scores (
  score_id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID         NOT NULL,
  provider_key      TEXT         NOT NULL,
  trust_score       NUMERIC(5,2) NOT NULL DEFAULT 100,
  last_status       TEXT         NOT NULL DEFAULT 'UNCONFIGURED',
  last_checked_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  consecutive_fails INTEGER      NOT NULL DEFAULT 0,
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_trust_tenant_key
  ON provider_trust_scores(tenant_id, provider_key);

CREATE INDEX IF NOT EXISTS idx_provider_trust_tenant
  ON provider_trust_scores(tenant_id, last_checked_at DESC);

ALTER TABLE provider_trust_scores ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'provider_trust_scores'
      AND policyname = 'service_role_full_access'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY service_role_full_access ON provider_trust_scores
        FOR ALL TO service_role USING (true) WITH CHECK (true)
    $pol$;
  END IF;
END $$;

-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS provider_sla_breaches (
  breach_id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL,
  provider_key      TEXT        NOT NULL,
  breach_level      TEXT        NOT NULL DEFAULT 'WARNING',
  stale_minutes     NUMERIC     NOT NULL DEFAULT 0,
  detected_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sla_breaches_tenant
  ON provider_sla_breaches(tenant_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_sla_breaches_unresolved
  ON provider_sla_breaches(tenant_id, provider_key) WHERE resolved_at IS NULL;

ALTER TABLE provider_sla_breaches ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'provider_sla_breaches'
      AND policyname = 'service_role_full_access'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY service_role_full_access ON provider_sla_breaches
        FOR ALL TO service_role USING (true) WITH CHECK (true)
    $pol$;
  END IF;
END $$;

-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS provider_fallback_events (
  event_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL,
  provider_key      TEXT        NOT NULL,
  fallback_reason   TEXT        NOT NULL,
  fallback_target   TEXT,
  occurred_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fallback_events_tenant
  ON provider_fallback_events(tenant_id, occurred_at DESC);

ALTER TABLE provider_fallback_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'provider_fallback_events'
      AND policyname = 'service_role_full_access'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY service_role_full_access ON provider_fallback_events
        FOR ALL TO service_role USING (true) WITH CHECK (true)
    $pol$;
  END IF;
END $$;

-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS live_reality_reports (
  report_id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID         NOT NULL,
  assessed_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  system_reality_index  NUMERIC(5,2) NOT NULL DEFAULT 0,
  reality_label         TEXT         NOT NULL DEFAULT 'ARCHITECTURE_ONLY',
  providers_alive       INTEGER      NOT NULL DEFAULT 0,
  providers_warning     INTEGER      NOT NULL DEFAULT 0,
  providers_critical    INTEGER      NOT NULL DEFAULT 0,
  providers_dead        INTEGER      NOT NULL DEFAULT 0,
  providers_unconfigured INTEGER     NOT NULL DEFAULT 0,
  sla_breaches          INTEGER      NOT NULL DEFAULT 0,
  fallback_events       INTEGER      NOT NULL DEFAULT 0,
  providers             JSONB        NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_live_reality_tenant
  ON live_reality_reports(tenant_id, assessed_at DESC);

ALTER TABLE live_reality_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'live_reality_reports'
      AND policyname = 'service_role_full_access'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY service_role_full_access ON live_reality_reports
        FOR ALL TO service_role USING (true) WITH CHECK (true)
    $pol$;
  END IF;
END $$;
