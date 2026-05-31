-- Wave 54 Phase 3 — Off-Market Acquisition Engine

CREATE TABLE IF NOT EXISTS acquisition_sources (
  id bigserial PRIMARY KEY,
  source_id text NOT NULL UNIQUE,
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  country text NOT NULL DEFAULT 'PT',
  status text NOT NULL DEFAULT 'PENDING_APPROVAL',
  reliability_score integer NOT NULL DEFAULT 50,
  response_time_days integer NOT NULL DEFAULT 7,
  deal_frequency text NOT NULL DEFAULT 'UNKNOWN',
  min_ticket_eur numeric(15,2) NOT NULL DEFAULT 0,
  max_ticket_eur numeric(15,2) NOT NULL DEFAULT 0,
  contact_email text,
  contact_url text,
  notes text NOT NULL DEFAULT '',
  last_deal_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE acquisition_sources ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='acquisition_sources' AND policyname='service_role_all') THEN CREATE POLICY service_role_all ON acquisition_sources FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
CREATE INDEX IF NOT EXISTS idx_acq_src_tenant ON acquisition_sources (tenant_id);
CREATE INDEX IF NOT EXISTS idx_acq_src_type   ON acquisition_sources (type);
CREATE INDEX IF NOT EXISTS idx_acq_src_status ON acquisition_sources (status);

CREATE TABLE IF NOT EXISTS acquisition_opportunities (
  id bigserial PRIMARY KEY,
  opportunity_id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  source_id text NOT NULL,
  source_type text NOT NULL,
  title text NOT NULL,
  location text NOT NULL,
  country text NOT NULL DEFAULT 'PT',
  asset_type text NOT NULL DEFAULT 'RESIDENTIAL',
  asking_price_eur numeric(15,2) NOT NULL DEFAULT 0,
  estimated_market_value_eur numeric(15,2) NOT NULL DEFAULT 0,
  discount_pct numeric(5,2) NOT NULL DEFAULT 0,
  gross_yield_pct numeric(5,2),
  urgency_score integer NOT NULL DEFAULT 50,
  opportunity_score integer NOT NULL DEFAULT 0,
  lead_score integer NOT NULL DEFAULT 0,
  duplicate_flag boolean NOT NULL DEFAULT false,
  duplicate_of uuid,
  stage text NOT NULL DEFAULT 'IDENTIFIED',
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'ACTIVE',
  detected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE acquisition_opportunities ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='acquisition_opportunities' AND policyname='service_role_all') THEN CREATE POLICY service_role_all ON acquisition_opportunities FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
CREATE INDEX IF NOT EXISTS idx_acq_opp_tenant ON acquisition_opportunities (tenant_id);
CREATE INDEX IF NOT EXISTS idx_acq_opp_stage  ON acquisition_opportunities (stage);
CREATE INDEX IF NOT EXISTS idx_acq_opp_score  ON acquisition_opportunities (opportunity_score DESC);
CREATE INDEX IF NOT EXISTS idx_acq_opp_date   ON acquisition_opportunities (detected_at DESC);

CREATE TABLE IF NOT EXISTS acquisition_pipeline_snapshots (
  id bigserial PRIMARY KEY,
  pipeline_id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  total_opportunities integer NOT NULL DEFAULT 0,
  avg_opportunity_score integer NOT NULL DEFAULT 0,
  duplicates_detected integer NOT NULL DEFAULT 0,
  pipeline_hash text NOT NULL,
  report_json jsonb NOT NULL DEFAULT '{}',
  generated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE acquisition_pipeline_snapshots ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='acquisition_pipeline_snapshots' AND policyname='service_role_all') THEN CREATE POLICY service_role_all ON acquisition_pipeline_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
CREATE INDEX IF NOT EXISTS idx_acq_pipe_tenant ON acquisition_pipeline_snapshots (tenant_id);
CREATE INDEX IF NOT EXISTS idx_acq_pipe_date   ON acquisition_pipeline_snapshots (generated_at DESC);
