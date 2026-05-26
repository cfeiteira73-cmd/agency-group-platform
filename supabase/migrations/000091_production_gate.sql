-- =============================================================================
-- Agency Group — SH-ROS | AMI: 22506
-- Migration 000091: Production Gate + Source Validation + OS Snapshots
-- Wave 44 Agent 6 — Production Lock
-- =============================================================================

CREATE TABLE IF NOT EXISTS validated_data_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_id TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  trust_score NUMERIC(4,3) NOT NULL DEFAULT 0,
  legal_origin_flag BOOLEAN NOT NULL DEFAULT false,
  timestamp TIMESTAMPTZ NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload_hash TEXT NOT NULL DEFAULT '',
  validation_status TEXT NOT NULL CHECK (validation_status IN ('VALID','REJECTED','PENDING_VERIFICATION')) DEFAULT 'VALID',
  rejection_reason TEXT,
  UNIQUE (tenant_id, source, source_id)
);

CREATE TABLE IF NOT EXISTS production_readiness_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  overall_status TEXT NOT NULL CHECK (overall_status IN ('PRODUCTION_READY','NOT_READY','PARTIALLY_READY')) DEFAULT 'NOT_READY',
  pass_count INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  pending_count INTEGER NOT NULL DEFAULT 0,
  blocking_fails INTEGER NOT NULL DEFAULT 0,
  gate_checks JSONB NOT NULL DEFAULT '[]',
  estimated_days_to_ready INTEGER,
  certification_hash TEXT
);

CREATE TABLE IF NOT EXISTS production_os_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  grade TEXT NOT NULL DEFAULT 'INITIALIZING',
  composite_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  security_operational BOOLEAN NOT NULL DEFAULT false,
  dr_operational BOOLEAN NOT NULL DEFAULT false,
  ledger_operational BOOLEAN NOT NULL DEFAULT false,
  observability_operational BOOLEAN NOT NULL DEFAULT false,
  compliance_operational BOOLEAN NOT NULL DEFAULT false,
  source_validation_operational BOOLEAN NOT NULL DEFAULT false,
  production_gate_status TEXT NOT NULL DEFAULT 'NOT_ASSESSED',
  production_gate_pass_count INTEGER NOT NULL DEFAULT 0,
  market_authority_active BOOLEAN NOT NULL DEFAULT false,
  supply_dominance_active BOOLEAN NOT NULL DEFAULT false,
  capital_execution_active BOOLEAN NOT NULL DEFAULT false,
  flywheel_active BOOLEAN NOT NULL DEFAULT false,
  total_kyc_approved INTEGER NOT NULL DEFAULT 0,
  total_escrow_positions INTEGER NOT NULL DEFAULT 0,
  active_threat_events INTEGER NOT NULL DEFAULT 0,
  ledger_balanced BOOLEAN NOT NULL DEFAULT false,
  dr_last_test_days_ago INTEGER,
  security_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  compliance_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  capital_execution_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  data_quality_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  payload JSONB NOT NULL DEFAULT '{}',
  integrity_hash TEXT NOT NULL DEFAULT ''
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_validated_data_source ON validated_data_points(tenant_id, source, ingested_at DESC);
CREATE INDEX IF NOT EXISTS idx_validated_data_status ON validated_data_points(tenant_id, validation_status, ingested_at DESC);
CREATE INDEX IF NOT EXISTS idx_prod_readiness_tenant ON production_readiness_assessments(tenant_id, assessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_prod_os_snapshots_tenant ON production_os_snapshots(tenant_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_prod_os_snapshots_grade ON production_os_snapshots(grade, captured_at DESC);

-- RLS
ALTER TABLE validated_data_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_readiness_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_os_snapshots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='validated_data_points' AND policyname='service_role_validated_data') THEN
    CREATE POLICY "service_role_validated_data" ON validated_data_points FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='production_readiness_assessments' AND policyname='service_role_prod_readiness') THEN
    CREATE POLICY "service_role_prod_readiness" ON production_readiness_assessments FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='production_os_snapshots' AND policyname='service_role_prod_os') THEN
    CREATE POLICY "service_role_prod_os" ON production_os_snapshots FOR ALL USING (true);
  END IF;
END $$;
