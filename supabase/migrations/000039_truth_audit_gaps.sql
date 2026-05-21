-- 000039: System Truth Audit and Gap Detection tables

CREATE TABLE IF NOT EXISTS system_truth_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  composite_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  system_truth_status TEXT NOT NULL DEFAULT 'UNKNOWN',
  dimensions JSONB NOT NULL DEFAULT '{}',
  critical_blockers JSONB NOT NULL DEFAULT '[]',
  audit_duration_ms INTEGER NOT NULL DEFAULT 0,
  audited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gap_detection_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  gaps JSONB NOT NULL DEFAULT '[]',
  summary JSONB NOT NULL DEFAULT '{}',
  blocking_issues JSONB NOT NULL DEFAULT '[]',
  production_blocked BOOLEAN NOT NULL DEFAULT false,
  critical_count INTEGER NOT NULL DEFAULT 0,
  high_count INTEGER NOT NULL DEFAULT 0,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS data_integrity_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  integrity_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  orphan_analysis JSONB NOT NULL DEFAULT '{}',
  state_violations JSONB NOT NULL DEFAULT '[]',
  schema_drift JSONB NOT NULL DEFAULT '[]',
  critical_issues JSONB NOT NULL DEFAULT '[]',
  audited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_system_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  event_integrity_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  topic_coverage JSONB NOT NULL DEFAULT '[]',
  idempotency_analysis JSONB NOT NULL DEFAULT '{}',
  replay_determinism JSONB NOT NULL DEFAULT '{}',
  simulations JSONB NOT NULL DEFAULT '[]',
  lost_events_estimate INTEGER NOT NULL DEFAULT 0,
  audited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS financial_consistency_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  financial_integrity_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  ledger_balance JSONB NOT NULL DEFAULT '{}',
  escrow_consistency JSONB NOT NULL DEFAULT '{}',
  settlement_correctness JSONB NOT NULL DEFAULT '{}',
  anomalies JSONB NOT NULL DEFAULT '{}',
  critical_issues JSONB NOT NULL DEFAULT '[]',
  audited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ml_consistency_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  ml_stability_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  feature_store JSONB NOT NULL DEFAULT '{}',
  label_correctness JSONB NOT NULL DEFAULT '{}',
  drift_analysis JSONB NOT NULL DEFAULT '{}',
  retraining_determinism JSONB NOT NULL DEFAULT '{}',
  simulations JSONB NOT NULL DEFAULT '[]',
  audited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_system_truth_audits_tenant ON system_truth_audits(tenant_id, audited_at DESC);
CREATE INDEX IF NOT EXISTS idx_gap_detection_reports_tenant ON gap_detection_reports(tenant_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_gap_detection_blocked ON gap_detection_reports(production_blocked, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_financial_audits_tenant ON financial_consistency_audits(tenant_id, audited_at DESC);

-- RLS
ALTER TABLE system_truth_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE gap_detection_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_consistency_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_consistency_audits ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='system_truth_audits' AND policyname='tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON system_truth_audits USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='gap_detection_reports' AND policyname='tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON gap_detection_reports USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='financial_consistency_audits' AND policyname='tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON financial_consistency_audits USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;
