-- =============================================================================
-- AGENCY GROUP — Property Collections Table Migration
-- 20260407_004_collections.sql
-- AMI: 22506 | Collaborative property shortlists — share-token access
-- =============================================================================

CREATE TABLE IF NOT EXISTS property_collections (
  id TEXT PRIMARY KEY, -- share token (col_<timestamp>_<hex>)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,

  -- Ownership
  agent_id TEXT,

  -- Client info
  client_name TEXT,
  client_email TEXT,

  -- Collection data (stored as JSONB for flexibility — avoids needing join tables)
  name TEXT NOT NULL DEFAULT 'Nova Colecção',
  share_token TEXT NOT NULL, -- separate share token for public URL
  items JSONB DEFAULT '[]'::jsonb,     -- CollectionItem[]
  comments JSONB DEFAULT '[]'::jsonb,  -- Comment[]
  ai_profile TEXT,

  -- Analytics
  views INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_collections_agent ON property_collections(agent_id);
CREATE INDEX IF NOT EXISTS idx_collections_expires ON property_collections(expires_at);
CREATE INDEX IF NOT EXISTS idx_collections_share_token ON property_collections(share_token);
CREATE INDEX IF NOT EXISTS idx_collections_created ON property_collections(created_at DESC);

-- No user-level RLS — access is controlled by share_token (public) or agentId (agent listing)
-- supabaseAdmin (service role) handles all writes; public reads go through share_token validation in API
ALTER TABLE property_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage all collections"
  ON property_collections FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_collections_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_collections_updated_at ON property_collections;
CREATE TRIGGER trg_collections_updated_at
  BEFORE UPDATE ON property_collections
  FOR EACH ROW EXECUTE FUNCTION update_collections_updated_at();

-- Cleanup expired collections
CREATE OR REPLACE FUNCTION cleanup_expired_collections()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM property_collections
  WHERE expires_at IS NOT NULL AND expires_at < NOW();
END;
$$;
