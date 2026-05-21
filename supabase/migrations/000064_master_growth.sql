-- Agency Group — Wave 40: Master Growth Status + Optimization Actions
-- supabase/migrations/000064_master_growth.sql

CREATE TABLE IF NOT EXISTS master_growth_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  generated_at timestamptz DEFAULT now(),
  growth_engine jsonb DEFAULT '{}',
  expansion_engine jsonb DEFAULT '{}',
  network_effect jsonb DEFAULT '{}',
  attribution jsonb DEFAULT '{}',
  system_status text DEFAULT 'EARLY_STAGE',
  ready_for_institutional boolean DEFAULT false,
  alerts jsonb DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_master_growth_status_tenant ON master_growth_status_history(tenant_id, generated_at DESC);
ALTER TABLE master_growth_status_history ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='master_growth_status_history' AND policyname='tenant_isolation') THEN CREATE POLICY tenant_isolation ON master_growth_status_history USING (tenant_id::text = current_setting('app.tenant_id', true)); END IF; END $$;

CREATE TABLE IF NOT EXISTS optimization_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  decision_id text,
  action_type text NOT NULL,
  status text NOT NULL DEFAULT 'PLANNED',
  requires_human_approval boolean DEFAULT true,
  executed_at timestamptz,
  result jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE optimization_actions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='optimization_actions' AND policyname='tenant_isolation') THEN CREATE POLICY tenant_isolation ON optimization_actions USING (tenant_id::text = current_setting('app.tenant_id', true)); END IF; END $$;
