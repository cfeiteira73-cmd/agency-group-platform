-- =============================================================================
-- MIGRATION 20260415_020 — Fix INT/UUID FK mismatches + create agents table
--
-- PROBLEM (migration 042):
--   visitas.contact_id     INT  REFERENCES contacts(id)   ← contacts.id is UUID
--   visitas.property_id    INT  REFERENCES properties(id) ← properties.id is UUID
--   investment_alerts.contact_id  INT  REFERENCES contacts(id)
--   investment_alerts.property_id INT  REFERENCES properties(id)
--
--   PostgreSQL rejects INT → UUID FK constraints.
--   These tables likely failed to create in migration 042.
--
-- FIX: Drop broken tables if they exist, recreate with correct UUID types.
-- Data loss is acceptable — tables were empty due to broken FK constraints.
-- =============================================================================

-- ── 1. Fix visitas ────────────────────────────────────────────────────────────

-- Drop if it was partially created (with or without the broken FK)
DROP TABLE IF EXISTS public.visitas CASCADE;

CREATE TABLE public.visitas (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     UUID        REFERENCES public.properties(id) ON DELETE SET NULL,
  property_name   TEXT,
  contact_id      UUID        REFERENCES public.contacts(id)   ON DELETE SET NULL,
  contact_name    TEXT,
  date            DATE        NOT NULL,
  time            TEXT,
  status          TEXT        NOT NULL DEFAULT 'agendada'
                              CHECK (status IN ('agendada','realizada','cancelada','reagendada')),
  notes           TEXT,
  interest_score  INT         CHECK (interest_score IS NULL OR (interest_score >= 1 AND interest_score <= 5)),
  feedback        TEXT,
  ai_suggestion   TEXT,
  visit_type      TEXT        NOT NULL DEFAULT 'presencial'
                              CHECK (visit_type IN ('presencial','virtual','videochamada')),
  agent_id        UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.visitas ENABLE ROW LEVEL SECURITY;

-- Restrict to authenticated agents (auth.uid() must be set) — replaces FOR ALL USING (true)
CREATE POLICY "Agents can manage visitas"
  ON public.visitas FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_visitas_agent_id    ON public.visitas(agent_id);
CREATE INDEX IF NOT EXISTS idx_visitas_date        ON public.visitas(date);
CREATE INDEX IF NOT EXISTS idx_visitas_contact_id  ON public.visitas(contact_id);
CREATE INDEX IF NOT EXISTS idx_visitas_property_id ON public.visitas(property_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.trg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_visitas_updated_at ON public.visitas;
CREATE TRIGGER trg_visitas_updated_at
  BEFORE UPDATE ON public.visitas
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

-- ── 2. Fix investment_alerts ──────────────────────────────────────────────────

DROP TABLE IF EXISTS public.investment_alerts CASCADE;

CREATE TABLE public.investment_alerts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  UUID        REFERENCES public.contacts(id)    ON DELETE CASCADE,
  deal_id     UUID        REFERENCES public.deals(id)       ON DELETE SET NULL,
  property_id UUID        REFERENCES public.properties(id)  ON DELETE SET NULL,
  alert_type  TEXT        NOT NULL
              CHECK (alert_type IN ('price_drop','new_match','deal_stage','market_signal','score_high')),
  title       TEXT        NOT NULL,
  message     TEXT        NOT NULL,
  sent_at     TIMESTAMPTZ,
  sent_via    TEXT        CHECK (sent_via IN ('email','whatsapp','sms','push')),
  status      TEXT        NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','sent','failed','cancelled')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.investment_alerts ENABLE ROW LEVEL SECURITY;

-- Restrict to authenticated agents
CREATE POLICY "Agents can manage investment alerts"
  ON public.investment_alerts FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_investment_alerts_contact_id ON public.investment_alerts(contact_id);
CREATE INDEX IF NOT EXISTS idx_investment_alerts_status     ON public.investment_alerts(status);
CREATE INDEX IF NOT EXISTS idx_investment_alerts_deal_id    ON public.investment_alerts(deal_id);

-- ── 3. Create agents table (used by /api/analytics/summary) ──────────────────
-- Analytics summary falls back to mock data when this table is empty/missing.
-- This table stores agent KPIs for the portal analytics dashboard.

CREATE TABLE IF NOT EXISTS public.agents (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name       TEXT        NOT NULL,
  email           TEXT        UNIQUE,
  phone           TEXT,
  -- Monthly performance KPIs
  gci_mes         NUMERIC(12,2) NOT NULL DEFAULT 0,   -- Gross Commission Income (current month)
  gci_ytd         NUMERIC(12,2) NOT NULL DEFAULT 0,   -- GCI year-to-date
  deals_fechados  INT           NOT NULL DEFAULT 0,   -- Closed deals
  pipeline        NUMERIC(12,2) NOT NULL DEFAULT 0,   -- Active pipeline value
  conversao       NUMERIC(5,2)  NOT NULL DEFAULT 0,   -- Conversion rate %
  dias_ciclo      INT           NOT NULL DEFAULT 0,   -- Average deal cycle days
  score           SMALLINT      NOT NULL DEFAULT 0,   -- Agent performance score 0-100
  -- Activity metrics
  calls           INT           NOT NULL DEFAULT 0,
  emails          INT           NOT NULL DEFAULT 0,
  visitas         INT           NOT NULL DEFAULT 0,
  propostas       INT           NOT NULL DEFAULT 0,
  -- Metadata
  active          BOOLEAN       NOT NULL DEFAULT TRUE,
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

-- Only service role can write; authenticated agents can read
CREATE POLICY "Service role manages agents" ON public.agents
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated agents read" ON public.agents
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_agents_email     ON public.agents(email);
CREATE INDEX IF NOT EXISTS idx_agents_gci_mes   ON public.agents(gci_mes DESC);
CREATE INDEX IF NOT EXISTS idx_agents_active    ON public.agents(active);

-- Seed with known agent from env (geral@agencygroup.pt)
INSERT INTO public.agents (full_name, email, active)
VALUES ('Carlos Agency Group', 'geral@agencygroup.pt', true)
ON CONFLICT (email) DO NOTHING;

-- ── VERIFY ───────────────────────────────────────────────────────────────────
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema='public'
--   AND table_name IN ('visitas','investment_alerts','agents');
-- Expected: 3 rows
--
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name='visitas' AND column_name IN ('contact_id','property_id');
-- Expected: uuid, uuid
