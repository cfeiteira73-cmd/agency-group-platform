-- Wave 54 Phase 4+5 — Sofia OS + Capital Matching

CREATE TABLE IF NOT EXISTS sofia_conversation_turns (
  id bigserial PRIMARY KEY,
  session_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  contact_id text NOT NULL,
  role text NOT NULL,
  channel text NOT NULL DEFAULT 'WEB',
  user_message text NOT NULL,
  intent text NOT NULL DEFAULT 'INQUIRE',
  entities_json jsonb NOT NULL DEFAULT '{}',
  lead_score integer NOT NULL DEFAULT 0,
  nba text NOT NULL DEFAULT 'CONTINUE_QUALIFICATION',
  escalated boolean NOT NULL DEFAULT false,
  response_text text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE sofia_conversation_turns ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sofia_conversation_turns' AND policyname='service_role_all') THEN CREATE POLICY service_role_all ON sofia_conversation_turns FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
CREATE INDEX IF NOT EXISTS idx_sofia_turns_session ON sofia_conversation_turns (session_id);
CREATE INDEX IF NOT EXISTS idx_sofia_turns_contact ON sofia_conversation_turns (contact_id);
CREATE INDEX IF NOT EXISTS idx_sofia_turns_tenant  ON sofia_conversation_turns (tenant_id);
CREATE INDEX IF NOT EXISTS idx_sofia_turns_date    ON sofia_conversation_turns (created_at DESC);

CREATE TABLE IF NOT EXISTS sofia_escalations (
  id bigserial PRIMARY KEY,
  escalation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  session_id uuid NOT NULL,
  contact_id text NOT NULL,
  lead_id uuid,
  reason text NOT NULL,
  context text NOT NULL DEFAULT '',
  assigned_to text,
  acknowledged boolean NOT NULL DEFAULT false,
  escalated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE sofia_escalations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sofia_escalations' AND policyname='service_role_all') THEN CREATE POLICY service_role_all ON sofia_escalations FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
CREATE INDEX IF NOT EXISTS idx_sofia_esc_tenant ON sofia_escalations (tenant_id);
CREATE INDEX IF NOT EXISTS idx_sofia_esc_ack    ON sofia_escalations (acknowledged);
CREATE INDEX IF NOT EXISTS idx_sofia_esc_date   ON sofia_escalations (escalated_at DESC);

-- Capital Matching
CREATE TABLE IF NOT EXISTS capital_profiles (
  id bigserial PRIMARY KEY,
  profile_id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'BUYER',
  name text NOT NULL,
  budget_min_eur numeric(15,2) NOT NULL DEFAULT 0,
  budget_max_eur numeric(15,2) NOT NULL DEFAULT 0,
  preferred_locations jsonb NOT NULL DEFAULT '[]',
  preferred_asset_types jsonb NOT NULL DEFAULT '[]',
  risk_tolerance text NOT NULL DEFAULT 'MODERATE',
  target_yield_min_pct numeric(5,2) NOT NULL DEFAULT 0,
  target_yield_max_pct numeric(5,2) NOT NULL DEFAULT 100,
  investment_horizon_months integer NOT NULL DEFAULT 60,
  liquidity_preference text NOT NULL DEFAULT 'MEDIUM',
  currency text NOT NULL DEFAULT 'EUR',
  verified boolean NOT NULL DEFAULT false,
  kyc_status text NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE capital_profiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='capital_profiles' AND policyname='service_role_all') THEN CREATE POLICY service_role_all ON capital_profiles FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
CREATE INDEX IF NOT EXISTS idx_cap_prof_tenant ON capital_profiles (tenant_id);
CREATE INDEX IF NOT EXISTS idx_cap_prof_type   ON capital_profiles (type);

CREATE TABLE IF NOT EXISTS asset_opportunities (
  id bigserial PRIMARY KEY,
  asset_id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'RESIDENTIAL',
  location text NOT NULL,
  country text NOT NULL DEFAULT 'PT',
  price_eur numeric(15,2) NOT NULL DEFAULT 0,
  gross_yield_pct numeric(5,2),
  net_yield_pct numeric(5,2),
  liquidity_score integer NOT NULL DEFAULT 50,
  risk_score integer NOT NULL DEFAULT 50,
  deal_probability integer NOT NULL DEFAULT 50,
  execution_priority integer NOT NULL DEFAULT 50,
  off_market boolean NOT NULL DEFAULT false,
  exclusive boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE asset_opportunities ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='asset_opportunities' AND policyname='service_role_all') THEN CREATE POLICY service_role_all ON asset_opportunities FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
CREATE INDEX IF NOT EXISTS idx_asset_opp_tenant ON asset_opportunities (tenant_id);
CREATE INDEX IF NOT EXISTS idx_asset_opp_status ON asset_opportunities (status);
CREATE INDEX IF NOT EXISTS idx_asset_opp_type   ON asset_opportunities (type);

CREATE TABLE IF NOT EXISTS capital_matches (
  id bigserial PRIMARY KEY,
  match_id text NOT NULL UNIQUE,
  report_id uuid,
  tenant_id uuid NOT NULL,
  match_type text NOT NULL,
  profile_id uuid NOT NULL,
  asset_id uuid NOT NULL,
  overall_score integer NOT NULL DEFAULT 0,
  grade text NOT NULL DEFAULT 'WEAK',
  deal_probability integer NOT NULL DEFAULT 0,
  execution_priority integer NOT NULL DEFAULT 0,
  recommendation text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE capital_matches ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='capital_matches' AND policyname='service_role_all') THEN CREATE POLICY service_role_all ON capital_matches FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
CREATE INDEX IF NOT EXISTS idx_cap_match_tenant ON capital_matches (tenant_id);
CREATE INDEX IF NOT EXISTS idx_cap_match_score  ON capital_matches (overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_cap_match_grade  ON capital_matches (grade);

CREATE TABLE IF NOT EXISTS capital_matching_reports (
  id bigserial PRIMARY KEY,
  report_id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  total_matches integer NOT NULL DEFAULT 0,
  perfect_matches integer NOT NULL DEFAULT 0,
  avg_score integer NOT NULL DEFAULT 0,
  coverage_pct numeric(5,2) NOT NULL DEFAULT 0,
  matching_hash text NOT NULL,
  report_json jsonb NOT NULL DEFAULT '{}',
  generated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE capital_matching_reports ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='capital_matching_reports' AND policyname='service_role_all') THEN CREATE POLICY service_role_all ON capital_matching_reports FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
CREATE INDEX IF NOT EXISTS idx_cap_match_rpt_tenant ON capital_matching_reports (tenant_id);
CREATE INDEX IF NOT EXISTS idx_cap_match_rpt_date   ON capital_matching_reports (generated_at DESC);
