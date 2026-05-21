-- =============================================================================
-- Agency Group — Autonomous Validation Engine Tables
-- Migration: 20260522000033_validation_engine.sql
--
-- Creates tables for:
--   - architecture_scan_results  (Layer 1: Architecture Consistency Scan)
--   - event_integrity_reports    (Layer 2: Event System Integrity Test)
--   - validation_results         (Generic per-layer validation store)
--
-- All tables: RLS enabled, service_role_all policy, indexed by (tenant_id, timestamp DESC)
-- =============================================================================

CREATE TABLE IF NOT EXISTS architecture_scan_results (
  id                       uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id                uuid NOT NULL,
  layers_scanned           text[] NOT NULL DEFAULT '{}',
  dependency_edges         jsonb NOT NULL DEFAULT '[]',
  violations               jsonb NOT NULL DEFAULT '[]',
  risk_score               numeric(5,2) NOT NULL DEFAULT 0,
  health_score             numeric(5,2) NOT NULL DEFAULT 100,
  single_points_of_failure text[] NOT NULL DEFAULT '{}',
  critical_paths           text[] NOT NULL DEFAULT '{}',
  scanned_at               timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_integrity_reports (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id             uuid NOT NULL,
  overall_score         numeric(5,2) NOT NULL DEFAULT 0,
  event_integrity_score numeric(5,2) NOT NULL DEFAULT 0,
  replay_correctness    boolean NOT NULL DEFAULT false,
  tests                 jsonb NOT NULL DEFAULT '[]',
  orphan_count          integer NOT NULL DEFAULT 0,
  topic_coverage_pct    numeric(5,2) NOT NULL DEFAULT 0,
  total_events          integer NOT NULL DEFAULT 0,
  processed_events      integer NOT NULL DEFAULT 0,
  unprocessed_events    integer NOT NULL DEFAULT 0,
  tested_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS validation_results (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    uuid NOT NULL,
  layer        text NOT NULL,
  score        numeric(5,2) NOT NULL,
  passed       boolean NOT NULL,
  details      jsonb NOT NULL DEFAULT '{}',
  validated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_arch_scan_tenant
  ON architecture_scan_results (tenant_id, scanned_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_integrity_tenant
  ON event_integrity_reports (tenant_id, tested_at DESC);

CREATE INDEX IF NOT EXISTS idx_validation_results_tenant
  ON validation_results (tenant_id, layer, validated_at DESC);

-- Row-level security
ALTER TABLE architecture_scan_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_integrity_reports   ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_results        ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'architecture_scan_results'
      AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all
      ON architecture_scan_results
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'event_integrity_reports'
      AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all
      ON event_integrity_reports
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'validation_results'
      AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all
      ON validation_results
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
