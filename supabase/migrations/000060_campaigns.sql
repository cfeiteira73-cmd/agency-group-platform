-- Agency Group — Wave 40: Campaign Orchestration Engine
-- supabase/migrations/000060_campaigns.sql
-- Tables: campaigns, campaign_executions, channel_send_queue, trigger_check_logs, investor_notifications

CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id text NOT NULL UNIQUE,
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT',
  trigger_type text NOT NULL,
  target_segments jsonb DEFAULT '[]',
  channels jsonb DEFAULT '[]',
  message_template_id text,
  trigger_conditions jsonb DEFAULT '{}',
  sequence_steps jsonb DEFAULT '[]',
  start_at timestamptz,
  end_at timestamptz,
  budget_eur_cents bigint,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant ON campaigns(tenant_id, status, created_at DESC);
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='campaigns' AND policyname='tenant_isolation') THEN CREATE POLICY tenant_isolation ON campaigns USING (tenant_id::text = current_setting('app.tenant_id', true)); END IF; END $$;

CREATE TABLE IF NOT EXISTS campaign_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id text NOT NULL UNIQUE,
  campaign_id text NOT NULL,
  tenant_id uuid NOT NULL,
  investor_id text NOT NULL,
  current_step integer DEFAULT 0,
  status text NOT NULL DEFAULT 'ENROLLED',
  enrolled_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  last_send_at timestamptz,
  UNIQUE(campaign_id, investor_id)
);
CREATE INDEX IF NOT EXISTS idx_campaign_executions_campaign ON campaign_executions(tenant_id, campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_campaign_executions_investor ON campaign_executions(tenant_id, investor_id);
ALTER TABLE campaign_executions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='campaign_executions' AND policyname='tenant_isolation') THEN CREATE POLICY tenant_isolation ON campaign_executions USING (tenant_id::text = current_setting('app.tenant_id', true)); END IF; END $$;

CREATE TABLE IF NOT EXISTS channel_send_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id text NOT NULL UNIQUE,
  tenant_id uuid NOT NULL,
  campaign_id text,
  execution_id text,
  investor_id text NOT NULL,
  channel text NOT NULL,
  message_content text,
  send_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'QUEUED',
  provider_response text,
  sent_at timestamptz,
  delivered_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_send_queue_tenant_status ON channel_send_queue(tenant_id, status, send_at ASC);
ALTER TABLE channel_send_queue ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='channel_send_queue' AND policyname='tenant_isolation') THEN CREATE POLICY tenant_isolation ON channel_send_queue USING (tenant_id::text = current_setting('app.tenant_id', true)); END IF; END $$;

CREATE TABLE IF NOT EXISTS trigger_check_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  trigger_type text NOT NULL,
  triggered_at timestamptz DEFAULT now(),
  investors_affected jsonb DEFAULT '[]',
  campaigns_activated integer DEFAULT 0,
  details jsonb DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_trigger_logs_tenant ON trigger_check_logs(tenant_id, triggered_at DESC);
ALTER TABLE trigger_check_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trigger_check_logs' AND policyname='tenant_isolation') THEN CREATE POLICY tenant_isolation ON trigger_check_logs USING (tenant_id::text = current_setting('app.tenant_id', true)); END IF; END $$;

CREATE TABLE IF NOT EXISTS investor_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  investor_id text NOT NULL,
  campaign_id text,
  notification_type text NOT NULL DEFAULT 'in_app',
  title text,
  message text,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_investor_notifications_investor ON investor_notifications(tenant_id, investor_id, created_at DESC);
ALTER TABLE investor_notifications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_notifications' AND policyname='tenant_isolation') THEN CREATE POLICY tenant_isolation ON investor_notifications USING (tenant_id::text = current_setting('app.tenant_id', true)); END IF; END $$;
