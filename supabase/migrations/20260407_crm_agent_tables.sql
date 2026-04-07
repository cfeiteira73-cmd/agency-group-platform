-- =============================================================================
-- AGENCY GROUP — CRM Agent Tables Migration
-- Sprint 9 Agent 3: Agentic AI CRM (Sofia autonomous loop)
-- =============================================================================

-- CRM Tasks table
CREATE TABLE IF NOT EXISTS crm_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
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
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
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
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
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
