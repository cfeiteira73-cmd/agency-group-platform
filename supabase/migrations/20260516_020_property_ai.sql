-- =============================================================================
-- AGENCY GROUP — SH-ROS Migration 020: Property AI Engine
-- Autonomous property ingestion, AI listing, media, intelligence, distribution
-- AMI: 22506 | Safe additive migration — all new tables, no existing table changes
-- =============================================================================

-- PART A: property_ai_submissions
-- Tracks all incoming property upload submissions
CREATE TABLE IF NOT EXISTS property_ai_submissions (
  id               uuid            DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id    text            NOT NULL UNIQUE,
  org_id           text            NOT NULL,
  agent_id         text            NOT NULL,
  status           text            NOT NULL DEFAULT 'ingesting'
                   CHECK (status IN ('ingesting','analyzing','enriching','generating','reviewing','live','archived')),
  input_files      jsonb           NOT NULL DEFAULT '[]',
  raw_description  text,
  raw_url          text,
  created_at       timestamptz     NOT NULL DEFAULT now(),
  updated_at       timestamptz     NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prop_submissions_org ON property_ai_submissions(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prop_submissions_status ON property_ai_submissions(status);
ALTER TABLE property_ai_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prop_submissions_service_only" ON property_ai_submissions;
CREATE POLICY "prop_submissions_service_only" ON property_ai_submissions
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- PART B: property_ai_analysis
-- AI vision + OCR + geospatial analysis results
CREATE TABLE IF NOT EXISTS property_ai_analysis (
  id                    uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id           text        NOT NULL UNIQUE,
  submission_id         text        NOT NULL REFERENCES property_ai_submissions(submission_id) ON DELETE CASCADE,
  org_id                text        NOT NULL,
  property_type         text,
  bedrooms              integer,
  bathrooms             integer,
  area_sqm              numeric(8,2),
  floor                 integer,
  condition             text        NOT NULL DEFAULT 'unknown',
  energy_class          text        NOT NULL DEFAULT 'unknown',
  has_pool              boolean     NOT NULL DEFAULT false,
  has_garden            boolean     NOT NULL DEFAULT false,
  has_parking           boolean     NOT NULL DEFAULT false,
  has_elevator          boolean     NOT NULL DEFAULT false,
  has_sea_view          boolean     NOT NULL DEFAULT false,
  has_golf_view         boolean     NOT NULL DEFAULT false,
  has_city_view         boolean     NOT NULL DEFAULT false,
  has_mountain_view     boolean     NOT NULL DEFAULT false,
  architecture_style    text        NOT NULL DEFAULT 'modern',
  luxury_score          numeric(5,2) NOT NULL DEFAULT 0,
  renovation_probability numeric(4,3) NOT NULL DEFAULT 0,
  sunlight_score        numeric(5,2) NOT NULL DEFAULT 50,
  staging_quality       text        NOT NULL DEFAULT 'basic',
  location              jsonb,
  confidence            numeric(4,3) NOT NULL DEFAULT 0.5,
  analyzed_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prop_analysis_submission ON property_ai_analysis(submission_id);
CREATE INDEX IF NOT EXISTS idx_prop_analysis_org ON property_ai_analysis(org_id);
ALTER TABLE property_ai_analysis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prop_analysis_service_only" ON property_ai_analysis;
CREATE POLICY "prop_analysis_service_only" ON property_ai_analysis
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- PART C: property_ai_listings
-- Generated multilingual listings
CREATE TABLE IF NOT EXISTS property_ai_listings (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id       text        NOT NULL UNIQUE,
  submission_id    text        NOT NULL REFERENCES property_ai_submissions(submission_id) ON DELETE CASCADE,
  org_id           text        NOT NULL,
  titles           jsonb       NOT NULL DEFAULT '{}',
  seo_titles       jsonb       NOT NULL DEFAULT '{}',
  descriptions     jsonb       NOT NULL DEFAULT '{}',
  short_descriptions jsonb     NOT NULL DEFAULT '{}',
  investor_descriptions jsonb  NOT NULL DEFAULT '{}',
  luxury_descriptions jsonb    NOT NULL DEFAULT '{}',
  social_captions  jsonb       NOT NULL DEFAULT '{}',
  meta_descriptions jsonb      NOT NULL DEFAULT '{}',
  seo_keywords     text[]      NOT NULL DEFAULT '{}',
  estimated_price_eur numeric(12,2),
  price_per_sqm    numeric(8,2),
  confidence       numeric(4,3) NOT NULL DEFAULT 0.5,
  generated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prop_listings_submission ON property_ai_listings(submission_id);
CREATE INDEX IF NOT EXISTS idx_prop_listings_org ON property_ai_listings(org_id, generated_at DESC);
ALTER TABLE property_ai_listings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prop_listings_service_only" ON property_ai_listings;
CREATE POLICY "prop_listings_service_only" ON property_ai_listings
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- PART D: property_ai_media
-- Media assets with AI scoring
CREATE TABLE IF NOT EXISTS property_ai_media (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id         text        NOT NULL UNIQUE,
  submission_id    text        NOT NULL REFERENCES property_ai_submissions(submission_id) ON DELETE CASCADE,
  type             text        NOT NULL,
  url              text        NOT NULL,
  thumbnail_url    text,
  aesthetic_score  numeric(5,2) NOT NULL DEFAULT 50,
  is_cover         boolean     NOT NULL DEFAULT false,
  sequence_order   integer     NOT NULL DEFAULT 0,
  is_blurry        boolean     NOT NULL DEFAULT false,
  is_duplicate     boolean     NOT NULL DEFAULT false,
  social_crop_url  text,
  hero_crop_url    text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prop_media_submission ON property_ai_media(submission_id, sequence_order);
ALTER TABLE property_ai_media ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prop_media_service_only" ON property_ai_media;
CREATE POLICY "prop_media_service_only" ON property_ai_media
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- PART E: property_ai_intelligence
-- Computed intelligence scores
CREATE TABLE IF NOT EXISTS property_ai_intelligence (
  id                       uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  intel_id                 text        NOT NULL UNIQUE,
  submission_id            text        NOT NULL REFERENCES property_ai_submissions(submission_id) ON DELETE CASCADE,
  org_id                   text        NOT NULL,
  demand_score             numeric(5,2) NOT NULL DEFAULT 0,
  conversion_probability   numeric(4,3) NOT NULL DEFAULT 0,
  lead_attractiveness      numeric(5,2) NOT NULL DEFAULT 0,
  investor_attractiveness  numeric(5,2) NOT NULL DEFAULT 0,
  liquidity_speed_days     integer     NOT NULL DEFAULT 210,
  pricing_competitiveness  numeric(4,3) NOT NULL DEFAULT 0.5,
  featured_priority_score  numeric(5,2) NOT NULL DEFAULT 0,
  luxury_visibility_score  numeric(5,2) NOT NULL DEFAULT 0,
  homepage_placement_score numeric(5,2) NOT NULL DEFAULT 0,
  listing_readiness_score  numeric(5,2) NOT NULL DEFAULT 0,
  computed_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prop_intel_org ON property_ai_intelligence(org_id, homepage_placement_score DESC);
CREATE INDEX IF NOT EXISTS idx_prop_intel_submission ON property_ai_intelligence(submission_id);
ALTER TABLE property_ai_intelligence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prop_intel_service_only" ON property_ai_intelligence;
CREATE POLICY "prop_intel_service_only" ON property_ai_intelligence
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- PART F: property_ai_copilot
-- Agent copilot recommendations
CREATE TABLE IF NOT EXISTS property_ai_copilot (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id    text        NOT NULL REFERENCES property_ai_submissions(submission_id) ON DELETE CASCADE,
  org_id           text        NOT NULL,
  readiness_report jsonb       NOT NULL DEFAULT '{}',
  pricing_advice   jsonb       NOT NULL DEFAULT '{}',
  publishing_strategy jsonb    NOT NULL DEFAULT '{}',
  audience_profile jsonb       NOT NULL DEFAULT '{}',
  ai_summary       text,
  action_items     text[]      NOT NULL DEFAULT '{}',
  generated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prop_copilot_submission ON property_ai_copilot(submission_id);
ALTER TABLE property_ai_copilot ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prop_copilot_service_only" ON property_ai_copilot;
CREATE POLICY "prop_copilot_service_only" ON property_ai_copilot
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- PART G: property_ai_distribution
-- Distribution results per channel
CREATE TABLE IF NOT EXISTS property_ai_distribution (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  distribution_id  text        NOT NULL UNIQUE,
  submission_id    text        NOT NULL REFERENCES property_ai_submissions(submission_id) ON DELETE CASCADE,
  channel          text        NOT NULL,
  status           text        NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','sent','failed','skipped')),
  sent_at          timestamptz,
  error            text,
  asset_url        text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prop_dist_submission ON property_ai_distribution(submission_id);
CREATE INDEX IF NOT EXISTS idx_prop_dist_status ON property_ai_distribution(status);
ALTER TABLE property_ai_distribution ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prop_dist_service_only" ON property_ai_distribution;
CREATE POLICY "prop_dist_service_only" ON property_ai_distribution
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- PART H: property_ai_performance_events
-- Raw performance tracking events
CREATE TABLE IF NOT EXISTS property_ai_performance_events (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id         text        NOT NULL UNIQUE,
  submission_id    text        NOT NULL REFERENCES property_ai_submissions(submission_id) ON DELETE CASCADE,
  org_id           text        NOT NULL,
  event_type       text        NOT NULL,
  channel          text        NOT NULL,
  session_id       text,
  occurred_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prop_perf_submission ON property_ai_performance_events(submission_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_prop_perf_org ON property_ai_performance_events(org_id, occurred_at DESC);
ALTER TABLE property_ai_performance_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prop_perf_service_only" ON property_ai_performance_events;
CREATE POLICY "prop_perf_service_only" ON property_ai_performance_events
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- PART I: property_ai_learning_adjustments
-- Learning feedback applied to scoring weights
CREATE TABLE IF NOT EXISTS property_ai_learning_adjustments (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  adjustment_id    text        NOT NULL UNIQUE,
  org_id           text        NOT NULL,
  feature          text        NOT NULL,
  old_weight       numeric(6,4) NOT NULL,
  new_weight       numeric(6,4) NOT NULL,
  reason           text,
  applied_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prop_learning_org ON property_ai_learning_adjustments(org_id, applied_at DESC);
ALTER TABLE property_ai_learning_adjustments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prop_learning_service_only" ON property_ai_learning_adjustments;
CREATE POLICY "prop_learning_service_only" ON property_ai_learning_adjustments
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- =============================================================================
-- Migration 020 complete — 9 new tables, all RLS-protected (service_role only)
-- property_ai_submissions · property_ai_analysis · property_ai_listings
-- property_ai_media · property_ai_intelligence · property_ai_copilot
-- property_ai_distribution · property_ai_performance_events
-- property_ai_learning_adjustments
-- =============================================================================
