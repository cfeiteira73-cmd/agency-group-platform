-- =============================================================================
-- Agency Group — Validation Results Tables v1.0
-- Migration: 20260522000034_validation_results.sql
--
-- Creates:
--   - system_truth_reports   (Layer 7 aggregate truth report)
--   - self_healing_reports   (Layer 7 self-healing execution log)
--
-- All tables have RLS enabled with service_role full access.
-- =============================================================================

CREATE TABLE IF NOT EXISTS system_truth_reports (
  id                       uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id                uuid NOT NULL,
  architecture_score       numeric(5,2) NOT NULL DEFAULT 0,
  event_integrity_score    numeric(5,2) NOT NULL DEFAULT 0,
  economic_accuracy_score  numeric(5,2) NOT NULL DEFAULT 0,
  ml_stability_score       numeric(5,2) NOT NULL DEFAULT 0,
  security_isolation_score numeric(5,2) NOT NULL DEFAULT 0,
  resilience_score         numeric(5,2) NOT NULL DEFAULT 0,
  overall_score            numeric(5,2) NOT NULL DEFAULT 0,
  system_validated         boolean NOT NULL DEFAULT false,
  stop_conditions          jsonb NOT NULL DEFAULT '{}',
  layer_scores             jsonb NOT NULL DEFAULT '[]',
  critical_issues          text[] NOT NULL DEFAULT '{}',
  high_issues              text[] NOT NULL DEFAULT '{}',
  healing_applied          boolean NOT NULL DEFAULT false,
  healing_report_id        uuid,
  generated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS self_healing_reports (
  id                              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id                       uuid NOT NULL,
  issues_detected                 jsonb NOT NULL DEFAULT '[]',
  healing_results                 jsonb NOT NULL DEFAULT '[]',
  critical_count                  integer NOT NULL DEFAULT 0,
  high_count                      integer NOT NULL DEFAULT 0,
  medium_count                    integer NOT NULL DEFAULT 0,
  low_count                       integer NOT NULL DEFAULT 0,
  auto_fixed_count                integer NOT NULL DEFAULT 0,
  manual_required_count           integer NOT NULL DEFAULT 0,
  system_validated_after_healing  boolean NOT NULL DEFAULT false,
  ran_at                          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_truth_reports_tenant
  ON system_truth_reports (tenant_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_self_healing_reports_tenant
  ON self_healing_reports (tenant_id, ran_at DESC);

ALTER TABLE system_truth_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE self_healing_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'system_truth_reports'
      AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON system_truth_reports
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'self_healing_reports'
      AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON self_healing_reports
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
