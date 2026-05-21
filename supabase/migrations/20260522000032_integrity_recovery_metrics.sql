-- =============================================================================
-- Agency Group — System Integrity + Recovery Metrics + Soft Delete Log
-- Migration: 20260522000032_integrity_recovery_metrics.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS integrity_check_results (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id        uuid NOT NULL,
  overall_status   text NOT NULL CHECK (overall_status IN ('pass','warn','fail')),
  overall_score    numeric(5,2) NOT NULL,
  sre_grade        char(1) NOT NULL CHECK (sre_grade IN ('S','A','B','C','D')),
  checks           jsonb NOT NULL DEFAULT '[]',
  critical_issues  text[] NOT NULL DEFAULT '{}',
  warnings         text[] NOT NULL DEFAULT '{}',
  generated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recovery_metrics (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id             uuid NOT NULL,
  component             text NOT NULL CHECK (component IN ('database','events','ml','app')),
  incident_type         text NOT NULL,
  actual_rto_minutes    numeric(8,2),
  actual_rpo_minutes    numeric(8,2),
  rto_slo_met           boolean,
  rpo_slo_met           boolean,
  incident_started_at   timestamptz NOT NULL,
  recovery_completed_at timestamptz,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS soft_delete_log (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id      uuid NOT NULL,
  table_name     text NOT NULL,
  record_id      uuid NOT NULL,
  deleted_by     text NOT NULL DEFAULT 'system',
  deleted_reason text,
  deleted_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integrity_check_tenant
  ON integrity_check_results (tenant_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_recovery_metrics_tenant
  ON recovery_metrics (tenant_id, component, incident_started_at DESC);

CREATE INDEX IF NOT EXISTS idx_soft_delete_log_tenant
  ON soft_delete_log (tenant_id, table_name, deleted_at DESC);

ALTER TABLE integrity_check_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_metrics         ENABLE ROW LEVEL SECURITY;
ALTER TABLE soft_delete_log          ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'integrity_check_results' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON integrity_check_results
      TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'recovery_metrics' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON recovery_metrics
      TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'soft_delete_log' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON soft_delete_log
      TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
