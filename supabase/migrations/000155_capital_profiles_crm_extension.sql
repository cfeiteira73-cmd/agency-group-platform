-- Wave 60+ — Extend capital_profiles for full CRM import
-- Adds strategic CRM fields to capital_profiles table
-- Safe: all columns use IF NOT EXISTS pattern via ALTER TABLE

ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS lead_id text UNIQUE;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS linkedin text;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS country_iso text;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS company text;
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
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS last_contact_at timestamptz;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS next_contact_at timestamptz;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS newsletter_segment text;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS buying_power_est text;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS portugal_interest numeric(3,1) DEFAULT 5.0;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS priority_level integer DEFAULT 5;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS is_duplicate boolean DEFAULT false;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS do_not_contact boolean DEFAULT false;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS manual_review boolean DEFAULT false;
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS consent_status text DEFAULT 'PENDING_CONFIRMATION';
ALTER TABLE capital_profiles ADD COLUMN IF NOT EXISTS outreach_type text DEFAULT 'NEWSLETTER';

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_cap_prof_tier       ON capital_profiles (tier);
CREATE INDEX IF NOT EXISTS idx_cap_prof_pipeline   ON capital_profiles (crm_pipeline);
CREATE INDEX IF NOT EXISTS idx_cap_prof_owner      ON capital_profiles (owner);
CREATE INDEX IF NOT EXISTS idx_cap_prof_persona    ON capital_profiles (persona_type);
CREATE INDEX IF NOT EXISTS idx_cap_prof_score      ON capital_profiles (total_score DESC);
CREATE INDEX IF NOT EXISTS idx_cap_prof_email      ON capital_profiles (email);
CREATE INDEX IF NOT EXISTS idx_cap_prof_status     ON capital_profiles (contact_status);
