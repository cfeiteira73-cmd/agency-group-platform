-- =============================================================================
-- AGENCY GROUP — Sofia Conversations Table Migration
-- 20260407_003_sofia_conversations.sql
-- AMI: 22506 | Sofia AI Chat History — persistent, 90-day auto-cleanup
-- =============================================================================

CREATE TABLE IF NOT EXISTS sofia_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Message content (truncated at insert: user 2000 chars, assistant 4000 chars)
  user_message TEXT NOT NULL,
  assistant_message TEXT NOT NULL,

  -- Context
  context JSONB,
  mode TEXT DEFAULT 'buyer',

  -- Request metadata
  user_ip TEXT,
  property_ref TEXT,

  CONSTRAINT chk_session_id CHECK (session_id IS NOT NULL AND session_id <> '')
);

-- Indexes — session lookup and time-based queries
CREATE INDEX IF NOT EXISTS idx_sofia_conversations_session ON sofia_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_sofia_conversations_created ON sofia_conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sofia_conversations_mode ON sofia_conversations(mode);

-- No RLS needed — server-side only (supabaseAdmin), not exposed to browser clients
-- Service role key bypasses RLS anyway; table is write-only from API routes
ALTER TABLE sofia_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only"
  ON sofia_conversations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Auto-cleanup conversations older than 90 days (GDPR / privacy compliance)
CREATE OR REPLACE FUNCTION cleanup_old_conversations()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM sofia_conversations
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$;

-- Comment: Schedule this function via pg_cron or Supabase scheduled functions:
-- SELECT cron.schedule('cleanup-sofia-conversations', '0 3 * * *', 'SELECT cleanup_old_conversations()');
