-- Agency Group — Wave 40: Unified Economic Growth Graph + Capital-Aware Segmentation
-- supabase/migrations/000058_growth_graph.sql

-- growth_graph_nodes: entities in the economic graph
CREATE TABLE IF NOT EXISTS growth_graph_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id text NOT NULL,
  tenant_id uuid NOT NULL,
  node_type text NOT NULL,
  entity_id text NOT NULL,
  label text,
  properties jsonb DEFAULT '{}',
  capital_weight_eur_cents bigint DEFAULT 0,
  signal_count integer DEFAULT 0,
  last_active_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, entity_id, node_type)
);
CREATE INDEX IF NOT EXISTS idx_growth_nodes_tenant ON growth_graph_nodes(tenant_id, node_type, signal_count DESC);
ALTER TABLE growth_graph_nodes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='growth_graph_nodes' AND policyname='tenant_isolation') THEN CREATE POLICY tenant_isolation ON growth_graph_nodes USING (tenant_id::text = current_setting('app.tenant_id', true)); END IF; END $$;

-- growth_graph_edges: economic signals as graph edges
CREATE TABLE IF NOT EXISTS growth_graph_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edge_id text NOT NULL UNIQUE,
  tenant_id uuid NOT NULL,
  from_node_id text NOT NULL,
  to_node_id text NOT NULL,
  edge_type text NOT NULL,
  weight numeric(8,4) DEFAULT 1.0,
  eur_cents_value bigint,
  occurred_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_growth_edges_tenant ON growth_graph_edges(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_edges_from ON growth_graph_edges(tenant_id, from_node_id);
ALTER TABLE growth_graph_edges ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='growth_graph_edges' AND policyname='tenant_isolation') THEN CREATE POLICY tenant_isolation ON growth_graph_edges USING (tenant_id::text = current_setting('app.tenant_id', true)); END IF; END $$;

-- growth_graph_snapshots
CREATE TABLE IF NOT EXISTS growth_graph_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  generated_at timestamptz DEFAULT now(),
  total_nodes integer DEFAULT 0,
  total_edges integer DEFAULT 0,
  node_counts jsonb DEFAULT '{}',
  signal_counts jsonb DEFAULT '{}',
  total_capital_weight_eur_cents bigint DEFAULT 0,
  graph_density numeric(8,6) DEFAULT 0,
  most_connected_nodes jsonb DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_growth_snapshots_tenant ON growth_graph_snapshots(tenant_id, generated_at DESC);
ALTER TABLE growth_graph_snapshots ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='growth_graph_snapshots' AND policyname='tenant_isolation') THEN CREATE POLICY tenant_isolation ON growth_graph_snapshots USING (tenant_id::text = current_setting('app.tenant_id', true)); END IF; END $$;

-- investor_segment_profiles
CREATE TABLE IF NOT EXISTS investor_segment_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  investor_id text NOT NULL,
  segment text NOT NULL,
  capital_size_eur_cents bigint DEFAULT 0,
  liquidity_contribution_score numeric(5,2) DEFAULT 0,
  bid_frequency_per_month numeric(8,4) DEFAULT 0,
  conversion_rate_pct numeric(5,2) DEFAULT 0,
  avg_roi_pct numeric(8,4) DEFAULT 0,
  last_activity_at timestamptz,
  days_since_last_activity integer DEFAULT 0,
  segment_confidence numeric(5,4) DEFAULT 0,
  segment_history jsonb DEFAULT '[]',
  computed_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, investor_id)
);
CREATE INDEX IF NOT EXISTS idx_investor_segments_tenant ON investor_segment_profiles(tenant_id, segment);
ALTER TABLE investor_segment_profiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investor_segment_profiles' AND policyname='tenant_isolation') THEN CREATE POLICY tenant_isolation ON investor_segment_profiles USING (tenant_id::text = current_setting('app.tenant_id', true)); END IF; END $$;

-- segmentation_reports
CREATE TABLE IF NOT EXISTS segmentation_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  generated_at timestamptz DEFAULT now(),
  total_investors integer DEFAULT 0,
  segment_distribution jsonb DEFAULT '{}',
  high_value_count integer DEFAULT 0,
  at_risk_count integer DEFAULT 0,
  total_capital_by_segment jsonb DEFAULT '{}',
  insights jsonb DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_segmentation_reports_tenant ON segmentation_reports(tenant_id, generated_at DESC);
ALTER TABLE segmentation_reports ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='segmentation_reports' AND policyname='tenant_isolation') THEN CREATE POLICY tenant_isolation ON segmentation_reports USING (tenant_id::text = current_setting('app.tenant_id', true)); END IF; END $$;

-- signal_collection_runs
CREATE TABLE IF NOT EXISTS signal_collection_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  collected_at timestamptz DEFAULT now(),
  signals_collected integer DEFAULT 0,
  entities_indexed integer DEFAULT 0,
  new_edges integer DEFAULT 0,
  collection_errors integer DEFAULT 0,
  duration_ms integer DEFAULT 0
);
ALTER TABLE signal_collection_runs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='signal_collection_runs' AND policyname='tenant_isolation') THEN CREATE POLICY tenant_isolation ON signal_collection_runs USING (tenant_id::text = current_setting('app.tenant_id', true)); END IF; END $$;
