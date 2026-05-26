-- =============================================================================
-- Agency Group — SH-ROS | AMI: 22506
-- Migration 000092: Security Hardening Tables
-- Wave 45 Agent 2 — Maximum Security Hardening
-- =============================================================================

-- ── Rate limit counters ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rate_limit_counters (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash     TEXT        NOT NULL UNIQUE,
  count        INTEGER     NOT NULL DEFAULT 1,
  sensitivity  TEXT        NOT NULL DEFAULT 'MEDIUM',
  tenant_id    UUID        NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Active rate limit blocks ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rate_limit_blocks (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash      TEXT        NOT NULL UNIQUE,
  ip_hash       TEXT        NOT NULL DEFAULT '',
  sensitivity   TEXT        NOT NULL DEFAULT 'MEDIUM',
  blocked_until TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── CSP violation reports ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS csp_violation_reports (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_uri        TEXT        NOT NULL DEFAULT '',
  violated_directive  TEXT        NOT NULL DEFAULT '',
  blocked_uri         TEXT        NOT NULL DEFAULT '',
  original_policy     TEXT,
  source_file         TEXT,
  status_code         INTEGER     NOT NULL DEFAULT 0,
  ip_hash             TEXT        NOT NULL DEFAULT '',
  reported_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Request fingerprints for anomaly detection ────────────────────────────────
CREATE TABLE IF NOT EXISTS request_fingerprints (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint_id  TEXT        NOT NULL,
  ip_hash         TEXT        NOT NULL DEFAULT '',
  composite_hash  TEXT        NOT NULL,
  risk_score      INTEGER     NOT NULL DEFAULT 0,
  risk_indicators TEXT[]      NOT NULL DEFAULT '{}',
  tenant_id       UUID        NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  seen_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (composite_hash, tenant_id)
);

-- ── Indexes ────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_rate_limit_counters_key
  ON rate_limit_counters(key_hash);

CREATE INDEX IF NOT EXISTS idx_rate_limit_blocks_key
  ON rate_limit_blocks(key_hash, blocked_until DESC);

CREATE INDEX IF NOT EXISTS idx_rate_limit_blocks_active
  ON rate_limit_blocks(blocked_until)
  WHERE blocked_until > now();

CREATE INDEX IF NOT EXISTS idx_csp_reports_time
  ON csp_violation_reports(reported_at DESC);

CREATE INDEX IF NOT EXISTS idx_request_fingerprints_composite
  ON request_fingerprints(composite_hash, seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_request_fingerprints_risk
  ON request_fingerprints(risk_score DESC, seen_at DESC);

-- ── Row Level Security ─────────────────────────────────────────────────────────
ALTER TABLE rate_limit_counters   ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_blocks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE csp_violation_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_fingerprints  ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'rate_limit_counters' AND policyname = 'service_role_rate_limit'
  ) THEN
    CREATE POLICY "service_role_rate_limit" ON rate_limit_counters FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'rate_limit_blocks' AND policyname = 'service_role_blocks'
  ) THEN
    CREATE POLICY "service_role_blocks" ON rate_limit_blocks FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'csp_violation_reports' AND policyname = 'service_role_csp'
  ) THEN
    CREATE POLICY "service_role_csp" ON csp_violation_reports FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'request_fingerprints' AND policyname = 'service_role_fingerprints'
  ) THEN
    CREATE POLICY "service_role_fingerprints" ON request_fingerprints FOR ALL USING (true);
  END IF;
END $$;
