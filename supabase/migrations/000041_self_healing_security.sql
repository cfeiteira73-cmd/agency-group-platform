-- 000041: Self-Healing and Security Hardening tables

CREATE TABLE IF NOT EXISTS self_healing_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  anomalies_detected JSONB NOT NULL DEFAULT '[]',
  healing_actions JSONB NOT NULL DEFAULT '[]',
  financial_alerts JSONB NOT NULL DEFAULT '[]',
  system_health_before NUMERIC(5,2) NOT NULL DEFAULT 0,
  system_health_after NUMERIC(5,2) NOT NULL DEFAULT 0,
  improvement NUMERIC(5,2) NOT NULL DEFAULT 0,
  human_review_required BOOLEAN NOT NULL DEFAULT false,
  human_review_items JSONB NOT NULL DEFAULT '[]',
  dry_run BOOLEAN NOT NULL DEFAULT true,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_healing_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  diagnosis JSONB NOT NULL DEFAULT '{}',
  actions_taken JSONB NOT NULL DEFAULT '[]',
  healing_status TEXT NOT NULL DEFAULT 'manual_required',
  requires_human_review JSONB NOT NULL DEFAULT '[]',
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS liquidity_rebuild_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  source_data JSONB NOT NULL DEFAULT '{}',
  rebuilt_metrics JSONB NOT NULL DEFAULT '{}',
  rebuild_status TEXT NOT NULL DEFAULT 'failed',
  errors JSONB NOT NULL DEFAULT '[]',
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ml_restore_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  model_health_check JSONB NOT NULL DEFAULT '{}',
  restore_action JSONB NOT NULL DEFAULT '{}',
  post_restore_health JSONB NOT NULL DEFAULT '{}',
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ml_retrain_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  trigger_reason TEXT NOT NULL,
  triggered_by TEXT NOT NULL DEFAULT 'self_healing_orchestrator',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS penetration_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  attack_vectors JSONB NOT NULL DEFAULT '[]',
  overall_security_posture TEXT NOT NULL DEFAULT 'weak',
  critical_vulnerabilities JSONB NOT NULL DEFAULT '[]',
  security_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS security_hardening_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  secrets_check JSONB NOT NULL DEFAULT '{}',
  tenant_isolation_check JSONB NOT NULL DEFAULT '{}',
  api_exposure_check JSONB NOT NULL DEFAULT '{}',
  audit_trail_integrity JSONB NOT NULL DEFAULT '{}',
  hardening_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  critical_findings JSONB NOT NULL DEFAULT '[]',
  passed BOOLEAN NOT NULL DEFAULT false,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_self_healing_runs_tenant ON self_healing_runs(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_self_healing_review ON self_healing_runs(human_review_required, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ml_retrain_triggers_tenant ON ml_retrain_triggers(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_pentest_results_tenant ON penetration_test_results(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_hardening_tenant ON security_hardening_reports(tenant_id, generated_at DESC);

-- RLS
ALTER TABLE self_healing_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE penetration_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_hardening_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='self_healing_runs' AND policyname='tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON self_healing_runs USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='penetration_test_results' AND policyname='tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON penetration_test_results USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;
