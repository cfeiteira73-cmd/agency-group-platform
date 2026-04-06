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
