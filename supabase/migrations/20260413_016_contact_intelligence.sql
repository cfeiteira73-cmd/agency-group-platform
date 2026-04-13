-- =============================================================================
-- Agency Group — Contact Intelligence Engine
-- Migration: 20260413_016_contact_intelligence
--
-- ADICIONA:
--
-- [A] OWNER CONTACT (direct — separate from listing agent contact)
--   owner_name              — nome do proprietário
--   owner_type_detail       — particular/empresa/herança/fundo/banco/cooperativa
--   contact_phone_owner     — telefone direto do proprietário
--   contact_email_owner     — email direto do proprietário
--
-- [B] SELLER INTENT MODEL
--   seller_intent_score     — 0-100 intenção real de vender
--   seller_intent_label     — hot/medium/low
--
-- [C] DEAL TIMELINE ENGINE
--   days_without_action_flag — TRUE se >72h sem qualquer acção em lead ≥70
--   stale_deal_flag          — TRUE se >14 dias sem acção em lead activo
--   urgent_followup_flag     — TRUE se SLA prestes a ser violado
--   last_action_type         — tipo da última acção registada
--
-- [D] NETWORK SOURCE TRACKING
--   source_network_type      — advogado/banco/agente/developer/referral/direct/online
--   source_network_contact   — nome da pessoa da rede que referiu
--
-- [E] REVENUE KPI ENGINE
--   revenue_per_lead_estimate — comissão estimada em € (price_ask × 5%)
--   revenue_potential_class   — high/medium/low baseado em ticket
--
-- [F] ALERT TRACKING (evitar spam)
--   last_alerted_at           — timestamp do último alerta enviado
--   last_alert_type           — tipo do último alerta (p0/cpcv/no_contact/etc)
--   alert_count               — total de alertas enviados para este lead
-- =============================================================================

-- ── [A] OWNER CONTACT ─────────────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS owner_name TEXT;

COMMENT ON COLUMN offmarket_leads.owner_name IS
  'Nome do proprietário (se diferente do listing agent).
   Obtido via: registo predial, LinkedIn, referral, Sofia research.
   NULL = não identificado ainda.';

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS owner_type_detail TEXT
    CHECK (owner_type_detail IS NULL OR owner_type_detail IN (
      'particular',      -- pessoa singular
      'empresa',         -- empresa / sociedade
      'heranca',         -- herança / sucessão em curso
      'fundo',           -- fundo de investimento
      'banco',           -- banco / entidade financeira
      'cooperativa',     -- cooperativa habitacional
      'municipio',       -- câmara municipal / entidade pública
      'outro'
    ));

COMMENT ON COLUMN offmarket_leads.owner_type_detail IS
  'Tipo de proprietário com detalhe:
   heranca = alta urgência de venda (herdeiros querem liquidez rápida).
   banco = processo formal, desconto possível mas burocracia.
   fundo = processo profissional, demorado, mas preço negociável.
   empresa = pode ter pressão fiscal/financeira.
   Usar em conjunto com owner_type existente para precisão máxima.';

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS contact_phone_owner TEXT;

COMMENT ON COLUMN offmarket_leads.contact_phone_owner IS
  'Telefone DIRETO do proprietário (não do agente de anúncio).
   Formato E.164: +351XXXXXXXXX.
   Este é o contacto de maior valor — permite abordagem directa sem partilha de comissão.
   Diferente do campo "contacto" que pode ser o agente do anúncio.';

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS contact_email_owner TEXT;

COMMENT ON COLUMN offmarket_leads.contact_email_owner IS
  'Email DIRETO do proprietário.
   Validar antes de usar (formato name@domain.tld).
   Útil para abordagem formal quando telefone não disponível.';

-- ── [B] SELLER INTENT MODEL ───────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS seller_intent_score SMALLINT
    CHECK (seller_intent_score IS NULL OR (seller_intent_score BETWEEN 0 AND 100));

COMMENT ON COLUMN offmarket_leads.seller_intent_score IS
  '0-100 intenção real de vender AGORA:
   desconto_mercado ≥15%(25) + tempo_mercado >90 dias(25)
   + tipo_proprietário herança/banco(25) + urgência declarada high(25).
   ≥70 = HOT SELLER — atacar esta semana.
   40-69 = MEDIUM — pipeline activo.
   <40 = LOW — watchlist.
   Set by /api/offmarket-leads/[id]/deal-eval.';

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS seller_intent_label TEXT DEFAULT 'unknown'
    CHECK (seller_intent_label IN ('hot', 'medium', 'low', 'unknown'));

COMMENT ON COLUMN offmarket_leads.seller_intent_label IS
  'hot  = seller_intent_score ≥70 — atacar agora.
   medium = 40-69 — qualificar e manter aquecido.
   low   = <40 — watchlist.
   unknown = não calculado ainda.';

-- ── [C] DEAL TIMELINE ENGINE ──────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS days_without_action_flag BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN offmarket_leads.days_without_action_flag IS
  'TRUE quando lead score ≥70 sem qualquer acção há >72h.
   Sinal de paralisia operacional. Mostrar no Deal Desk com badge AMBER.
   Calculado diariamente pelo cron de scoring.';

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS stale_deal_flag BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN offmarket_leads.stale_deal_flag IS
  'TRUE quando lead activo (contactado/interessado/negotiation) sem acção há >14 dias.
   Sinal de deal morto-vivo. Mostrar no Deal Desk com badge RED.
   Requer decisão: reactivar ou matar.';

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS urgent_followup_flag BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN offmarket_leads.urgent_followup_flag IS
  'TRUE quando follow-up agendado está em atraso ou a vencer em <4h.
   Prioridade máxima no Deal Desk.';

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS last_action_type TEXT
    CHECK (last_action_type IS NULL OR last_action_type IN (
      'lead_created',
      'scored',
      'buyer_matched',
      'price_intel',
      'deal_evaluated',
      'contact_attempted',
      'contact_made',
      'meeting_scheduled',
      'meeting_done',
      'proposal_sent',
      'negotiation_started',
      'cpcv_initiated',
      'cpcv_signed',
      'deal_closed',
      'deal_killed'
    ));

COMMENT ON COLUMN offmarket_leads.last_action_type IS
  'Tipo da última acção registada no lead.
   Usado para calcular dias_sem_acção e stale_deal_flag.
   Atualizado automaticamente pelos endpoints de pipeline.';

-- ── [D] NETWORK SOURCE TRACKING ──────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS source_network_type TEXT
    CHECK (source_network_type IS NULL OR source_network_type IN (
      'advogado',        -- advogado / notário
      'banco',           -- banco / gestor bancário
      'agente',          -- outro agente (co-mediação)
      'developer',       -- promotor imobiliário
      'referral_cliente',-- cliente existente referiu
      'referral_rede',   -- rede de contactos geral
      'directo',         -- proprietário veio directamente
      'online',          -- portal/website/SEO
      'evento',          -- evento / networking
      'parceiro_inst'    -- parceiro institucional
    ));

COMMENT ON COLUMN offmarket_leads.source_network_type IS
  'Tipo de fonte de rede que gerou este lead.
   KPI crítico: qual gera mais € em comissão.
   Cruzar com revenue_per_lead_estimate para medir ROI da rede.';

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS source_network_contact TEXT;

COMMENT ON COLUMN offmarket_leads.source_network_contact IS
  'Nome do contacto da rede que referiu este lead.
   Ex: "Dr. João Silva (Morais Leitão)", "Maria Santos (BPI Private)".
   Usado para agradecer, medir ROI da rede e direcionar esforços de networking.';

-- ── [E] REVENUE KPI ENGINE ────────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS revenue_per_lead_estimate INTEGER;

COMMENT ON COLUMN offmarket_leads.revenue_per_lead_estimate IS
  'Comissão estimada em EUR = price_ask × 5%.
   Calculado automaticamente quando price_ask é definido.
   Ordenar Deal Desk por este valor para maximizar € por hora de trabalho.
   Ex: lead €2M → revenue_estimate €100.000.';

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS revenue_potential_class TEXT DEFAULT 'unknown'
    CHECK (revenue_potential_class IN ('high', 'medium', 'low', 'unknown'));

COMMENT ON COLUMN offmarket_leads.revenue_potential_class IS
  'high   = ticket ≥€1M (comissão ≥€50K).
   medium = €300K–€1M (comissão €15K–€50K).
   low    = <€300K (comissão <€15K).
   unknown = sem price_ask definido.';

-- ── [F] ALERT TRACKING ───────────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS last_alerted_at TIMESTAMPTZ;

COMMENT ON COLUMN offmarket_leads.last_alerted_at IS
  'Timestamp do último alerta enviado para este lead (email/WhatsApp).
   Usado para evitar spam: não alertar de novo se last_alerted_at < 6h atrás (P0)
   ou < 24h atrás (P1/outros).';

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS last_alert_type TEXT
    CHECK (last_alert_type IS NULL OR last_alert_type IN (
      'p0_email_wa',
      'p0_email_only',
      'cpcv_trigger',
      'no_contact',
      'no_meeting',
      'human_failure',
      'stale_deal',
      'close_window',
      'watchlist_recheck'
    ));

COMMENT ON COLUMN offmarket_leads.last_alert_type IS
  'Tipo do último alerta enviado.
   Permite saber se o lead já foi alertado e por quê,
   e evitar repetição do mesmo alerta dentro da janela.';

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS alert_count SMALLINT DEFAULT 0
    CHECK (alert_count >= 0);

COMMENT ON COLUMN offmarket_leads.alert_count IS
  'Total de alertas enviados para este lead.
   Muitos alertas sem acção = deal a consumir atenção sem ROI.
   alert_count ≥5 sem mudança de estado → considerar time_waste_flag.';

-- ── TRIGGER: auto compute revenue_estimate + seller_intent + flags ─────────────

CREATE OR REPLACE FUNCTION fn_compute_intelligence_fields()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  intent_score SMALLINT := 0;
  discount NUMERIC;
  days_on NUMERIC;
BEGIN
  -- ── Revenue Estimate ──────────────────────────────────────────────────
  IF NEW.price_ask IS NOT NULL AND NEW.price_ask > 0 THEN
    NEW.revenue_per_lead_estimate := ROUND(NEW.price_ask * 0.05)::INTEGER;
    NEW.revenue_potential_class :=
      CASE
        WHEN NEW.price_ask >= 1000000 THEN 'high'
        WHEN NEW.price_ask >= 300000  THEN 'medium'
        ELSE                               'low'
      END;
  END IF;

  -- ── Seller Intent Score ───────────────────────────────────────────────
  -- Discount component (max 25)
  discount := COALESCE(NEW.gross_discount_pct, 0);
  intent_score := intent_score + CASE
    WHEN discount >= 20 THEN 25
    WHEN discount >= 15 THEN 20
    WHEN discount >= 10 THEN 12
    WHEN discount >= 5  THEN 6
    ELSE 0
  END;

  -- Days on market component (max 25)
  IF NEW.created_at IS NOT NULL THEN
    days_on := EXTRACT(EPOCH FROM (NOW() - NEW.created_at)) / 86400;
    intent_score := intent_score + CASE
      WHEN days_on >= 180 THEN 25
      WHEN days_on >= 90  THEN 18
      WHEN days_on >= 60  THEN 12
      WHEN days_on >= 30  THEN 6
      ELSE 0
    END;
  END IF;

  -- Owner type component (max 25)
  intent_score := intent_score + CASE
    WHEN NEW.owner_type IN ('heranca', 'banco', 'fundo') THEN 25
    WHEN NEW.owner_type_detail IN ('heranca', 'banco', 'fundo') THEN 25
    WHEN NEW.owner_type = 'executor' THEN 20
    WHEN NEW.owner_type = 'divorciado' THEN 18
    ELSE 5
  END;

  -- Urgency component (max 25)
  intent_score := intent_score + CASE
    WHEN NEW.urgency = 'high' THEN 25
    WHEN NEW.urgency = 'medium' THEN 12
    ELSE 0
  END;

  NEW.seller_intent_score := LEAST(100, intent_score);
  NEW.seller_intent_label :=
    CASE
      WHEN NEW.seller_intent_score >= 70 THEN 'hot'
      WHEN NEW.seller_intent_score >= 40 THEN 'medium'
      ELSE 'low'
    END;

  -- ── Deal Timeline Flags ───────────────────────────────────────────────
  -- stale_deal: active lead, no action >14 days
  IF NEW.status IN ('contacted', 'interested', 'negotiation', 'pre_close')
     AND NEW.updated_at IS NOT NULL
     AND EXTRACT(EPOCH FROM (NOW() - NEW.updated_at)) / 86400 > 14
  THEN
    NEW.stale_deal_flag := TRUE;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compute_intelligence_fields ON offmarket_leads;
CREATE TRIGGER trg_compute_intelligence_fields
  BEFORE INSERT OR UPDATE OF price_ask, gross_discount_pct, urgency, owner_type, status, updated_at
  ON offmarket_leads
  FOR EACH ROW EXECUTE FUNCTION fn_compute_intelligence_fields();

-- ── INDEXES ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_offmarket_owner_name
  ON offmarket_leads (owner_name)
  WHERE owner_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_offmarket_seller_intent
  ON offmarket_leads (seller_intent_label, seller_intent_score DESC NULLS LAST)
  WHERE seller_intent_label IN ('hot', 'medium');

CREATE INDEX IF NOT EXISTS idx_offmarket_revenue_class
  ON offmarket_leads (revenue_potential_class, revenue_per_lead_estimate DESC NULLS LAST)
  WHERE revenue_potential_class = 'high';

CREATE INDEX IF NOT EXISTS idx_offmarket_stale_deal
  ON offmarket_leads (stale_deal_flag, updated_at)
  WHERE stale_deal_flag = TRUE;

CREATE INDEX IF NOT EXISTS idx_offmarket_last_alerted
  ON offmarket_leads (last_alerted_at DESC NULLS LAST)
  WHERE last_alerted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_offmarket_source_network
  ON offmarket_leads (source_network_type);

CREATE INDEX IF NOT EXISTS idx_offmarket_urgent_followup
  ON offmarket_leads (urgent_followup_flag)
  WHERE urgent_followup_flag = TRUE;

-- ── VERIFICATION ──────────────────────────────────────────────────────────────

SELECT 'Migration 016 complete — Contact Intelligence Engine' AS status,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'offmarket_leads'
     AND column_name IN (
       'owner_name','owner_type_detail','contact_phone_owner','contact_email_owner',
       'seller_intent_score','seller_intent_label',
       'days_without_action_flag','stale_deal_flag','urgent_followup_flag','last_action_type',
       'source_network_type','source_network_contact',
       'revenue_per_lead_estimate','revenue_potential_class',
       'last_alerted_at','last_alert_type','alert_count'
     )
  ) AS new_columns_added;
