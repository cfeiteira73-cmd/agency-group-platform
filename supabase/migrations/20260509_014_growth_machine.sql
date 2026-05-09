-- =============================================================================
-- Agency Group — Growth Machine + Client Milestones
-- Migration: 20260509_014_growth_machine.sql
-- =============================================================================

-- referrals: track who referred whom
CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  referred_contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  referrer_email text,
  referred_email text,
  source text NOT NULL DEFAULT 'direct', -- 'client','agent','partner','organic','paid'
  deal_id uuid REFERENCES deals(id) ON DELETE SET NULL,
  reward_triggered boolean NOT NULL DEFAULT false,
  reward_amount numeric(10,2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_contact_id);
CREATE INDEX IF NOT EXISTS idx_referrals_created ON referrals(created_at);
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_referrals" ON referrals FOR ALL TO service_role USING (true);

-- growth_metrics: weekly snapshot of growth KPIs
CREATE TABLE IF NOT EXISTS growth_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL,
  new_leads integer NOT NULL DEFAULT 0,
  new_qualified integer NOT NULL DEFAULT 0,
  new_clients integer NOT NULL DEFAULT 0,
  referral_count integer NOT NULL DEFAULT 0,
  organic_leads integer NOT NULL DEFAULT 0,
  paid_leads integer NOT NULL DEFAULT 0,
  viral_coefficient numeric(5,3), -- K-factor: referrals per client
  cac_eur numeric(10,2), -- Customer Acquisition Cost
  ltv_eur numeric(10,2), -- Lifetime Value
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(week_start)
);
ALTER TABLE growth_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_growth_metrics" ON growth_metrics FOR ALL TO service_role USING (true);
