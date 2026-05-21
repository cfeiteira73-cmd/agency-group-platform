-- =============================================================================
-- 000042: Production Readiness tables
-- Agency Group — Wave 36
-- =============================================================================

-- Production Readiness Reports (full narrative report per tenant)
CREATE TABLE IF NOT EXISTS production_readiness_reports (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL,
  architecture_health JSONB       NOT NULL DEFAULT '{}',
  financial_integrity JSONB       NOT NULL DEFAULT '{}',
  market_simulation   JSONB       NOT NULL DEFAULT '{}',
  ml_readiness        JSONB       NOT NULL DEFAULT '{}',
  security_posture    JSONB       NOT NULL DEFAULT '{}',
  infra_resilience    JSONB       NOT NULL DEFAULT '{}',
  readiness_score     JSONB       NOT NULL DEFAULT '{}',
  production_ready    BOOLEAN     NOT NULL DEFAULT false,
  verdict             TEXT        NOT NULL DEFAULT 'BLOCKED',
  blocking_issues     JSONB       NOT NULL DEFAULT '[]',
  generated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Production Readiness Scores (weighted dimension scores + stop conditions)
CREATE TABLE IF NOT EXISTS production_readiness_scores (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL,
  total_score         NUMERIC(5,2) NOT NULL DEFAULT 0,
  dimensions          JSONB       NOT NULL DEFAULT '{}',
  stop_conditions     JSONB       NOT NULL DEFAULT '[]',
  production_blocked  BOOLEAN     NOT NULL DEFAULT true,
  blocking_reasons    JSONB       NOT NULL DEFAULT '[]',
  verdict             TEXT        NOT NULL DEFAULT 'BLOCKED',
  critical_actions    JSONB       NOT NULL DEFAULT '[]',
  recommended_actions JSONB       NOT NULL DEFAULT '[]',
  scored_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_production_readiness_reports_tenant
  ON production_readiness_reports(tenant_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_production_readiness_scores_tenant
  ON production_readiness_scores(tenant_id, scored_at DESC);

CREATE INDEX IF NOT EXISTS idx_production_readiness_verdict
  ON production_readiness_reports(production_ready, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_production_readiness_scores_verdict
  ON production_readiness_scores(verdict, scored_at DESC);

-- RLS
ALTER TABLE production_readiness_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_readiness_scores  ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'production_readiness_reports'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON production_readiness_reports
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'production_readiness_scores'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON production_readiness_scores
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;
