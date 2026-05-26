-- 000085_master_system.sql
-- Master System Status: apex aggregator snapshots
-- Wave 43 Agent 7 — Agency Group SH-ROS

CREATE TABLE IF NOT EXISTS master_system_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id TEXT NOT NULL UNIQUE,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  system_grade TEXT NOT NULL,
  system_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  go_live_criteria JSONB NOT NULL DEFAULT '[]',
  go_live_pass_count INTEGER NOT NULL DEFAULT 0,
  go_live_fail_count INTEGER NOT NULL DEFAULT 0,
  layers JSONB NOT NULL DEFAULT '[]',
  healthy_layer_count INTEGER NOT NULL DEFAULT 0,
  degraded_layer_count INTEGER NOT NULL DEFAULT 0,
  down_layer_count INTEGER NOT NULL DEFAULT 0,
  market_authority_active BOOLEAN NOT NULL DEFAULT false,
  proprietary_data_active BOOLEAN NOT NULL DEFAULT false,
  capital_lock_in_active BOOLEAN NOT NULL DEFAULT false,
  supply_dominance_active BOOLEAN NOT NULL DEFAULT false,
  flywheel_active BOOLEAN NOT NULL DEFAULT false,
  institutional_api_active BOOLEAN NOT NULL DEFAULT false,
  total_opportunities_tracked BIGINT,
  total_investors_tracked BIGINT,
  total_transactions_processed BIGINT,
  system_moat_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  revenue_readiness_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  scalability_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  integrity_hash TEXT NOT NULL,
  previous_snapshot_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_master_snapshots_tenant_time
  ON master_system_snapshots(tenant_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_master_snapshots_grade
  ON master_system_snapshots(system_grade, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_master_snapshots_score
  ON master_system_snapshots(system_score DESC);

ALTER TABLE master_system_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_master_snapshots"
  ON master_system_snapshots
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
