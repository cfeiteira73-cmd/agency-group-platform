-- =============================================================================
-- Agency Group — SH-ROS Incidents Schema Completeness
-- Adds missing columns used by the self-healing engine
-- Safe: all statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
-- =============================================================================

-- Add healing_attempts counter (used by orchestrator retry-cap logic)
ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS healing_attempts INTEGER NOT NULL DEFAULT 0;

-- Add source_correlation_id (runtime event ID that triggered incident detection)
-- Used by causalReconstructor to find correlated audit_log entries
ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS source_correlation_id TEXT DEFAULT NULL;

-- Add index for governance approvals table (create if not exists)
CREATE TABLE IF NOT EXISTS governance_approvals (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          TEXT NOT NULL,
  incident_id        TEXT NOT NULL,
  action_type        TEXT NOT NULL,
  execution_mode     TEXT NOT NULL DEFAULT 'MANUAL_APPROVAL',
  requested_by       TEXT NOT NULL DEFAULT 'system',
  approved_by        TEXT DEFAULT NULL,
  status             TEXT NOT NULL DEFAULT 'pending',
  context            JSONB DEFAULT '{}'::jsonb,
  causal_confidence  DOUBLE PRECISION DEFAULT NULL,
  confidence         DOUBLE PRECISION DEFAULT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_governance_approvals_tenant_status
  ON governance_approvals (tenant_id, status)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_governance_approvals_incident
  ON governance_approvals (incident_id);
