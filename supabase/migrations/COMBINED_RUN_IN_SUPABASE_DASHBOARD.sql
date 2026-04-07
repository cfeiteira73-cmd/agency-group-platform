-- =================================================================
-- COMBINED MIGRATIONS - 2026-04-07
-- Run this in Supabase Dashboard > SQL Editor
-- URL: https://supabase.com/dashboard/project/isbfiofwpxqqpgxoftph/sql
-- =================================================================

-- =================================================================
-- MIGRATION: 20260407_sofia_memory.sql
-- =================================================================

-- Sofia AI conversation memory for persistent user preferences
CREATE TABLE IF NOT EXISTS sofia_memory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  preferences JSONB DEFAULT '{}',
  viewed_properties TEXT[] DEFAULT '{}',
  search_history JSONB[] DEFAULT '{}',
  budget_min INTEGER,
  budget_max INTEGER,
  preferred_zones TEXT[] DEFAULT '{}',
  preferred_types TEXT[] DEFAULT '{}',
  conversation_count INTEGER DEFAULT 0,
  last_active_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_id)
);

CREATE INDEX IF NOT EXISTS idx_sofia_memory_session ON sofia_memory(session_id);
CREATE INDEX IF NOT EXISTS idx_sofia_memory_user ON sofia_memory(user_id);

-- Allow anonymous sessions (no user_id required)
ALTER TABLE sofia_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own memory" ON sofia_memory
  FOR ALL USING (
    user_id IS NULL OR auth.uid() = user_id
  );


-- =================================================================
-- MIGRATION: 20260407_property_embeddings.sql
-- =================================================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to properties table
ALTER TABLE properties ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create IVFFlat index for fast ANN search
CREATE INDEX IF NOT EXISTS properties_embedding_idx
  ON properties USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Function: semantic search — returns top-k most similar properties
CREATE OR REPLACE FUNCTION search_properties_semantic(
  query_embedding vector(1536),
  similarity_threshold float DEFAULT 0.7,
  match_count int DEFAULT 15,
  filter_zona text DEFAULT NULL,
  filter_preco_min int DEFAULT NULL,
  filter_preco_max int DEFAULT NULL,
  filter_quartos int DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  nome text,
  zona text,
  preco int,
  quartos int,
  area int,
  tipo text,
  descricao text,
  fotos text[],
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id, p.nome, p.zona, p.preco, p.quartos, p.area, p.tipo, p.descricao, p.fotos,
    1 - (p.embedding <=> query_embedding) AS similarity
  FROM properties p
  WHERE
    p.status = 'active'
    AND p.embedding IS NOT NULL
    AND 1 - (p.embedding <=> query_embedding) > similarity_threshold
    AND (filter_zona IS NULL OR p.zona ILIKE '%' || filter_zona || '%')
    AND (filter_preco_min IS NULL OR p.preco >= filter_preco_min)
    AND (filter_preco_max IS NULL OR p.preco <= filter_preco_max)
    AND (filter_quartos IS NULL OR p.quartos >= filter_quartos)
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function: generate and store property embedding (called after upsert)
CREATE OR REPLACE FUNCTION properties_needs_embedding()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Mark that embedding needs refresh by nulling it on description change
  IF (TG_OP = 'UPDATE' AND OLD.descricao IS DISTINCT FROM NEW.descricao) THEN
    NEW.embedding := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER properties_embedding_trigger
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION properties_needs_embedding();


-- =================================================================
-- MIGRATION: 20260407_crm_agent_tables.sql
-- =================================================================

-- =============================================================================
-- AGENCY GROUP — CRM Agent Tables Migration
-- Sprint 9 Agent 3: Agentic AI CRM (Sofia autonomous loop)
-- =============================================================================

-- CRM Tasks table (deals.id is BIGINT, not UUID)
CREATE TABLE IF NOT EXISTS crm_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id BIGINT REFERENCES deals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ NOT NULL,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
  type TEXT CHECK (type IN ('call', 'email', 'visit', 'document', 'offer')) DEFAULT 'call',
  status TEXT CHECK (status IN ('pending', 'in_progress', 'done', 'cancelled')) DEFAULT 'pending',
  created_by TEXT DEFAULT 'human',
  assigned_to UUID REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- CRM Followups table (AI-generated messages)
CREATE TABLE IF NOT EXISTS crm_followups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id BIGINT REFERENCES deals(id) ON DELETE CASCADE,
  channel TEXT CHECK (channel IN ('email', 'whatsapp', 'sms')) NOT NULL,
  message TEXT NOT NULL,
  language TEXT DEFAULT 'pt',
  context TEXT,
  generated_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ,
  status TEXT CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')) DEFAULT 'pending'
);

-- Deal stage history table (audit trail for AI stage changes)
CREATE TABLE IF NOT EXISTS deal_stage_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id BIGINT REFERENCES deals(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  reason TEXT,
  changed_at TIMESTAMPTZ DEFAULT now(),
  changed_by TEXT DEFAULT 'human'
);

-- Add lead_score and scored_at to deals if not exists
ALTER TABLE deals ADD COLUMN IF NOT EXISTS lead_score INTEGER CHECK (lead_score >= 0 AND lead_score <= 100);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS scored_at TIMESTAMPTZ;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT now();

-- RLS Policies
ALTER TABLE crm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users manage tasks"
  ON crm_tasks FOR ALL TO authenticated USING (true);

CREATE POLICY "Auth users manage followups"
  ON crm_followups FOR ALL TO authenticated USING (true);

CREATE POLICY "Auth users view stage history"
  ON deal_stage_history FOR ALL TO authenticated USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS crm_tasks_deal_id_idx ON crm_tasks(deal_id);
CREATE INDEX IF NOT EXISTS crm_tasks_status_idx ON crm_tasks(status, due_date);
CREATE INDEX IF NOT EXISTS crm_tasks_assigned_idx ON crm_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS crm_followups_deal_id_idx ON crm_followups(deal_id);
CREATE INDEX IF NOT EXISTS crm_followups_status_idx ON crm_followups(status);
CREATE INDEX IF NOT EXISTS deal_stage_history_deal_id_idx ON deal_stage_history(deal_id);
CREATE INDEX IF NOT EXISTS deals_last_activity_idx ON deals(last_activity_at);
CREATE INDEX IF NOT EXISTS deals_lead_score_idx ON deals(lead_score DESC NULLS LAST);


