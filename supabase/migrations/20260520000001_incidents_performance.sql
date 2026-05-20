-- =============================================================================
-- Agency Group — SH-ROS Performance Indexes
-- Incidents table query optimization for self-healing engine
-- Safe to run CONCURRENTLY on live database
-- =============================================================================

-- Primary lookup: open incidents by tenant + severity (most frequent query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_tenant_status
  ON incidents (tenant_id, status)
  WHERE status IN ('open', 'investigating', 'escalated');

-- Prediction engine: history by recency + severity
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_occurred_severity
  ON incidents (occurred_at DESC, severity);

-- Forensics: correlation lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_source_correlation
  ON incidents (source_correlation_id)
  WHERE source_correlation_id IS NOT NULL;

-- Healing stats: tenant + resolved_at for time-window analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_tenant_resolved
  ON incidents (tenant_id, resolved_at DESC)
  WHERE resolved_at IS NOT NULL;

-- Partial index: open incidents per tenant (fast count for CT badge)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_open_per_tenant
  ON incidents (tenant_id, created_at DESC)
  WHERE status IN ('open', 'investigating');

-- Audit log: correlation lookup (for forensics)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_correlation
  ON audit_log (correlation_id)
  WHERE correlation_id IS NOT NULL;

-- Learning events: tenant + event type for pattern analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_events_tenant_type
  ON learning_events (tenant_id, event_type, created_at DESC);
