-- Agency Group — Data Trust Engine Schema
-- Migration: 000050_data_trust.sql
-- Creates tables for lineage tracking, source trust reports,
-- staleness reports, and reconciliation reports.

-- ─── data_lineage_events ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS data_lineage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  event_id text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  event_type text NOT NULL,
  source_system text NOT NULL,
  actor text,
  timestamp timestamptz NOT NULL,
  payload_hash text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_data_lineage_entity
  ON data_lineage_events(tenant_id, entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_data_lineage_source
  ON data_lineage_events(tenant_id, source_system, timestamp DESC);

ALTER TABLE data_lineage_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'data_lineage_events'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON data_lineage_events
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- ─── source_trust_reports ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS source_trust_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  generated_at timestamptz DEFAULT now(),
  overall_trust_score numeric(5,2),
  least_trusted_source text,
  recommendation text,
  sources jsonb DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_source_trust_reports_tenant
  ON source_trust_reports(tenant_id, generated_at DESC);

ALTER TABLE source_trust_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'source_trust_reports'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON source_trust_reports
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- ─── staleness_reports ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staleness_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  generated_at timestamptz DEFAULT now(),
  stale_tables integer DEFAULT 0,
  critical_stale integer DEFAULT 0,
  overall_freshness_score numeric(5,2),
  checks jsonb DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_staleness_reports_tenant
  ON staleness_reports(tenant_id, generated_at DESC);

ALTER TABLE staleness_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'staleness_reports'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON staleness_reports
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- ─── reconciliation_reports ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reconciliation_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  generated_at timestamptz DEFAULT now(),
  properties_checked integer DEFAULT 0,
  contacts_checked integer DEFAULT 0,
  discrepancies_found integer DEFAULT 0,
  data_health_score numeric(5,2),
  action_required boolean DEFAULT false,
  discrepancies jsonb DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_reports_tenant
  ON reconciliation_reports(tenant_id, generated_at DESC);

ALTER TABLE reconciliation_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'reconciliation_reports'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON reconciliation_reports
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;
