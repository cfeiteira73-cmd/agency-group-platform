-- =============================================================================
-- MIGRATION 042 — Missing tables: visitas, push_tokens, push_subscriptions,
--                 users (2FA), offmarket_risk_flags, + contacts buyer columns
-- Safe: all CREATE TABLE IF NOT EXISTS + ALTER TABLE ADD COLUMN IF NOT EXISTS
-- =============================================================================

-- 1. VISITAS (property visits — portal scheduling)
-- Different from 'visits': stores property_name/contact_name as strings (denormalized),
-- has date/time split columns, visit_type, ai_suggestion
CREATE TABLE IF NOT EXISTS public.visitas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     INT  REFERENCES public.properties(id) ON DELETE SET NULL,
  property_name   TEXT,
  contact_id      INT  REFERENCES public.contacts(id)   ON DELETE SET NULL,
  contact_name    TEXT,
  date            DATE NOT NULL,
  time            TEXT,
  status          TEXT NOT NULL DEFAULT 'agendada'
                  CHECK (status IN ('agendada','realizada','cancelada','reagendada')),
  notes           TEXT,
  interest_score  INT  CHECK (interest_score IS NULL OR (interest_score >= 1 AND interest_score <= 5)),
  feedback        TEXT,
  ai_suggestion   TEXT,
  visit_type      TEXT NOT NULL DEFAULT 'presencial'
                  CHECK (visit_type IN ('presencial','virtual','videochamada')),
  agent_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.visitas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agents can manage visitas" ON public.visitas FOR ALL USING (true);
CREATE INDEX IF NOT EXISTS idx_visitas_agent_id    ON public.visitas(agent_id);
CREATE INDEX IF NOT EXISTS idx_visitas_date        ON public.visitas(date);
CREATE INDEX IF NOT EXISTS idx_visitas_contact_id  ON public.visitas(contact_id);
CREATE INDEX IF NOT EXISTS idx_visitas_property_id ON public.visitas(property_id);

-- 2. PUSH_TOKENS (PWA web push subscriptions)
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID    REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    TEXT    NOT NULL UNIQUE,
  p256dh      TEXT    NOT NULL,
  auth        TEXT    NOT NULL,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own tokens" ON public.push_tokens FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON public.push_tokens(user_id);

-- 3. PUSH_SUBSCRIPTIONS (used by user/delete-account cleanup)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    TEXT    NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own subscriptions" ON public.push_subscriptions FOR ALL USING (auth.uid() = user_id);

-- 4. USERS (2FA + password reset — custom auth layer)
-- Distinct from auth.users — stores TOTP secrets and 2FA state
CREATE TABLE IF NOT EXISTS public.users (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT    NOT NULL UNIQUE,
  phone           TEXT,
  totp_secret     TEXT,       -- Encrypted TOTP secret (base32)
  two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  reset_token     TEXT,       -- Password reset token (SHA-256 hashed)
  reset_token_expires TIMESTAMPTZ,
  onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
-- Only service role can access users table (2FA routes use supabaseAdmin equivalent)
CREATE POLICY "Service role only" ON public.users FOR ALL USING (false);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- 5. OFFMARKET_RISK_FLAGS
CREATE TABLE IF NOT EXISTS public.offmarket_risk_flags (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID    REFERENCES public.offmarket_leads(id) ON DELETE CASCADE,
  flag_type   TEXT    NOT NULL,
  severity    TEXT    NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  description TEXT,
  created_by  UUID    REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved    BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.offmarket_risk_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agents can manage risk flags" ON public.offmarket_risk_flags FOR ALL USING (true);
CREATE INDEX IF NOT EXISTS idx_risk_flags_lead_id ON public.offmarket_risk_flags(lead_id);

-- 6. CONTACTS — buyer intelligence columns (safe, migrations 006+007 may not have run)
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS buyer_score          SMALLINT CHECK (buyer_score IS NULL OR (buyer_score >= 0 AND buyer_score <= 100));
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS buyer_type           TEXT     CHECK (buyer_type IN ('individual','family_office','developer','fund','operator','investor','unknown'));
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS liquidity_profile    TEXT     CHECK (liquidity_profile IN ('immediate','under_30_days','financed','unknown'));
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS proof_of_funds_status TEXT    CHECK (proof_of_funds_status IN ('verified','partial','unknown'));
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS ticket_preference    TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS target_strategy      TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS deals_closed_count   INT      DEFAULT 0;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS avg_close_days       INT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS negotiation_style    TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS reliability_score    SMALLINT CHECK (reliability_score IS NULL OR (reliability_score >= 0 AND reliability_score <= 100));
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS response_rate        SMALLINT CHECK (response_rate IS NULL OR (response_rate >= 0 AND response_rate <= 100));
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS active_status        TEXT     DEFAULT 'active';
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS buyer_readiness_score SMALLINT CHECK (buyer_readiness_score IS NULL OR (buyer_readiness_score >= 0 AND buyer_readiness_score <= 100));
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS buyer_ready_for_deal BOOLEAN  DEFAULT FALSE;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS preferred_asset_types TEXT[]  DEFAULT '{}';
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS buyer_scored_at      TIMESTAMPTZ;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS buyer_tier           TEXT     CHECK (buyer_tier IN ('A','B','C','D'));

-- 7. INVESTMENT_ALERTS (used by n8n workflow-d-investor-alert)
CREATE TABLE IF NOT EXISTS public.investment_alerts (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id      INT     REFERENCES public.contacts(id) ON DELETE CASCADE,
  deal_id         UUID    REFERENCES public.deals(id)    ON DELETE SET NULL,
  property_id     INT     REFERENCES public.properties(id) ON DELETE SET NULL,
  alert_type      TEXT    NOT NULL CHECK (alert_type IN ('price_drop','new_match','deal_stage','market_signal','score_high')),
  title           TEXT    NOT NULL,
  message         TEXT    NOT NULL,
  sent_at         TIMESTAMPTZ,
  sent_via        TEXT    CHECK (sent_via IN ('email','whatsapp','sms','push')),
  status          TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','cancelled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.investment_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agents can manage investment alerts" ON public.investment_alerts FOR ALL USING (true);
CREATE INDEX IF NOT EXISTS idx_investment_alerts_contact_id ON public.investment_alerts(contact_id);
CREATE INDEX IF NOT EXISTS idx_investment_alerts_status     ON public.investment_alerts(status);

-- VERIFY:
-- SELECT table_name FROM information_schema.tables WHERE table_schema='public'
--   AND table_name IN ('visitas','push_tokens','push_subscriptions','users','offmarket_risk_flags','investment_alerts');
-- Should return 6 rows.
-- SELECT column_name FROM information_schema.columns WHERE table_name='contacts' AND column_name='buyer_score';
-- Should return 1 row.
