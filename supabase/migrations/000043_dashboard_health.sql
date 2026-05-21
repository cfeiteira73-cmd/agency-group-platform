-- 000043: Dashboard Health and CRM Intelligence tables

CREATE TABLE IF NOT EXISTS portal_health_maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  portal_sections JSONB NOT NULL DEFAULT '[]',
  api_coverage JSONB NOT NULL DEFAULT '{}',
  data_consistency JSONB NOT NULL DEFAULT '{}',
  issues JSONB NOT NULL DEFAULT '[]',
  summary JSONB NOT NULL DEFAULT '{}',
  health_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS component_coverage_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  sections JSONB NOT NULL DEFAULT '[]',
  dead_sections JSONB NOT NULL DEFAULT '[]',
  hot_sections JSONB NOT NULL DEFAULT '[]',
  coverage_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dedup_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  record_type TEXT NOT NULL,
  records_scanned INTEGER NOT NULL DEFAULT 0,
  duplicate_pairs_found INTEGER NOT NULL DEFAULT 0,
  high_confidence_pairs INTEGER NOT NULL DEFAULT 0,
  pairs JSONB NOT NULL DEFAULT '[]',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS canonical_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('contact','deal','property')),
  canonical_id TEXT NOT NULL,
  superseded_ids JSONB NOT NULL DEFAULT '[]',
  data_completeness NUMERIC(5,2) NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  last_verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, entity_type, canonical_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_portal_health_maps_tenant ON portal_health_maps(tenant_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_dedup_reports_tenant ON dedup_reports(tenant_id, record_type, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_canonical_entities_tenant ON canonical_entities(tenant_id, entity_type);

-- RLS
ALTER TABLE portal_health_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE dedup_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_entities ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='portal_health_maps' AND policyname='tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON portal_health_maps USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='canonical_entities' AND policyname='tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON canonical_entities USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;
