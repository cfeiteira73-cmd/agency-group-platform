-- =============================================================================
-- AGENCY GROUP — Magic Link One-Time-Use Blocklist
-- 20260408_001_magic_link_used_flag.sql
-- AMI: 22506 | Security: prevents magic link token reuse (replay attack)
-- =============================================================================

-- Stores SHA-256 hashes of magic tokens that have already been consumed.
-- We hash the token before storage so the raw token is never persisted.
-- Rows expire naturally after 24h (longest magic link TTL) — cleaned daily.

CREATE TABLE IF NOT EXISTS used_magic_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash   TEXT NOT NULL UNIQUE,       -- SHA-256 hex of the full token
  email        TEXT NOT NULL,
  used_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL        -- mirrors the token's own expiry
);

-- Fast lookup by hash on every verify request
CREATE INDEX IF NOT EXISTS idx_used_magic_tokens_hash ON used_magic_tokens(token_hash);

-- Cleanup index — rows older than 24h can be purged safely
CREATE INDEX IF NOT EXISTS idx_used_magic_tokens_expires ON used_magic_tokens(expires_at);

-- RLS: service role only (all access from API routes via supabaseAdmin)
ALTER TABLE used_magic_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only"
  ON used_magic_tokens FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Cleanup function: remove expired token hashes (safe to run daily)
CREATE OR REPLACE FUNCTION cleanup_expired_magic_tokens()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM used_magic_tokens WHERE expires_at < NOW();
END;
$$;

-- Optional pg_cron schedule (run after setup):
-- SELECT cron.schedule('cleanup-magic-tokens', '0 4 * * *', 'SELECT cleanup_expired_magic_tokens()');
