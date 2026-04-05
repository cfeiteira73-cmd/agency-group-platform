-- =============================================================================
-- AGENCY GROUP — Initial Database Schema v2.0
-- Migration: 001_initial_schema.sql
-- Description: Full production schema for luxury real estate CRM + AI automation
-- Extensions: uuid-ossp, vector (pgvector 1536-dim), pg_trgm, btree_gin
-- AMI: 22506 | Segment: €100K–€100M | Portugal + Espanha + Madeira + Açores
-- =============================================================================

-- ---------------------------------------------------------------------------
-- EXTENSIONS
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------

CREATE TYPE property_status AS ENUM (
  'active',        -- Listed and available
  'under_offer',   -- Offer accepted, awaiting CPCV
  'cpcv',          -- Promissory contract signed
  'sold',          -- Escritura completed
  'withdrawn',     -- Removed from market
  'rented',        -- Property rented
  'off_market'     -- Available but not publicly listed
);

CREATE TYPE property_type AS ENUM (
  'apartment',
  'villa',
  'townhouse',
  'penthouse',
  'land',
  'commercial',
  'office',
  'warehouse',
  'hotel',
  'development_plot'
);

CREATE TYPE contact_status AS ENUM (
  'lead',          -- Initial contact, unqualified
  'prospect',      -- Contacted, shown interest
  'qualified',     -- Qualified buyer/seller confirmed
  'active',        -- Actively searching/selling
  'negotiating',   -- In active deal negotiation
  'client',        -- Completed at least one transaction
  'vip',           -- High-value repeat client
  'dormant',       -- No contact > 90 days
  'lost',          -- Opted out or unresponsive
  'referrer'       -- Referral partner only
);

CREATE TYPE contact_role AS ENUM (
  'buyer',
  'seller',
  'investor',
  'tenant',
  'landlord',
  'referrer',
  'developer',
  'solicitor',
  'notary',
  'other'
);

CREATE TYPE deal_stage AS ENUM (
  -- Buy-side stages (probability %)
  'lead',              -- 5%
  'qualification',     -- 15%
  'visit_scheduled',   -- 30%
  'visit_done',        -- 40%
  'proposal',          -- 60%
  'negotiation',       -- 70%
  'cpcv',              -- 90%
  'escritura',         -- 97%
  'post_sale',         -- 100%
  -- Sell-side stages
  'prospecting',       -- 20%
  'valuation',         -- 45%
  'mandate',           -- 60%
  'active_listing',    -- 65%
  'offer_received',    -- 75%
  'cpcv_sell',         -- 90%
  'escritura_sell'     -- 97%
);

CREATE TYPE deal_type AS ENUM (
  'buy_side',      -- Representing the buyer
  'sell_side',     -- Representing the seller
  'dual_agency',   -- Representing both (with disclosure)
  'rental',
  'investment'
);

CREATE TYPE activity_type AS ENUM (
  'call_outbound',
  'call_inbound',
  'email_sent',
  'email_received',
  'whatsapp_sent',
  'whatsapp_received',
  'meeting',
  'visit',
  'note',
  'document_sent',
  'offer_made',
  'offer_received',
  'task_completed',
  'system_event'
);

CREATE TYPE signal_type AS ENUM (
  'inheritance',       -- Herdeiro a vender imóvel herdado
  'insolvency',        -- Processo de insolvência no DR
  'divorce',           -- Divórcio / partilha de bens
  'relocation',        -- Proprietário a mudar de cidade/país
  'multi_property',    -- Proprietário com múltiplos imóveis
  'price_reduction',   -- Redução de preço no mercado
  'stagnated_listing', -- Imóvel há mais de 180 dias
  'new_below_avm',     -- Novo imóvel abaixo do AVM
  'listing_removed',   -- Removido do portal (negociação directa?)
  'hot_zone_new'       -- Nova listagem em zona de alta procura
);

CREATE TYPE signal_status AS ENUM (
  'new',
  'in_progress',
  'contacted',
  'converted',
  'dismissed'
);

CREATE TYPE task_status AS ENUM (
  'pending',
  'in_progress',
  'completed',
  'cancelled',
  'deferred'
);

CREATE TYPE notification_channel AS ENUM (
  'email',
  'whatsapp',
  'push',
  'sms',
  'in_app'
);

CREATE TYPE referral_tier AS ENUM (
  'bronze',    -- 0-2 referrals
  'silver',    -- 3-5 referrals
  'gold',      -- 6-10 referrals
  'platinum'   -- 11+ referrals
);

CREATE TYPE lead_tier AS ENUM (
  'A',   -- Hot: score > 70
  'B',   -- Warm: score 40-70
  'C'    -- Cold: score < 40
);

-- ---------------------------------------------------------------------------
-- TABLE: profiles
-- Purpose: Supabase Auth user profiles — consultants, admins, managers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  phone           TEXT,
  role            TEXT NOT NULL DEFAULT 'consultant'
                    CHECK (role IN ('admin', 'manager', 'consultant', 'assistant')),
  ami_number      TEXT DEFAULT 'AMI 22506',
  avatar_url      TEXT,
  whatsapp_number TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  monthly_target  DECIMAL(12, 2),               -- Monthly GCI target in EUR
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE profiles IS 'Supabase Auth user profiles for Agency Group consultants and staff. Linked 1:1 to auth.users.';

-- ---------------------------------------------------------------------------
-- TABLE: contacts
-- Purpose: Master contact table — buyers, sellers, investors, referrers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contacts (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Identity
  full_name             TEXT NOT NULL,
  email                 TEXT,
  phone                 TEXT,
  whatsapp              TEXT,
  nationality           CHAR(2),                -- ISO 3166-1 alpha-2: PT, US, FR, GB, DE, AE, CN
  language              TEXT DEFAULT 'pt',      -- BCP 47: pt, en, fr, de, ar, zh
  -- Roles & Status
  role                  contact_role NOT NULL DEFAULT 'buyer',
  status                contact_status NOT NULL DEFAULT 'lead',
  lead_tier             lead_tier,              -- A/B/C classification
  lead_score            SMALLINT DEFAULT 0 CHECK (lead_score BETWEEN 0 AND 100),
  lead_score_breakdown  JSONB,                  -- {budget:30, source:20, phone:10, ...}
  -- Source tracking
  source                TEXT,                   -- 'referral','idealista_premium','website','cold_call','instagram'
  source_detail         TEXT,
  referrer_id           UUID REFERENCES contacts(id) ON DELETE SET NULL,
  -- Assignment
  assigned_to           UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- Buyer profile (embedded — avoids JOIN for common operations)
  budget_min            DECIMAL(12, 2),
  budget_max            DECIMAL(12, 2),
  preferred_locations   TEXT[],                 -- ['Lisboa','Cascais','Sintra']
  typologies_wanted     TEXT[],                 -- ['apartment','villa']
  bedrooms_min          SMALLINT,
  bedrooms_max          SMALLINT,
  features_required     TEXT[],                 -- ['pool','garage','sea_view','lift']
  use_type              TEXT,                   -- 'primary_residence','investment','holiday','golden_visa'
  timeline              TEXT,                   -- 'immediate','3months','6months','1year'
  financing_type        TEXT,                   -- 'cash','mortgage','mixed'
  -- Seller profile (embedded)
  property_to_sell_id   UUID,                   -- Set after property record created
  asking_price          DECIMAL(12, 2),
  motivation_score      SMALLINT CHECK (motivation_score BETWEEN 1 AND 5),
  -- Engagement
  last_contact_at       TIMESTAMPTZ,
  next_followup_at      TIMESTAMPTZ,
  total_interactions    INT DEFAULT 0,
  opt_out_marketing     BOOLEAN NOT NULL DEFAULT FALSE,
  opt_out_whatsapp      BOOLEAN NOT NULL DEFAULT FALSE,
  gdpr_consent          BOOLEAN NOT NULL DEFAULT FALSE,
  gdpr_consent_at       TIMESTAMPTZ,
  -- Enrichment (Apollo, Clearbit)
  enriched_at           TIMESTAMPTZ,
  clearbit_data         JSONB,
  apollo_data           JSONB,
  linkedin_url          TEXT,
  company               TEXT,
  job_title             TEXT,
  -- Qualification
  qualified_at          TIMESTAMPTZ,
  qualification_notes   TEXT,
  -- AI fields (Claude Haiku for classification, Sonnet for deep analysis)
  ai_summary            TEXT,
  ai_suggested_action   TEXT,
  detected_intent       TEXT,                   -- 'buy_now','researching','investment_only'
  -- Metadata
  tags                  TEXT[],
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE contacts IS 'Master contact table: buyers, sellers, investors, referrers. Embedded buyer/seller profiles avoid JOINs for common use cases. Drives all n8n automation workflows.';

-- ---------------------------------------------------------------------------
-- TABLE: properties
-- Purpose: Agency Group managed listings — mandates, exclusives, off-market
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS properties (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Basic info
  title                 TEXT NOT NULL,
  description           TEXT,
  description_en        TEXT,
  description_fr        TEXT,
  -- Classification
  status                property_status NOT NULL DEFAULT 'active',
  type                  property_type NOT NULL,
  -- Pricing
  price                 DECIMAL(12, 2) NOT NULL,
  price_previous        DECIMAL(12, 2),
  price_reduced_at      TIMESTAMPTZ,
  price_per_sqm         DECIMAL(8, 2),          -- Maintained by trigger or app layer
  -- Location
  address               TEXT,
  street                TEXT,
  city                  TEXT,
  concelho              TEXT,                   -- Portuguese municipality
  distrito              TEXT,
  parish                TEXT,                   -- Freguesia
  postcode              TEXT,
  country               TEXT NOT NULL DEFAULT 'PT',
  latitude              DECIMAL(9, 6),
  longitude             DECIMAL(9, 6),
  zone                  TEXT,                   -- 'Chiado','Príncipe Real','Quinta da Marinha'
  -- Physical characteristics
  area_m2               DECIMAL(8, 2),
  area_plot_m2          DECIMAL(8, 2),
  area_terraco_m2       DECIMAL(8, 2),
  bedrooms              SMALLINT,
  bathrooms             SMALLINT,
  parking_spaces        SMALLINT DEFAULT 0,
  floor                 SMALLINT,
  total_floors          SMALLINT,
  year_built            SMALLINT,
  energy_certificate    TEXT,                   -- 'A+','A','B','B-','C','D','E','F','G'
  condition             TEXT,                   -- 'new','excellent','good','needs_renovation','ruin'
  -- Features & amenities
  features              TEXT[],                 -- ['pool','garage','lift','terrace','sea_view','fireplace']
  orientation           TEXT,                   -- 'south','east','west','north','southwest'
  furnished             BOOLEAN DEFAULT FALSE,
  -- Mandate & agency
  is_exclusive          BOOLEAN NOT NULL DEFAULT FALSE,
  mandate_signed_at     TIMESTAMPTZ,
  mandate_expires_at    TIMESTAMPTZ,
  owner_contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  assigned_consultant   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- Portal IDs (for deduplication with scraped data)
  idealista_id          TEXT,
  imovirtual_id         TEXT,
  casasapo_id           TEXT,
  olx_id                TEXT,
  -- Market intelligence
  avm_estimate          DECIMAL(12, 2),         -- Automated Valuation Model
  avm_confidence        DECIMAL(4, 3),          -- 0.000-1.000
  avm_updated_at        TIMESTAMPTZ,
  opportunity_score     SMALLINT DEFAULT 0 CHECK (opportunity_score BETWEEN 0 AND 100),
  -- Investment metrics
  investor_suitable     BOOLEAN NOT NULL DEFAULT FALSE,
  estimated_rental_yield DECIMAL(5, 2),
  estimated_cap_rate    DECIMAL(5, 2),
  estimated_irr         DECIMAL(5, 2),
  -- Media
  photos                TEXT[],                 -- Supabase Storage URLs
  virtual_tour_url      TEXT,
  floor_plan_url        TEXT,
  -- pgvector semantic embedding (1536-dim: compatible with OpenAI + Voyage AI)
  embedding             vector(1536),
  -- Metadata
  source                TEXT DEFAULT 'direct',  -- 'direct','idealista','imovirtual','referral'
  is_off_market         BOOLEAN NOT NULL DEFAULT FALSE,
  portal_published      BOOLEAN NOT NULL DEFAULT FALSE,
  portal_published_at   TIMESTAMPTZ,
  views_total           INT DEFAULT 0,
  inquiries_total       INT DEFAULT 0,
  visits_total          INT DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE properties IS 'Agency Group managed properties: exclusive mandates, co-exclusives, off-market. pgvector embedding (1536-dim) enables AI-powered semantic buyer matching via match_properties().';

-- ---------------------------------------------------------------------------
-- TABLE: market_properties
-- Purpose: Scraped competitor listings — AVM data source
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS market_properties (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source          TEXT NOT NULL,                -- 'idealista','imovirtual','casasapo','olx','remax'
  external_id     TEXT NOT NULL,
  source_url      TEXT,
  typologia       TEXT,
  area_m2         DECIMAL(8, 2),
  preco           DECIMAL(12, 2),
  preco_anterior  DECIMAL(12, 2),
  price_per_sqm   DECIMAL(8, 2),
  concelho        TEXT,
  zona            TEXT,
  latitude        DECIMAL(9, 6),
  longitude       DECIMAL(9, 6),
  bedrooms        SMALLINT,
  bathrooms       SMALLINT,
  floor           SMALLINT,
  condition       TEXT,
  features        TEXT[],
  photos          TEXT[],
  agencia         TEXT,
  days_on_market  INT,
  price_reductions SMALLINT DEFAULT 0,
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  raw_data        JSONB,
  UNIQUE(source, external_id)
);

COMMENT ON TABLE market_properties IS 'Scraped market listings (Idealista, Imovirtual, etc.) managed by FastAPI on Railway. Powers the AVM model and competitive intelligence.';

-- ---------------------------------------------------------------------------
-- TABLE: deals
-- Purpose: Full transaction pipeline from first contact to escritura
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS deals (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Reference
  title                 TEXT NOT NULL,
  reference             TEXT UNIQUE,            -- Auto-generated: AG-2026-0001
  -- Relationships
  contact_id            UUID NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  property_id           UUID REFERENCES properties(id) ON DELETE SET NULL,
  assigned_consultant   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- Deal classification
  type                  deal_type NOT NULL DEFAULT 'buy_side',
  stage                 deal_stage NOT NULL DEFAULT 'lead',
  probability           SMALLINT DEFAULT 5 CHECK (probability BETWEEN 0 AND 100),
  -- Financials (commission 5% — AMI 22506)
  deal_value            DECIMAL(12, 2),
  commission_rate       DECIMAL(5, 4) DEFAULT 0.05,
  gci_net               DECIMAL(10, 2),
  -- Key dates
  cpcv_date             DATE,
  escritura_date        DATE,
  expected_close_date   DATE,
  actual_close_date     DATE,
  -- CPCV details
  cpcv_deposit          DECIMAL(12, 2),
  cpcv_deposit_pct      DECIMAL(5, 2),
  notario_id            UUID REFERENCES contacts(id) ON DELETE SET NULL,
  advogado_id           UUID REFERENCES contacts(id) ON DELETE SET NULL,
  -- Negotiation
  initial_offer         DECIMAL(12, 2),
  accepted_offer        DECIMAL(12, 2),
  negotiation_notes     TEXT,
  -- Loss analysis
  lost_at               TIMESTAMPTZ,
  lost_reason           TEXT,                   -- 'price','competition','financing','changed_mind','timing'
  lost_to_agency        TEXT,
  -- Post-sale NPS
  nps_score             SMALLINT CHECK (nps_score BETWEEN 0 AND 10),
  nps_comment           TEXT,
  google_review_requested BOOLEAN DEFAULT FALSE,
  google_review_at      TIMESTAMPTZ,
  -- AI
  ai_deal_memo          TEXT,                   -- Claude Sonnet deal memo
  ai_risk_factors       JSONB,
  -- Metadata
  source                TEXT,
  tags                  TEXT[],
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE deals IS 'Deal pipeline: lead → qualification → visit → proposal → negotiation → CPCV → escritura → post-sale. Includes weighted GCI, loss analysis, NPS tracking. Commission: 5% (CPCV 50% + Escritura 50%).';

-- ---------------------------------------------------------------------------
-- TABLE: activities
-- Purpose: Append-only interaction log — calls, emails, WhatsApp, visits
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activities (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id      UUID REFERENCES contacts(id) ON DELETE CASCADE,
  deal_id         UUID REFERENCES deals(id) ON DELETE SET NULL,
  property_id     UUID REFERENCES properties(id) ON DELETE SET NULL,
  performed_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  type            activity_type NOT NULL,
  subject         TEXT,
  body            TEXT,
  duration_min    INT,
  outcome         TEXT,                         -- 'interested','not_interested','callback','voicemail'
  sentiment       TEXT,                         -- 'positive','neutral','negative'
  sentiment_score DECIMAL(4, 3),               -- -1.0 to +1.0
  ai_summary      TEXT,
  is_automated    BOOLEAN NOT NULL DEFAULT FALSE,
  automation_id   TEXT,                         -- n8n execution ID
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE activities IS 'Append-only activity log for all contact interactions. AI sentiment analysis via Claude Haiku. No updated_at — records are immutable.';

-- ---------------------------------------------------------------------------
-- TABLE: tasks
-- Purpose: To-do items — manual and automation-triggered
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id          UUID REFERENCES contacts(id) ON DELETE CASCADE,
  deal_id             UUID REFERENCES deals(id) ON DELETE CASCADE,
  property_id         UUID REFERENCES properties(id) ON DELETE SET NULL,
  assigned_to         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title               TEXT NOT NULL,
  description         TEXT,
  type                TEXT,                     -- 'call','email','visit','follow_up','document','review'
  status              task_status NOT NULL DEFAULT 'pending',
  priority            SMALLINT DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  due_at              TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  is_recurring        BOOLEAN NOT NULL DEFAULT FALSE,
  recurrence_rule     TEXT,                     -- RRULE: 'FREQ=WEEKLY;BYDAY=MO,WE'
  is_automated        BOOLEAN NOT NULL DEFAULT FALSE,
  automation_sequence TEXT,                     -- n8n sequence name
  tags                TEXT[],
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE tasks IS 'Task management for consultants. Auto-generated by n8n workflows: CPCV sequence (D+7/14/25/escritura-3), dormant reactivation, post-sale follow-up.';

-- ---------------------------------------------------------------------------
-- TABLE: investor_profiles
-- Purpose: Extended investor preferences for deal matching + deal memos
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS investor_profiles (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id          UUID NOT NULL UNIQUE REFERENCES contacts(id) ON DELETE CASCADE,
  segment             TEXT,                     -- 'family_office','nhr_golden_visa','flipper','developer','hnwi'
  deal_size_min       DECIMAL(12, 2),
  deal_size_max       DECIMAL(12, 2),
  preferred_zones     TEXT[],                   -- ['Lisboa','Cascais','Algarve','Porto']
  asset_classes       TEXT[],                   -- ['apartment','villa','commercial','development']
  yield_target_min    DECIMAL(5, 2),
  yield_target_max    DECIMAL(5, 2),
  irr_target          DECIMAL(5, 2),
  cap_rate_min        DECIMAL(5, 2),
  hold_period_years   SMALLINT,
  deal_flow_pref      TEXT[],                   -- ['off_market','below_avm','value_add','turnkey']
  exit_strategy       TEXT,                     -- 'rental_income','capital_gain','flip','mixed'
  financing_pref      TEXT,                     -- 'all_cash','leveraged','flexible'
  preferred_language  TEXT DEFAULT 'en',
  report_frequency    TEXT DEFAULT 'weekly',
  deals_completed     INT DEFAULT 0,
  total_invested      DECIMAL(14, 2) DEFAULT 0,
  last_deal_memo_at   TIMESTAMPTZ,
  alert_threshold     SMALLINT DEFAULT 70,      -- Notify when opportunity_score >= this
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE investor_profiles IS 'Extended investor preferences for deal matching. Linked 1:1 to contacts. Used by Workflow D (investor alerts) and the AI matching engine. Segments: Family Office, NHR/Golden Visa, Flipper.';

-- ---------------------------------------------------------------------------
-- TABLE: signals
-- Purpose: Off-market opportunity signals — DR parsing, market intelligence
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS signals (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type                  signal_type NOT NULL,
  status                signal_status NOT NULL DEFAULT 'new',
  priority              SMALLINT NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  probability_score     SMALLINT DEFAULT 0 CHECK (probability_score BETWEEN 0 AND 100),
  property_id           UUID REFERENCES properties(id) ON DELETE SET NULL,
  property_address      TEXT,
  property_zone         TEXT,
  estimated_value       DECIMAL(12, 2),
  owner_name            TEXT,
  owner_contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  signal_date           DATE NOT NULL DEFAULT CURRENT_DATE,
  source                TEXT,                   -- 'dre_parser','market_monitor','manual','network'
  source_url            TEXT,
  source_reference      TEXT,                   -- DR publication reference number
  raw_data              JSONB,
  recommended_action    TEXT,
  action_deadline       DATE,
  assigned_to           UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notified_agents       UUID[],
  acted_on              BOOLEAN NOT NULL DEFAULT FALSE,
  acted_on_at           TIMESTAMPTZ,
  converted_deal_id     UUID REFERENCES deals(id) ON DELETE SET NULL,
  ai_analysis           TEXT,                   -- Claude-generated opportunity analysis
  score_breakdown       JSONB,                  -- {type:35, recency:20, zone:15, value:10}
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE signals IS 'Off-market opportunity signals from Diário da República (insolvency/inheritance parsing), market monitoring, and agent network. Priority 1-5, probability 0-100.';

-- ---------------------------------------------------------------------------
-- TABLE: automations_log
-- Purpose: n8n workflow execution audit trail
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS automations_log (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_name     TEXT NOT NULL,              -- 'lead_enrichment','dormant_reactivation', etc.
  execution_id      TEXT,                       -- n8n execution ID
  trigger_type      TEXT,                       -- 'webhook','cron','manual','supabase_event'
  trigger_payload   JSONB,
  contact_id        UUID REFERENCES contacts(id) ON DELETE SET NULL,
  deal_id           UUID REFERENCES deals(id) ON DELETE SET NULL,
  property_id       UUID REFERENCES properties(id) ON DELETE SET NULL,
  status            TEXT NOT NULL DEFAULT 'running'
                      CHECK (status IN ('running','success','error','partial')),
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  duration_ms       INT,
  outcome           JSONB,                      -- {actions_taken:[...], messages_sent:2}
  error_message     TEXT,
  retry_count       SMALLINT DEFAULT 0,
  tokens_used       INT,
  estimated_cost_eur DECIMAL(8, 6),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE automations_log IS 'Audit log for all 6 n8n workflow executions. Enables debugging, cost analysis per workflow, and performance tracking.';

-- ---------------------------------------------------------------------------
-- TABLE: notifications
-- Purpose: Multi-channel notification queue
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES contacts(id) ON DELETE CASCADE,
  channel         notification_channel NOT NULL,
  subject         TEXT,
  body            TEXT NOT NULL,
  template_id     TEXT,
  template_vars   JSONB,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','sent','delivered','failed','bounced','opened')),
  sent_at         TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  opened_at       TIMESTAMPTZ,
  failed_at       TIMESTAMPTZ,
  failure_reason  TEXT,
  retry_count     SMALLINT DEFAULT 0,
  deal_id         UUID REFERENCES deals(id) ON DELETE SET NULL,
  property_id     UUID REFERENCES properties(id) ON DELETE SET NULL,
  signal_id       UUID REFERENCES signals(id) ON DELETE SET NULL,
  is_automated    BOOLEAN NOT NULL DEFAULT FALSE,
  automation_id   TEXT,
  external_id     TEXT,                         -- Resend/Twilio message ID
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE notifications IS 'Unified notification queue: email (Resend), WhatsApp (Meta Business API), push (VAPID), SMS (Twilio). Tracks delivery status with external provider IDs.';

-- ---------------------------------------------------------------------------
-- TABLE: market_snapshots
-- Purpose: Daily aggregated market metrics for BI and AVM training
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS market_snapshots (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  snapshot_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  concelho              TEXT NOT NULL,
  zone                  TEXT,
  typologia             TEXT,
  median_price_sqm      DECIMAL(8, 2),
  avg_price_sqm         DECIMAL(8, 2),
  median_total_price    DECIMAL(12, 2),
  active_listings       INT,
  new_listings_7d       INT,
  sold_last_30d         INT,
  avg_days_on_market    DECIMAL(6, 1),
  price_change_pct_30d  DECIMAL(6, 3),
  price_change_pct_yoy  DECIMAL(6, 3),
  avg_discount_pct      DECIMAL(5, 2),
  supply_demand_ratio   DECIMAL(5, 2),
  hot_score             SMALLINT,               -- 0-100 zone hotness
  source                TEXT DEFAULT 'aggregated',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(snapshot_date, concelho, zone, typologia)
);

COMMENT ON TABLE market_snapshots IS 'Daily market metrics by zone/typology. Generated by Workflow B (Daily Market Intelligence). Feeds Metabase BI and XGBoost AVM model training data.';

-- ---------------------------------------------------------------------------
-- TABLE: visits
-- Purpose: Property visit scheduling and buyer feedback (Workflow 3)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS visits (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id           UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  contact_id            UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  deal_id               UUID REFERENCES deals(id) ON DELETE SET NULL,
  consultant_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  scheduled_at          TIMESTAMPTZ NOT NULL,
  duration_min          INT DEFAULT 60,
  location_notes        TEXT,
  status                TEXT NOT NULL DEFAULT 'scheduled'
                          CHECK (status IN ('scheduled','confirmed','completed','cancelled','no_show')),
  confirmed_at          TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,
  cancellation_reason   TEXT,
  -- Post-visit feedback (1=adorei→70% prob, 2=interessante→45%, 3=não era→20%)
  feedback_score        SMALLINT CHECK (feedback_score BETWEEN 1 AND 5),
  feedback_comment      TEXT,
  feedback_received_at  TIMESTAMPTZ,
  probability_before    SMALLINT,
  probability_after     SMALLINT,
  -- Notification tracking
  confirmation_sent     BOOLEAN DEFAULT FALSE,
  reminder_24h_sent     BOOLEAN DEFAULT FALSE,
  reminder_2h_sent      BOOLEAN DEFAULT FALSE,
  feedback_requested    BOOLEAN DEFAULT FALSE,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE visits IS 'Property visit scheduling and feedback. Drives Workflow 3: confirmation → T-24h reminder → T-2h reminder → T+2h feedback → T+24h vendor report.';

-- ---------------------------------------------------------------------------
-- TABLE: vendor_reports
-- Purpose: Weekly automated reports to property owners (Workflow 5)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vendor_reports (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id           UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_contact_id      UUID NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  period_start          DATE NOT NULL,
  period_end            DATE NOT NULL,
  portal_views          INT DEFAULT 0,
  unique_visitors       INT DEFAULT 0,
  inquiries_received    INT DEFAULT 0,
  visits_conducted      INT DEFAULT 0,
  visit_feedback_avg    DECIMAL(3, 2),
  comparable_listings   INT,
  comparable_avg_price  DECIMAL(12, 2),
  comparable_avg_dom    INT,
  current_price         DECIMAL(12, 2),
  avm_estimate          DECIMAL(12, 2),
  price_recommendation  TEXT,                   -- 'maintain','reduce_5','reduce_10','increase_3'
  narrative_language    TEXT DEFAULT 'pt',      -- Owner's preferred language
  narrative             TEXT,                   -- ~300 words, Claude Sonnet
  sent_at               TIMESTAMPTZ,
  email_status          TEXT,
  wa_status             TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE vendor_reports IS 'Weekly automated vendor reports. Narrative generated by Claude Sonnet in owner language. Price recommendation: maintain/reduce_5/reduce_10/increase_3.';

-- ---------------------------------------------------------------------------
-- TABLE: email_sequences
-- Purpose: Drip campaign definitions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_sequences (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL UNIQUE,
  description     TEXT,
  trigger_event   TEXT NOT NULL,               -- 'new_lead','dormant_14d','post_cpcv','post_escritura'
  target_segment  TEXT,                        -- 'buyer_cold','investor','seller'
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  steps           JSONB NOT NULL DEFAULT '[]', -- [{day:0,channel:'email',template:'welcome'}, ...]
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE email_sequences IS 'Drip campaign sequence definitions. Each step defines day offset, channel, and template. Used by n8n Workflow 2 (dormant reactivation) and Workflow 4 (post-CPCV).';

-- ---------------------------------------------------------------------------
-- TABLE: contact_sequences
-- Purpose: Contact enrollment and progress tracking in drip campaigns
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contact_sequences (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id          UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  sequence_id         UUID NOT NULL REFERENCES email_sequences(id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','paused','completed','unsubscribed')),
  current_step        INT NOT NULL DEFAULT 0,
  next_step_at        TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  enrolled_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  enrolled_by         TEXT,                    -- 'n8n_workflow_1','manual','api'
  emails_sent         INT DEFAULT 0,
  emails_opened       INT DEFAULT 0,
  emails_clicked      INT DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(contact_id, sequence_id)
);

COMMENT ON TABLE contact_sequences IS 'Tracks contact enrollment and step progress through drip campaigns. Unique constraint prevents duplicate enrollment.';

-- ---------------------------------------------------------------------------
-- TABLE: referral_network
-- Purpose: Referral partner gamification — tiers, commissions, benefits
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referral_network (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id              UUID NOT NULL UNIQUE REFERENCES contacts(id) ON DELETE CASCADE,
  tier                    referral_tier NOT NULL DEFAULT 'bronze',
  total_referrals         INT NOT NULL DEFAULT 0,
  successful_deals        INT NOT NULL DEFAULT 0,
  total_commission_earned DECIMAL(10, 2) NOT NULL DEFAULT 0,
  -- Bronze +0%, Silver +0.1%, Gold +0.2%, Platinum +0.25% on top of standard 5%
  commission_bonus_pct    DECIMAL(5, 4) NOT NULL DEFAULT 0,
  -- Benefits unlocked per tier
  has_newsletter          BOOLEAN DEFAULT TRUE,
  has_market_reports      BOOLEAN DEFAULT FALSE,   -- Silver+
  has_vip_events          BOOLEAN DEFAULT FALSE,   -- Gold+
  has_off_market_access   BOOLEAN DEFAULT FALSE,   -- Gold+
  has_dedicated_account   BOOLEAN DEFAULT FALSE,   -- Platinum only
  last_referral_at        TIMESTAMPTZ,
  next_tier_referrals     INT,                     -- Needed to reach next tier
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE referral_network IS 'Referral partner gamification: Bronze(0-2)→Silver(3-5)→Gold(6-10)→Platinum(11+). Commission bonuses and benefits auto-update via trigger.';

-- =============================================================================
-- PERFORMANCE INDEXES
-- =============================================================================

-- contacts (most queried table)
CREATE INDEX IF NOT EXISTS idx_contacts_status        ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_lead_tier     ON contacts(lead_tier);
CREATE INDEX IF NOT EXISTS idx_contacts_lead_score    ON contacts(lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_assigned_to   ON contacts(assigned_to);
CREATE INDEX IF NOT EXISTS idx_contacts_nationality   ON contacts(nationality);
CREATE INDEX IF NOT EXISTS idx_contacts_source        ON contacts(source);
CREATE INDEX IF NOT EXISTS idx_contacts_last_contact  ON contacts(last_contact_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_contacts_next_followup ON contacts(next_followup_at ASC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_contacts_budget        ON contacts(budget_min, budget_max);
CREATE INDEX IF NOT EXISTS idx_contacts_email         ON contacts(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_phone         ON contacts(phone) WHERE phone IS NOT NULL;
-- Full-text trigram search on names
CREATE INDEX IF NOT EXISTS idx_contacts_name_trgm     ON contacts USING gin(full_name gin_trgm_ops);

-- properties (search-heavy)
CREATE INDEX IF NOT EXISTS idx_properties_status      ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_type        ON properties(type);
CREATE INDEX IF NOT EXISTS idx_properties_price       ON properties(price);
CREATE INDEX IF NOT EXISTS idx_properties_concelho    ON properties(concelho);
CREATE INDEX IF NOT EXISTS idx_properties_zone        ON properties(zone);
CREATE INDEX IF NOT EXISTS idx_properties_bedrooms    ON properties(bedrooms);
CREATE INDEX IF NOT EXISTS idx_properties_opportunity ON properties(opportunity_score DESC);
CREATE INDEX IF NOT EXISTS idx_properties_investor    ON properties(investor_suitable)
  WHERE investor_suitable = TRUE;
CREATE INDEX IF NOT EXISTS idx_properties_off_market  ON properties(is_off_market)
  WHERE is_off_market = TRUE;
CREATE INDEX IF NOT EXISTS idx_properties_consultant  ON properties(assigned_consultant);
CREATE INDEX IF NOT EXISTS idx_properties_features    ON properties USING gin(features);
-- pgvector HNSW index — fast approximate nearest-neighbour (cosine distance)
CREATE INDEX IF NOT EXISTS idx_properties_embedding   ON properties
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_properties_title_trgm  ON properties USING gin(title gin_trgm_ops);

-- market_properties
CREATE INDEX IF NOT EXISTS idx_market_props_source    ON market_properties(source);
CREATE INDEX IF NOT EXISTS idx_market_props_concelho  ON market_properties(concelho);
CREATE INDEX IF NOT EXISTS idx_market_props_price     ON market_properties(preco);
CREATE INDEX IF NOT EXISTS idx_market_props_active    ON market_properties(is_active)
  WHERE is_active = TRUE;

-- deals
CREATE INDEX IF NOT EXISTS idx_deals_stage            ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_contact          ON deals(contact_id);
CREATE INDEX IF NOT EXISTS idx_deals_property         ON deals(property_id);
CREATE INDEX IF NOT EXISTS idx_deals_consultant       ON deals(assigned_consultant);
CREATE INDEX IF NOT EXISTS idx_deals_close_date       ON deals(expected_close_date ASC NULLS LAST);

-- activities
CREATE INDEX IF NOT EXISTS idx_activities_contact     ON activities(contact_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_deal        ON activities(deal_id);
CREATE INDEX IF NOT EXISTS idx_activities_type        ON activities(type);
CREATE INDEX IF NOT EXISTS idx_activities_occurred    ON activities(occurred_at DESC);

-- tasks
CREATE INDEX IF NOT EXISTS idx_tasks_assigned         ON tasks(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_tasks_due              ON tasks(due_at ASC NULLS LAST)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_tasks_contact          ON tasks(contact_id);

-- signals
CREATE INDEX IF NOT EXISTS idx_signals_type           ON signals(type);
CREATE INDEX IF NOT EXISTS idx_signals_status         ON signals(status);
CREATE INDEX IF NOT EXISTS idx_signals_priority       ON signals(priority DESC, probability_score DESC);
CREATE INDEX IF NOT EXISTS idx_signals_date           ON signals(signal_date DESC);
CREATE INDEX IF NOT EXISTS idx_signals_zone           ON signals(property_zone);

-- notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user     ON notifications(user_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_pending  ON notifications(status)
  WHERE status = 'pending';

-- automations_log
CREATE INDEX IF NOT EXISTS idx_automations_workflow   ON automations_log(workflow_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_automations_status     ON automations_log(status);
CREATE INDEX IF NOT EXISTS idx_automations_contact    ON automations_log(contact_id);

-- market_snapshots
CREATE INDEX IF NOT EXISTS idx_snapshots_date         ON market_snapshots(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_concelho     ON market_snapshots(concelho, snapshot_date DESC);

-- visits
CREATE INDEX IF NOT EXISTS idx_visits_property        ON visits(property_id);
CREATE INDEX IF NOT EXISTS idx_visits_contact         ON visits(contact_id);
CREATE INDEX IF NOT EXISTS idx_visits_scheduled       ON visits(scheduled_at ASC)
  WHERE status = 'scheduled';

-- vendor_reports
CREATE INDEX IF NOT EXISTS idx_vendor_reports_prop    ON vendor_reports(property_id, period_end DESC);

-- referral_network
CREATE INDEX IF NOT EXISTS idx_referral_tier          ON referral_network(tier);

-- =============================================================================
-- TRIGGER FUNCTION: auto-update updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Apply to all tables that have updated_at
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles', 'contacts', 'properties', 'deals',
    'tasks', 'investor_profiles', 'signals', 'notifications',
    'vendor_reports', 'email_sequences', 'contact_sequences',
    'referral_network', 'visits'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I;
       CREATE TRIGGER trg_%s_updated_at
       BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION update_updated_at();',
      t, t, t, t
    );
  END LOOP;
END;
$$;

-- =============================================================================
-- TRIGGER: auto-update contact last_contact_at from activities
-- =============================================================================

CREATE OR REPLACE FUNCTION update_contact_last_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.contact_id IS NOT NULL THEN
    UPDATE contacts
    SET
      last_contact_at    = GREATEST(last_contact_at, NEW.occurred_at),
      total_interactions = total_interactions + 1
    WHERE id = NEW.contact_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_update_contact ON activities;
CREATE TRIGGER trg_activity_update_contact
AFTER INSERT ON activities
FOR EACH ROW EXECUTE FUNCTION update_contact_last_activity();

-- =============================================================================
-- TRIGGER: auto-generate deal reference (AG-2026-0001)
-- =============================================================================

CREATE SEQUENCE IF NOT EXISTS deal_reference_seq START WITH 1;

CREATE OR REPLACE FUNCTION generate_deal_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.reference IS NULL THEN
    NEW.reference := 'AG-' || EXTRACT(YEAR FROM NOW())::TEXT
                     || '-' || LPAD(nextval('deal_reference_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deals_reference ON deals;
CREATE TRIGGER trg_deals_reference
BEFORE INSERT ON deals
FOR EACH ROW EXECUTE FUNCTION generate_deal_reference();

-- =============================================================================
-- TRIGGER: auto-update referral tier on referral_network
-- =============================================================================

CREATE OR REPLACE FUNCTION update_referral_tier()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.tier := CASE
    WHEN NEW.total_referrals >= 11 THEN 'platinum'::referral_tier
    WHEN NEW.total_referrals >= 6  THEN 'gold'::referral_tier
    WHEN NEW.total_referrals >= 3  THEN 'silver'::referral_tier
    ELSE                                'bronze'::referral_tier
  END;
  NEW.commission_bonus_pct := CASE NEW.tier
    WHEN 'platinum' THEN 0.0025
    WHEN 'gold'     THEN 0.0020
    WHEN 'silver'   THEN 0.0010
    ELSE                 0.0000
  END;
  NEW.has_market_reports    := NEW.tier IN ('silver', 'gold', 'platinum');
  NEW.has_vip_events        := NEW.tier IN ('gold', 'platinum');
  NEW.has_off_market_access := NEW.tier IN ('gold', 'platinum');
  NEW.has_dedicated_account := NEW.tier = 'platinum';
  NEW.next_tier_referrals   := CASE
    WHEN NEW.total_referrals < 3  THEN 3  - NEW.total_referrals
    WHEN NEW.total_referrals < 6  THEN 6  - NEW.total_referrals
    WHEN NEW.total_referrals < 11 THEN 11 - NEW.total_referrals
    ELSE NULL
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_referral_tier ON referral_network;
CREATE TRIGGER trg_referral_tier
BEFORE INSERT OR UPDATE OF total_referrals ON referral_network
FOR EACH ROW EXECUTE FUNCTION update_referral_tier();

-- =============================================================================
-- FUNCTION: match_properties — pgvector semantic property search
-- Used by: AI matching engine, investor alerts (Workflow D), buyer recommendations
-- =============================================================================

CREATE OR REPLACE FUNCTION match_properties(
  query_embedding    vector(1536),
  match_threshold    FLOAT            DEFAULT 0.75,
  match_count        INT              DEFAULT 10,
  budget_min         DECIMAL          DEFAULT NULL,
  budget_max         DECIMAL          DEFAULT NULL,
  zonas              TEXT[]           DEFAULT NULL,
  property_types     TEXT[]           DEFAULT NULL,
  bedrooms_min_arg   INT              DEFAULT NULL,
  status_filter      property_status  DEFAULT 'active'
)
RETURNS TABLE (
  id                    UUID,
  title                 TEXT,
  price                 DECIMAL,
  area_m2               DECIMAL,
  type                  property_type,
  bedrooms              SMALLINT,
  concelho              TEXT,
  zone                  TEXT,
  features              TEXT[],
  opportunity_score     SMALLINT,
  investor_suitable     BOOLEAN,
  estimated_rental_yield DECIMAL,
  similarity            FLOAT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.title,
    p.price,
    p.area_m2,
    p.type,
    p.bedrooms,
    p.concelho,
    p.zone,
    p.features,
    p.opportunity_score,
    p.investor_suitable,
    p.estimated_rental_yield,
    (1 - (p.embedding <=> query_embedding))::FLOAT AS similarity
  FROM properties p
  WHERE
    p.status = status_filter
    AND p.embedding IS NOT NULL
    AND (1 - (p.embedding <=> query_embedding)) >= match_threshold
    AND (budget_min      IS NULL OR p.price    >= budget_min)
    AND (budget_max      IS NULL OR p.price    <= budget_max)
    AND (zonas           IS NULL OR p.concelho = ANY(zonas) OR p.zone = ANY(zonas))
    AND (property_types  IS NULL OR p.type::TEXT = ANY(property_types))
    AND (bedrooms_min_arg IS NULL OR p.bedrooms >= bedrooms_min_arg)
  ORDER BY p.embedding <=> query_embedding ASC  -- cosine distance ascending = most similar first
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION match_properties IS
  'Semantic property search via pgvector cosine distance. '
  'Threshold 0.75 default (adjust per use case). '
  'Supports budget/zone/type/bedroom filters. '
  'Used by buyer matching engine and Workflow D (investor alerts).';

-- =============================================================================
-- FUNCTION: get_pipeline_summary — deal pipeline KPIs for dashboard
-- =============================================================================

CREATE OR REPLACE FUNCTION get_pipeline_summary(p_consultant_id UUID DEFAULT NULL)
RETURNS TABLE (
  stage           deal_stage,
  deal_count      BIGINT,
  total_value     DECIMAL,
  weighted_gci    DECIMAL,
  avg_probability DECIMAL
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    d.stage,
    COUNT(*)::BIGINT,
    COALESCE(SUM(d.deal_value), 0),
    COALESCE(SUM(d.deal_value * d.commission_rate * d.probability / 100.0), 0),
    ROUND(AVG(d.probability)::NUMERIC, 1)
  FROM deals d
  WHERE
    d.actual_close_date IS NULL
    AND d.lost_at IS NULL
    AND (p_consultant_id IS NULL OR d.assigned_consultant = p_consultant_id)
  GROUP BY d.stage
  ORDER BY
    CASE d.stage
      WHEN 'lead'            THEN 1
      WHEN 'qualification'   THEN 2
      WHEN 'visit_scheduled' THEN 3
      WHEN 'visit_done'      THEN 4
      WHEN 'proposal'        THEN 5
      WHEN 'negotiation'     THEN 6
      WHEN 'cpcv'            THEN 7
      WHEN 'escritura'       THEN 8
      ELSE 99
    END;
$$;

COMMENT ON FUNCTION get_pipeline_summary IS 'Aggregated pipeline metrics per stage. Pass consultant_id for individual view, NULL for full team view.';

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties        ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals             ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals           ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits            ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_reports    ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_network  ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE automations_log   ENABLE ROW LEVEL SECURITY;

-- Helper: is current user an admin or manager?
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'manager')
  );
$$;

-- profiles: own profile + admins see all
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (id = auth.uid() OR is_admin());
CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (id = auth.uid() OR is_admin());

-- contacts: own assigned + unassigned visible; admins see all
CREATE POLICY "contacts_select" ON contacts
  FOR SELECT USING (is_admin() OR assigned_to = auth.uid() OR assigned_to IS NULL);
CREATE POLICY "contacts_insert" ON contacts
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "contacts_update" ON contacts
  FOR UPDATE USING (is_admin() OR assigned_to = auth.uid() OR assigned_to IS NULL);
CREATE POLICY "contacts_delete" ON contacts
  FOR DELETE USING (is_admin());

-- properties: all active visible; own + admins can write
CREATE POLICY "properties_select" ON properties
  FOR SELECT USING (is_admin() OR assigned_consultant = auth.uid() OR status = 'active');
CREATE POLICY "properties_insert" ON properties
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "properties_update" ON properties
  FOR UPDATE USING (is_admin() OR assigned_consultant = auth.uid());
CREATE POLICY "properties_delete" ON properties
  FOR DELETE USING (is_admin());

-- deals: own deals + admins
CREATE POLICY "deals_select" ON deals
  FOR SELECT USING (is_admin() OR assigned_consultant = auth.uid());
CREATE POLICY "deals_insert" ON deals
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "deals_update" ON deals
  FOR UPDATE USING (is_admin() OR assigned_consultant = auth.uid());
CREATE POLICY "deals_delete" ON deals
  FOR DELETE USING (is_admin());

-- activities: append-only; read own contact activities
CREATE POLICY "activities_select" ON activities
  FOR SELECT USING (
    is_admin()
    OR performed_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = activities.contact_id
      AND (c.assigned_to = auth.uid() OR c.assigned_to IS NULL)
    )
  );
CREATE POLICY "activities_insert" ON activities
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "activities_delete" ON activities
  FOR DELETE USING (is_admin());

-- tasks: own tasks
CREATE POLICY "tasks_select" ON tasks
  FOR SELECT USING (is_admin() OR assigned_to = auth.uid() OR created_by = auth.uid());
CREATE POLICY "tasks_insert" ON tasks
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "tasks_update" ON tasks
  FOR UPDATE USING (is_admin() OR assigned_to = auth.uid());
CREATE POLICY "tasks_delete" ON tasks
  FOR DELETE USING (is_admin() OR created_by = auth.uid());

-- signals: all authenticated agents can read; assigned agent can update
CREATE POLICY "signals_select" ON signals
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "signals_insert" ON signals
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "signals_update" ON signals
  FOR UPDATE USING (is_admin() OR assigned_to = auth.uid());

-- notifications: own only
CREATE POLICY "notifications_select" ON notifications
  FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE USING (user_id = auth.uid() OR is_admin());

-- investor_profiles: via contact ownership
CREATE POLICY "investor_profiles_select" ON investor_profiles
  FOR SELECT USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = investor_profiles.contact_id
      AND (c.assigned_to = auth.uid() OR c.assigned_to IS NULL)
    )
  );
CREATE POLICY "investor_profiles_insert" ON investor_profiles
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "investor_profiles_update" ON investor_profiles
  FOR UPDATE USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = investor_profiles.contact_id AND c.assigned_to = auth.uid()
    )
  );

-- visits
CREATE POLICY "visits_select" ON visits
  FOR SELECT USING (
    is_admin() OR consultant_id = auth.uid()
    OR EXISTS (SELECT 1 FROM contacts c WHERE c.id = visits.contact_id AND c.assigned_to = auth.uid())
  );
CREATE POLICY "visits_insert" ON visits FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "visits_update" ON visits FOR UPDATE USING (is_admin() OR consultant_id = auth.uid());

-- vendor_reports: all agents can read; admins manage
CREATE POLICY "vendor_reports_select" ON vendor_reports FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "vendor_reports_insert" ON vendor_reports FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "vendor_reports_update" ON vendor_reports FOR UPDATE USING (is_admin());

-- referral_network: all agents can read; admins manage
CREATE POLICY "referral_select" ON referral_network FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "referral_insert" ON referral_network FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "referral_update" ON referral_network FOR UPDATE USING (is_admin());

-- contact_sequences: all agents
CREATE POLICY "contact_sequences_select" ON contact_sequences FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "contact_sequences_insert" ON contact_sequences FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "contact_sequences_update" ON contact_sequences FOR UPDATE USING (auth.uid() IS NOT NULL);

-- automations_log: admins read; service role inserts (TRUE = allow n8n service key)
CREATE POLICY "automations_log_select" ON automations_log FOR SELECT USING (is_admin());
CREATE POLICY "automations_log_insert" ON automations_log FOR INSERT WITH CHECK (TRUE);

-- =============================================================================
-- SEED DATA: Market data by zone (€/m² mediana 2026)
-- =============================================================================

CREATE TABLE IF NOT EXISTS market_data (
  zona         TEXT PRIMARY KEY,
  preco_m2     DECIMAL(10, 2),
  yield_bruto  DECIMAL(5, 2),
  yoy_percent  DECIMAL(5, 2),
  dias_mercado INT,
  cached_at    TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE market_data IS 'Zone price benchmarks updated by market scraper. Source: Idealista, INE, market_snapshots aggregation.';

INSERT INTO market_data (zona, preco_m2, yield_bruto, yoy_percent, dias_mercado) VALUES
  ('Lisboa',                5000, 4.5, 18.0, 45),
  ('Lisboa — Chiado',       7000, 4.3, 20.0, 38),
  ('Lisboa — Príncipe Real',7400, 4.2, 19.0, 40),
  ('Lisboa — Belém',        5200, 4.4, 17.0, 50),
  ('Lisboa — Parque Nações',4800, 4.6, 16.0, 52),
  ('Cascais',               4713, 4.6, 15.5, 55),
  ('Cascais — Quinta Marinha',6500,4.1,14.0, 65),
  ('Sintra',                3200, 4.9, 13.0, 65),
  ('Porto',                 3643, 5.2, 14.0, 60),
  ('Porto — Foz',           4800, 4.8, 15.0, 48),
  ('Porto — Bonfim',        3200, 5.5, 16.0, 55),
  ('Algarve',               3941, 5.5, 12.0, 90),
  ('Algarve — Vilamoura',   5500, 4.8, 11.5, 85),
  ('Algarve — Lagos',       4200, 5.2, 12.5, 88),
  ('Comporta',              8500, 4.1, 12.0, 120),
  ('Ericeira',              3500, 5.1, 14.5, 70),
  ('Madeira',               3760, 5.0, 11.0, 75),
  ('Açores',                1952, 5.8, 10.0, 95)
ON CONFLICT (zona) DO UPDATE SET
  preco_m2    = EXCLUDED.preco_m2,
  yield_bruto = EXCLUDED.yield_bruto,
  yoy_percent = EXCLUDED.yoy_percent,
  dias_mercado= EXCLUDED.dias_mercado,
  cached_at   = NOW();

-- =============================================================================
-- END OF MIGRATION 001 — Agency Group v2.0
-- =============================================================================
