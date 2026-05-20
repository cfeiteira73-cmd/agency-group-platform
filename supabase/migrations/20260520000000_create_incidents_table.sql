-- =============================================================================
-- Agency Group — Create incidents table (P0-01)
-- Must run BEFORE 20260520000001 (indexes) and 20260520000002 (ALTER columns)
-- DDL source: lib/incidents/incidentIngestor.ts lines 8-30
-- Safe: all statements use IF NOT EXISTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS incidents (
  incident_id              TEXT PRIMARY KEY,
  tenant_id                TEXT NOT NULL,
  severity                 TEXT NOT NULL,           -- 'P0'|'P1'|'P2'|'P3'
  classification           TEXT,                    -- FailureType (set later by autopsy)
  region                   TEXT,
  subsystem                TEXT,                    -- 'api'|'graph'|'ai'|'queue'|'billing'|'database'|'cache'|'region'
  raw_error                TEXT,
  status                   TEXT NOT NULL DEFAULT 'open', -- 'open'|'investigating'|'resolved'|'autopsy_complete'|'escalated'
  detected_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at              TIMESTAMPTZ,
  metrics_snapshot         JSONB NOT NULL DEFAULT '{}'::jsonb,
  causal_chain             JSONB,
  impact                   JSONB,
  autopsy_report           JSONB,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  healing_attempts         INTEGER NOT NULL DEFAULT 0,
  source_correlation_id    TEXT DEFAULT NULL,

  CONSTRAINT incidents_severity_check
    CHECK (severity IN ('P0', 'P1', 'P2', 'P3')),
  CONSTRAINT incidents_status_check
    CHECK (status IN ('open', 'investigating', 'resolved', 'autopsy_complete', 'escalated'))
);

-- Index: open incidents by tenant + status (most frequent query path)
CREATE INDEX IF NOT EXISTS idx_incidents_tenant_status_base
  ON incidents (tenant_id, status);

-- Index: incidents by tenant + recency (used by listOpenIncidents ORDER BY detected_at DESC)
CREATE INDEX IF NOT EXISTS idx_incidents_tenant_detected_at
  ON incidents (tenant_id, detected_at DESC);

-- Index: severity + status for alert routing
CREATE INDEX IF NOT EXISTS idx_incidents_severity
  ON incidents (severity, status, detected_at DESC);

-- Index: status + recency for global dashboards
CREATE INDEX IF NOT EXISTS idx_incidents_status
  ON incidents (status, detected_at DESC);

-- =============================================================================
-- governance_approvals table (also referenced by 20260520000002, kept here
-- as the canonical CREATE so the ALTER in 20260520000002 always has a target)
-- =============================================================================

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
