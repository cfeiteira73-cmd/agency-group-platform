-- PART 1/4: CREATE TABLE + COLUMNS (run first)
CREATE TABLE IF NOT EXISTS capital_profiles (
  id bigserial PRIMARY KEY, profile_id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL, type text NOT NULL DEFAULT 'BUYER',
  name text NOT NULL DEFAULT '', budget_min_eur numeric(15,2) NOT NULL DEFAULT 0,
  budget_max_eur numeric(15,2) NOT NULL DEFAULT 0,
  preferred_locations jsonb NOT NULL DEFAULT '[]', preferred_asset_types jsonb NOT NULL DEFAULT '[]',
  risk_tolerance text NOT NULL DEFAULT 'MODERATE', target_yield_min_pct numeric(5,2) NOT NULL DEFAULT 0,
  target_yield_max_pct numeric(5,2) NOT NULL DEFAULT 100, investment_horizon_months integer NOT NULL DEFAULT 60,
  liquidity_preference text NOT NULL DEFAULT 'MEDIUM', currency text NOT NULL DEFAULT 'EUR',
  verified boolean NOT NULL DEFAULT false, kyc_status text NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE capital_profiles ENABLE ROW LEVEL SECURITY;
DO $pol$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='capital_profiles' AND policyname='service_role_all') THEN CREATE POLICY service_role_all ON capital_profiles FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $pol$;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS lead_id text;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS linkedin text;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS country_iso text;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS company text;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS persona_type text;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS tier text DEFAULT 'C';
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS total_score numeric(5,2) DEFAULT 0;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS capital_score numeric(5,2) DEFAULT 0;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS influence_score numeric(5,2) DEFAULT 0;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS connector_score numeric(5,2) DEFAULT 0;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS deal_score numeric(5,2) DEFAULT 0;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS hot_score numeric(5,2) DEFAULT 0;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS contactability_score integer DEFAULT 60;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS crm_pipeline text DEFAULT 'NURTURE';
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS owner text DEFAULT 'MARKETING';
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS sofia_sequence text DEFAULT 'SEQ_NURTURE';
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS next_action text;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS contact_status text DEFAULT 'NEW';
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS newsletter_segment text;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS buying_power_est text;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS priority_level integer DEFAULT 5;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS do_not_contact boolean DEFAULT false;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS manual_review boolean DEFAULT false;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS consent_status text DEFAULT 'PENDING_CONFIRMATION';
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS outreach_type text DEFAULT 'NEWSLETTER';
CREATE INDEX IF NOT EXISTS idx_cp_tier ON capital_profiles (tier);
CREATE INDEX IF NOT EXISTS idx_cp_pipeline ON capital_profiles (crm_pipeline);
CREATE INDEX IF NOT EXISTS idx_cp_owner ON capital_profiles (owner);
CREATE INDEX IF NOT EXISTS idx_cp_persona ON capital_profiles (persona_type);
CREATE INDEX IF NOT EXISTS idx_cp_score ON capital_profiles (total_score DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cp_lead_id ON capital_profiles (lead_id) WHERE lead_id IS NOT NULL;
SELECT 'Part 1 complete - table ready' AS status, COUNT(*) AS rows FROM capital_profiles;
