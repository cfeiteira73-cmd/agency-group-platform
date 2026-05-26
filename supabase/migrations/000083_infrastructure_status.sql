-- =============================================================================
-- Agency Group — Wave 43: Infrastructure Status Tables
-- supabase/migrations/000083_infrastructure_status.sql
--
-- Creates:
--   go_live_assessments               — 6-criteria go-live readiness assessments
--   market_infrastructure_status_logs — 10-layer infrastructure status snapshots
--
-- All tables: IF NOT EXISTS, RLS enabled, tenant isolation policy, indexes.
-- EUR amounts in bigint (cents) — never float for money.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- go_live_assessments
-- Records each go-live readiness assessment with all 6 criteria results.
-- Valid for 24 hours — banks and investors can cache this for due diligence.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS go_live_assessments (
  id                        uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id             text          UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  tenant_id                 text          NOT NULL,

  -- Overall grade
  system_grade              text          NOT NULL,
  go_live_ready             boolean       NOT NULL DEFAULT false,

  -- Criteria details (array of GoLiveCriterion objects)
  criteria                  jsonb         NOT NULL DEFAULT '[]',

  -- Aggregated counts
  pass_count                int           NOT NULL DEFAULT 0,
  fail_count                int           NOT NULL DEFAULT 0,
  partial_count             int           NOT NULL DEFAULT 0,
  readiness_pct             numeric(5,2)  NOT NULL DEFAULT 0,

  -- Roadmap
  estimated_days_to_ready   int,

  -- Timestamps
  assessed_at               timestamptz   NOT NULL DEFAULT now(),
  valid_until               timestamptz   NOT NULL
);

ALTER TABLE go_live_assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_go_live_assessments ON go_live_assessments;
CREATE POLICY tenant_isolation_go_live_assessments
  ON go_live_assessments
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_go_live_assessments_tenant_assessed_at
  ON go_live_assessments (tenant_id, assessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_go_live_assessments_assessment_id
  ON go_live_assessments (assessment_id);

CREATE INDEX IF NOT EXISTS idx_go_live_assessments_go_live_ready
  ON go_live_assessments (go_live_ready, assessed_at DESC);

-- ---------------------------------------------------------------------------
-- market_infrastructure_status_logs
-- Snapshots of the full 10-layer infrastructure status.
-- Used for trend analysis, investor reporting, and SLA tracking.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS market_infrastructure_status_logs (
  id                          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  status_id                   text          UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  tenant_id                   text          NOT NULL,

  -- Overall status
  overall_status              text          NOT NULL,
  overall_health_score        numeric(5,2)  NOT NULL DEFAULT 0,
  system_grade                text          NOT NULL DEFAULT 'EARLY_STAGE',

  -- Layer breakdown (array of LayerStatus objects)
  layers                      jsonb         NOT NULL DEFAULT '[]',
  operational_layers          int           NOT NULL DEFAULT 0,
  degraded_layers             int           NOT NULL DEFAULT 0,
  offline_layers              int           NOT NULL DEFAULT 0,

  -- Go-live linkage
  go_live_ready               boolean       NOT NULL DEFAULT false,
  go_live_criteria_passed     int           NOT NULL DEFAULT 0,

  -- Key metrics
  total_supply_records        int           NOT NULL DEFAULT 0,
  total_canonical_assets      int           NOT NULL DEFAULT 0,
  total_active_opportunities  int           NOT NULL DEFAULT 0,
  total_investors             int           NOT NULL DEFAULT 0,
  total_capital_eur_cents     bigint        NOT NULL DEFAULT 0,

  -- Timestamp
  generated_at                timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE market_infrastructure_status_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_market_infrastructure_status_logs ON market_infrastructure_status_logs;
CREATE POLICY tenant_isolation_market_infrastructure_status_logs
  ON market_infrastructure_status_logs
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_market_infra_status_logs_tenant_generated_at
  ON market_infrastructure_status_logs (tenant_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_infra_status_logs_overall_status_generated_at
  ON market_infrastructure_status_logs (overall_status, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_infra_status_logs_status_id
  ON market_infrastructure_status_logs (status_id);
