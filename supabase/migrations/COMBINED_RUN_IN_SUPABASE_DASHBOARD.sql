-- =================================================================
-- COMBINED MIGRATIONS - 2026-04-07
-- Run this in Supabase Dashboard > SQL Editor
-- URL: https://supabase.com/dashboard/project/isbfiofwpxqqpgxoftph/sql
-- =================================================================

-- =================================================================
-- MIGRATION: 20260407_sofia_memory.sql
-- =================================================================

-- Sofia AI conversation memory for persistent user preferences
CREATE TABLE IF NOT EXISTS sofia_memory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  preferences JSONB DEFAULT '{}',
  viewed_properties TEXT[] DEFAULT '{}',
  search_history JSONB[] DEFAULT '{}',
  budget_min INTEGER,
  budget_max INTEGER,
  preferred_zones TEXT[] DEFAULT '{}',
  preferred_types TEXT[] DEFAULT '{}',
  conversation_count INTEGER DEFAULT 0,
  last_active_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_id)
);

CREATE INDEX IF NOT EXISTS idx_sofia_memory_session ON sofia_memory(session_id);
CREATE INDEX IF NOT EXISTS idx_sofia_memory_user ON sofia_memory(user_id);

-- Allow anonymous sessions (no user_id required)
ALTER TABLE sofia_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own memory" ON sofia_memory
  FOR ALL USING (
    user_id IS NULL OR auth.uid() = user_id
  );


-- =================================================================
-- MIGRATION: 20260407_property_embeddings.sql
-- =================================================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to properties table
ALTER TABLE properties ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create IVFFlat index for fast ANN search
CREATE INDEX IF NOT EXISTS properties_embedding_idx
  ON properties USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Function: semantic search — returns top-k most similar properties
CREATE OR REPLACE FUNCTION search_properties_semantic(
  query_embedding vector(1536),
  similarity_threshold float DEFAULT 0.7,
  match_count int DEFAULT 15,
  filter_zona text DEFAULT NULL,
  filter_preco_min int DEFAULT NULL,
  filter_preco_max int DEFAULT NULL,
  filter_quartos int DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  nome text,
  zona text,
  preco int,
  quartos int,
  area int,
  tipo text,
  descricao text,
  fotos text[],
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id, p.nome, p.zona, p.preco, p.quartos, p.area, p.tipo, p.descricao, p.fotos,
    1 - (p.embedding <=> query_embedding) AS similarity
  FROM properties p
  WHERE
    p.status = 'active'
    AND p.embedding IS NOT NULL
    AND 1 - (p.embedding <=> query_embedding) > similarity_threshold
    AND (filter_zona IS NULL OR p.zona ILIKE '%' || filter_zona || '%')
    AND (filter_preco_min IS NULL OR p.preco >= filter_preco_min)
    AND (filter_preco_max IS NULL OR p.preco <= filter_preco_max)
    AND (filter_quartos IS NULL OR p.quartos >= filter_quartos)
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function: generate and store property embedding (called after upsert)
CREATE OR REPLACE FUNCTION properties_needs_embedding()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Mark that embedding needs refresh by nulling it on description change
  IF (TG_OP = 'UPDATE' AND OLD.descricao IS DISTINCT FROM NEW.descricao) THEN
    NEW.embedding := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER properties_embedding_trigger
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION properties_needs_embedding();


-- =================================================================
-- MIGRATION: 20260407_crm_agent_tables.sql
-- =================================================================

-- =============================================================================
-- AGENCY GROUP — CRM Agent Tables Migration
-- Sprint 9 Agent 3: Agentic AI CRM (Sofia autonomous loop)
-- =============================================================================

-- CRM Tasks table (deals.id is BIGINT, not UUID)
CREATE TABLE IF NOT EXISTS crm_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id BIGINT REFERENCES deals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ NOT NULL,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
  type TEXT CHECK (type IN ('call', 'email', 'visit', 'document', 'offer')) DEFAULT 'call',
  status TEXT CHECK (status IN ('pending', 'in_progress', 'done', 'cancelled')) DEFAULT 'pending',
  created_by TEXT DEFAULT 'human',
  assigned_to UUID REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- CRM Followups table (AI-generated messages)
CREATE TABLE IF NOT EXISTS crm_followups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id BIGINT REFERENCES deals(id) ON DELETE CASCADE,
  channel TEXT CHECK (channel IN ('email', 'whatsapp', 'sms')) NOT NULL,
  message TEXT NOT NULL,
  language TEXT DEFAULT 'pt',
  context TEXT,
  generated_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ,
  status TEXT CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')) DEFAULT 'pending'
);

-- Deal stage history table (audit trail for AI stage changes)
CREATE TABLE IF NOT EXISTS deal_stage_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id BIGINT REFERENCES deals(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  reason TEXT,
  changed_at TIMESTAMPTZ DEFAULT now(),
  changed_by TEXT DEFAULT 'human'
);

-- Add lead_score and scored_at to deals if not exists
ALTER TABLE deals ADD COLUMN IF NOT EXISTS lead_score INTEGER CHECK (lead_score >= 0 AND lead_score <= 100);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS scored_at TIMESTAMPTZ;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT now();

-- RLS Policies
ALTER TABLE crm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users manage tasks"
  ON crm_tasks FOR ALL TO authenticated USING (true);

CREATE POLICY "Auth users manage followups"
  ON crm_followups FOR ALL TO authenticated USING (true);

CREATE POLICY "Auth users view stage history"
  ON deal_stage_history FOR ALL TO authenticated USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS crm_tasks_deal_id_idx ON crm_tasks(deal_id);
CREATE INDEX IF NOT EXISTS crm_tasks_status_idx ON crm_tasks(status, due_date);
CREATE INDEX IF NOT EXISTS crm_tasks_assigned_idx ON crm_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS crm_followups_deal_id_idx ON crm_followups(deal_id);
CREATE INDEX IF NOT EXISTS crm_followups_status_idx ON crm_followups(status);
CREATE INDEX IF NOT EXISTS deal_stage_history_deal_id_idx ON deal_stage_history(deal_id);
CREATE INDEX IF NOT EXISTS deals_last_activity_idx ON deals(last_activity_at);
CREATE INDEX IF NOT EXISTS deals_lead_score_idx ON deals(lead_score DESC NULLS LAST);



-- =================================================================
-- MIGRATION: 20260413_010_deal_evaluation_engine.sql
-- =================================================================

-- =============================================================================
-- Agency Group — Deal Evaluation Engine
-- Migration: 20260413_010_deal_evaluation_engine
-- FASE 16: 8-layer deal scoring model
--
-- AUDITORIA — NÃO duplica:
--   score (001), score_breakdown (001/003), score_reason (004)
--   deal_priority_score (007), attack_recommendation (007), buyer_triad_notes (007)
--   estimated_fair_value (009), gross_discount_pct (009), comp_confidence_score (009)
--   price_opportunity_score (009), price_reason (009)
--
-- ADICIONA (18 colunas novas):
--   adjusted_discount_score  — desconto bruto ajustado pela confiança (0-100)
--   liquidity_score          — liquidez real do ativo (0-100)
--   liquidity_reason         — narrativa da liquidez
--   execution_probability    — fechabilidade do deal (0-100)
--   execution_reason         — narrativa da execução
--   best_buyer_execution_score — buyer primário × active_status (0-100)
--   buyer_execution_reason   — narrativa do buyer
--   upside_score             — potencial de valorização bruto (0-100)
--   friction_penalty         — penalização por fricção e risco (0-50)
--   risk_adjusted_upside_score — upside líquido de fricção (0-100)
--   upside_reason            — narrativa do upside
--   asset_quality_score      — qualidade intrínseca do ativo (0-100)
--   source_quality_score     — fiabilidade da origem (0-100)
--   deal_evaluation_score    — composite elite: 8 camadas (0-100)
--   deal_evaluation_reason   — narrativa completa
--   master_attack_rank       — rank final de ataque (0-100)
--   master_attack_reason     — narrativa do rank
--   deal_evaluation_updated_at — timestamp da última avaliação
-- =============================================================================

-- ── Desconto ajustado pela confiança ────────────────────────────────────────
ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS adjusted_discount_score SMALLINT
    CHECK (adjusted_discount_score IS NULL OR (adjusted_discount_score BETWEEN 0 AND 100));

-- ── Liquidez real ────────────────────────────────────────────────────────────
ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS liquidity_score SMALLINT
    CHECK (liquidity_score IS NULL OR (liquidity_score BETWEEN 0 AND 100));

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS liquidity_reason TEXT;

-- ── Execution probability ────────────────────────────────────────────────────
ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS execution_probability SMALLINT
    CHECK (execution_probability IS NULL OR (execution_probability BETWEEN 0 AND 100));

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS execution_reason TEXT;

-- ── Buyer execution score ────────────────────────────────────────────────────
ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS best_buyer_execution_score SMALLINT
    CHECK (best_buyer_execution_score IS NULL OR (best_buyer_execution_score BETWEEN 0 AND 100));

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS buyer_execution_reason TEXT;

-- ── Upside + Friction + Risk-adjusted upside ─────────────────────────────────
ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS upside_score SMALLINT
    CHECK (upside_score IS NULL OR (upside_score BETWEEN 0 AND 100));

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS friction_penalty SMALLINT
    CHECK (friction_penalty IS NULL OR (friction_penalty BETWEEN 0 AND 50));

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS risk_adjusted_upside_score SMALLINT
    CHECK (risk_adjusted_upside_score IS NULL OR (risk_adjusted_upside_score BETWEEN 0 AND 100));

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS upside_reason TEXT;

-- ── Asset quality ────────────────────────────────────────────────────────────
ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS asset_quality_score SMALLINT
    CHECK (asset_quality_score IS NULL OR (asset_quality_score BETWEEN 0 AND 100));

-- ── Source quality ────────────────────────────────────────────────────────────
ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS source_quality_score SMALLINT
    CHECK (source_quality_score IS NULL OR (source_quality_score BETWEEN 0 AND 100));

-- ── Deal Evaluation composite ─────────────────────────────────────────────────
ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS deal_evaluation_score SMALLINT
    CHECK (deal_evaluation_score IS NULL OR (deal_evaluation_score BETWEEN 0 AND 100));

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS deal_evaluation_reason TEXT;

-- ── Master Attack Rank ───────────────────────────────────────────────────────
ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS master_attack_rank SMALLINT
    CHECK (master_attack_rank IS NULL OR (master_attack_rank BETWEEN 0 AND 100));

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS master_attack_reason TEXT;

-- ── Timestamp ────────────────────────────────────────────────────────────────
ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS deal_evaluation_updated_at TIMESTAMPTZ;

-- ── Indexes — sorting by rank / eval score / execution ───────────────────────

CREATE INDEX IF NOT EXISTS idx_offmarket_leads_master_attack_rank
  ON offmarket_leads (master_attack_rank DESC NULLS LAST)
  WHERE master_attack_rank IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_offmarket_leads_deal_eval_score
  ON offmarket_leads (deal_evaluation_score DESC NULLS LAST)
  WHERE deal_evaluation_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_offmarket_leads_execution_prob
  ON offmarket_leads (execution_probability DESC NULLS LAST)
  WHERE execution_probability IS NOT NULL;

-- ── Comments ─────────────────────────────────────────────────────────────────

COMMENT ON COLUMN offmarket_leads.adjusted_discount_score IS
  '0-100. Desconto bruto (gross_discount_pct) multiplicado pela confiança da comparação (comp_confidence_score/100) × 2.
   Evita usar headline de desconto sem validação. Set by /api/offmarket-leads/[id]/deal-eval.';

COMMENT ON COLUMN offmarket_leads.liquidity_score IS
  '0-100. Liquidez real do ativo: zona (0-30) + tipo (0-25) + ticket (0-20) + buyer pool (0-25).
   Mede capacidade real de saída, não apenas localização. Set by /api/.../deal-eval.';

COMMENT ON COLUMN offmarket_leads.execution_probability IS
  '0-100. Probabilidade de fecho real: motivação owner (0-20) + urgência (0-20) + contacto (0-15)
   + preclose (0-15) + price realism (0-15) + buyer depth (0-15). Set by /api/.../deal-eval.';

COMMENT ON COLUMN offmarket_leads.best_buyer_execution_score IS
  '0-100. buyer_score do comprador primário × multiplicador de active_status
   (active=1.0, dormant=0.70, inactive=0.40). Não basta ter match — é preciso quem fecha.';

COMMENT ON COLUMN offmarket_leads.upside_score IS
  '0-100. Potencial bruto de valorização: tipo activo (0-35) + zona (0-25) + desconto (0-25) + tamanho (0-15).';

COMMENT ON COLUMN offmarket_leads.friction_penalty IS
  '0-50. Penalização por fricção operacional e risco: sem contacto (+10), risco vermelho (+15),
   confiança baixa (+8), sem buyers (+10), preço acima mercado (+12), docs pendentes (+5), bloqueado (+7-12).';

COMMENT ON COLUMN offmarket_leads.risk_adjusted_upside_score IS
  '0-100. upside_score - friction_penalty (floored at 0). Upside real líquido de todas as fricções.';

COMMENT ON COLUMN offmarket_leads.asset_quality_score IS
  '0-100. Qualidade intrínseca: tipo (0-40) + zona (0-30) + tamanho (0-20) + confiança nos dados (0-10).';

COMMENT ON COLUMN offmarket_leads.source_quality_score IS
  '0-100. Fiabilidade da fonte: referral=90, banco/leilão=85, linkedin=80, casafari=75,
   idealista=65, google_maps=60, olx=48, manual=42, desconhecido=28.';

COMMENT ON COLUMN offmarket_leads.deal_evaluation_score IS
  '0-100. Score elite composto: adjusted_discount(25%) + liquidity(15%) + execution_prob(20%)
   + buyer_execution(20%) + risk_adj_upside(10%) + asset_quality(5%) + source_quality(5%).
   Não substitui o score off-market — é a camada de decisão elite sobre ele.';

COMMENT ON COLUMN offmarket_leads.master_attack_rank IS
  '0-100. Rank final de ataque: deal_evaluation_score(50%) + deal_priority_score(30%) + execution_probability(20%).
   Combina avaliação qualitativa + matching de compradores + fechabilidade.
   Usado para ordenar execution queue e destacar P0/P1.';

SELECT 'Migration 010 complete — Deal Evaluation Engine' AS status,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'offmarket_leads'
     AND column_name IN (
       'adjusted_discount_score','liquidity_score','execution_probability',
       'best_buyer_execution_score','upside_score','friction_penalty',
       'risk_adjusted_upside_score','asset_quality_score','source_quality_score',
       'deal_evaluation_score','master_attack_rank','deal_evaluation_updated_at'
     )
  ) AS new_columns_added;

-- =================================================================
-- MIGRATION: 20260413_011_execution_engine.sql
-- =================================================================

-- =============================================================================
-- Agency Group — Execution Engine
-- Migration: 20260413_011_execution_engine
-- FASE 18: campos operacionais para forçar execução
--
-- ADICIONA (5 colunas):
--   first_contact_at          — quando foi feito o primeiro contacto real
--   last_contact_attempt_at   — última tentativa de contacto (mesmo sem sucesso)
--   execution_blocker_reason  — razão principal que bloqueia execução
--   data_completeness_score   — qualidade dos dados (0-100)
--   price_intel_blocked       — sem area_m2, price-intel não pode correr
-- =============================================================================

-- ── Contact tracking ─────────────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS first_contact_at TIMESTAMPTZ;

COMMENT ON COLUMN offmarket_leads.first_contact_at IS
  'Timestamp do primeiro contacto real com o proprietário. Usado para medir SLA de resposta.
   Diferente de sla_contacted_at (que é o contacto de qualificação). Set manualmente ou por automação.';

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS last_contact_attempt_at TIMESTAMPTZ;

COMMENT ON COLUMN offmarket_leads.last_contact_attempt_at IS
  'Última tentativa de contacto, mesmo sem sucesso (sem atender, sem resposta).
   Usado para medir persistência e evitar leads esquecidas.';

-- ── Execution blocker ─────────────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS execution_blocker_reason TEXT
    CHECK (execution_blocker_reason IS NULL OR execution_blocker_reason IN (
      'no_contact',
      'no_price_intel',
      'no_buyer',
      'sla_breach',
      'insufficient_data',
      'test_lead',
      'ready_to_attack'
    ));

COMMENT ON COLUMN offmarket_leads.execution_blocker_reason IS
  'Razão principal que bloqueia execução comercial.
   Hierarquia: no_contact > no_price_intel > no_buyer > sla_breach > insufficient_data > ready_to_attack.
   Set by /api/offmarket-leads/[id]/deal-eval.';

-- ── Data completeness ────────────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS data_completeness_score SMALLINT
    CHECK (data_completeness_score IS NULL OR (data_completeness_score BETWEEN 0 AND 100));

COMMENT ON COLUMN offmarket_leads.data_completeness_score IS
  '0-100. Qualidade dos dados para execução: contacto(30) + area_m2(20) + price_intel(20)
   + buyer_match(15) + source_quality(15). Score < 60 = "DADOS INSUFICIENTES".
   Set by /api/offmarket-leads/[id]/deal-eval.';

-- ── Price intel blocked ───────────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS price_intel_blocked BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN offmarket_leads.price_intel_blocked IS
  'TRUE quando area_m2 é NULL e price-intel não pode correr (falta dimensão para calcular €/m²).
   Set by /api/offmarket-leads/[id]/deal-eval.';

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_offmarket_leads_execution_blocker
  ON offmarket_leads (execution_blocker_reason)
  WHERE execution_blocker_reason IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_offmarket_leads_data_completeness
  ON offmarket_leads (data_completeness_score DESC NULLS LAST)
  WHERE data_completeness_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_offmarket_leads_first_contact
  ON offmarket_leads (first_contact_at)
  WHERE first_contact_at IS NOT NULL;

-- ── Test lead cleanup ─────────────────────────────────────────────────────────
-- Mark obvious test leads as not_interested so they don't pollute metrics

UPDATE offmarket_leads
SET
  status = 'not_interested',
  execution_blocker_reason = 'test_lead'
WHERE
  status NOT IN ('closed_won', 'closed_lost', 'not_interested')
  AND (
    nome ILIKE '%test%'
    OR nome ILIKE '%e2e%'
    OR nome ILIKE '%direct%'
    OR nome ILIKE '%Direct POST%'
    OR nome ILIKE '%Direct Portal%'
  );

SELECT 'Migration 011 complete — Execution Engine' AS status,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'offmarket_leads'
     AND column_name IN (
       'first_contact_at','last_contact_attempt_at',
       'execution_blocker_reason','data_completeness_score','price_intel_blocked'
     )
  ) AS new_columns_added;

-- =================================================================
-- MIGRATION: 20260413_012_closing_engine.sql
-- =================================================================

-- =============================================================================
-- Agency Group — Closing Engine
-- Migration: 20260413_012_closing_engine
-- FASE 19: velocidade, pressão e probabilidade de CPCV
--
-- ADICIONA (8 colunas):
--   first_meeting_at      — data da primeira visita/reunião
--   deal_velocity_score   — velocidade do pipeline (0-100)
--   buyer_pressure_score  — força do comprador para fechar (0-100)
--   buyer_pressure_class  — HIGH / MED / LOW
--   seller_pressure_reason — narrativa da pressão do vendedor
--   buyer_pressure_reason  — narrativa da pressão do comprador
--   deal_readiness_score  — prontidão para CPCV (0-100)
--   cpcv_probability      — probabilidade de CPCV (0-100)
--
-- NÃO duplica:
--   execution_probability (011) — fechabilidade operacional
--   best_buyer_execution_score (010) — execução do buyer primário
--   deal_evaluation_score (010) — qualidade do activo
--   master_attack_rank (010) — rank de ataque
-- =============================================================================

-- ── First meeting ─────────────────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS first_meeting_at TIMESTAMPTZ;

COMMENT ON COLUMN offmarket_leads.first_meeting_at IS
  'Data/hora da primeira visita ou reunião presencial/video com o proprietário.
   Set manualmente pelo agente ou por automação após visita registada.';

-- ── Deal Velocity ─────────────────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS deal_velocity_score SMALLINT
    CHECK (deal_velocity_score IS NULL OR (deal_velocity_score BETWEEN 0 AND 100));

COMMENT ON COLUMN offmarket_leads.deal_velocity_score IS
  '0-100. Velocidade de execução do pipeline:
   contacto <2h(+25) + visita <24h(+25) + proposta <48h(+25) + CPCV <7d(+25).
   Score alto = equipa a executar com velocidade máxima. Set by /api/.../deal-eval.';

-- ── Buyer Pressure ────────────────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS buyer_pressure_score SMALLINT
    CHECK (buyer_pressure_score IS NULL OR (buyer_pressure_score BETWEEN 0 AND 100));

COMMENT ON COLUMN offmarket_leads.buyer_pressure_score IS
  '0-100. Força do comprador primário para fechar:
   liquidez(30) + histórico_deals(20) + velocidade_fecho(20) + response_rate(15) + reliability(15).
   Ajustado pelo active_status (dormant×0.70, inactive×0.40). Set by /api/.../deal-eval.';

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS buyer_pressure_class TEXT
    CHECK (buyer_pressure_class IS NULL OR buyer_pressure_class IN ('HIGH', 'MED', 'LOW'));

COMMENT ON COLUMN offmarket_leads.buyer_pressure_class IS
  'HIGH(≥70) / MED(40-69) / LOW(<40). Classificação da pressão do comprador primário.';

-- ── Pressure reasons ─────────────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS seller_pressure_reason TEXT;

COMMENT ON COLUMN offmarket_leads.seller_pressure_reason IS
  'Narrativa da pressão do vendedor: tipo_proprietário + urgência + desconto + estado negociação.
   Usado em next_action e attack_reason para contextualizar a pressão real. Set by deal-eval.';

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS buyer_pressure_reason TEXT;

COMMENT ON COLUMN offmarket_leads.buyer_pressure_reason IS
  'Narrativa da pressão do comprador: liquidez + histórico + velocidade de resposta.
   Incluída no next_action para dar contexto ao agente. Set by deal-eval.';

-- ── Deal Readiness ────────────────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS deal_readiness_score SMALLINT
    CHECK (deal_readiness_score IS NULL OR (deal_readiness_score BETWEEN 0 AND 100));

COMMENT ON COLUMN offmarket_leads.deal_readiness_score IS
  '0-100. Prontidão para avançar para CPCV:
   contacto_directo(20) + visita_feita(20) + preclose_activo(20)
   + buyer_alinhado(20, match≥70) + preço_alinhado(20, discount≥0).
   Score ≥80 = READY TO CLOSE. Set by /api/.../deal-eval.';

-- ── CPCV Probability ──────────────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS cpcv_probability SMALLINT
    CHECK (cpcv_probability IS NULL OR (cpcv_probability BETWEEN 0 AND 100));

COMMENT ON COLUMN offmarket_leads.cpcv_probability IS
  '0-100. Probabilidade estimada de CPCV nos próximos 30 dias:
   deal_eval(30%) + buyer_pressure(25%) + deal_velocity(20%) + deal_readiness(25%).
   ≥70 = provável fecho. Set by /api/.../deal-eval.';

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_offmarket_leads_cpcv_probability
  ON offmarket_leads (cpcv_probability DESC NULLS LAST)
  WHERE cpcv_probability IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_offmarket_leads_deal_readiness
  ON offmarket_leads (deal_readiness_score DESC NULLS LAST)
  WHERE deal_readiness_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_offmarket_leads_buyer_pressure_class
  ON offmarket_leads (buyer_pressure_class)
  WHERE buyer_pressure_class IS NOT NULL;

SELECT 'Migration 012 complete — Closing Engine' AS status,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'offmarket_leads'
     AND column_name IN (
       'first_meeting_at','deal_velocity_score','buyer_pressure_score',
       'buyer_pressure_class','seller_pressure_reason','buyer_pressure_reason',
       'deal_readiness_score','cpcv_probability'
     )
  ) AS new_columns_added;

-- =================================================================
-- MIGRATION: 20260413_013_money_engine.sql
-- =================================================================

-- =============================================================================
-- Agency Group — Money Engine
-- Migration: 20260413_013_money_engine
-- FASE 20: money_priority_score, contact loop, kill flag, competition flag
--
-- ADICIONA (4 colunas):
--   money_priority_score   — €/tempo: prioridade real por receita + velocidade
--   last_attempt_channel   — canal da última tentativa de contacto
--   buyer_competition_flag — ≥2 buyers HIGH pressure activos
--   deal_kill_flag         — sinal de descarte automático
--
-- ACTUALIZA CHECK:
--   execution_blocker_reason — adiciona no_meeting, deal_kill, cpcv_trigger
-- =============================================================================

-- ── Money Priority Score ──────────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS money_priority_score SMALLINT
    CHECK (money_priority_score IS NULL OR (money_priority_score BETWEEN 0 AND 100));

COMMENT ON COLUMN offmarket_leads.money_priority_score IS
  '0-100. Prioridade por receita × velocidade:
   cpcv_probability(50%) + deal_velocity_score(20%) + buyer_pressure_score(20%) + ticket_size(10%).
   Ordena o Deal Desk por impacto financeiro real, não apenas por qualidade do activo.
   Set by /api/offmarket-leads/[id]/deal-eval.';

-- ── Contact Channel Loop ──────────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS last_attempt_channel TEXT
    CHECK (last_attempt_channel IS NULL OR last_attempt_channel IN
      ('call', 'whatsapp', 'email', 'linkedin', 'other'));

COMMENT ON COLUMN offmarket_leads.last_attempt_channel IS
  'Canal da última tentativa de contacto com o proprietário.
   Sequência recomendada: call → whatsapp → email → linkedin → loop.
   Set manualmente pelo agente ou por automação n8n.';

-- ── Buyer Competition Flag ────────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS buyer_competition_flag BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN offmarket_leads.buyer_competition_flag IS
  'TRUE quando existem ≥2 compradores com buyer_pressure_score ≥70 matched.
   Aciona táctica de urgência: "vários compradores activos interessados".
   Set by /api/offmarket-leads/[id]/deal-eval.';

-- ── Deal Kill Flag ────────────────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS deal_kill_flag BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN offmarket_leads.deal_kill_flag IS
  'TRUE quando o deal deve ser descartado: sem contacto >72h + score<70,
   OU sem buyers + score<60, OU price_intel impossível + score<60.
   Sinaliza leads de baixo ROI que bloqueiam a fila de execução.
   Set by /api/offmarket-leads/[id]/deal-eval.';

-- ── Expand execution_blocker_reason CHECK ────────────────────────────────────
-- Drop auto-generated constraint and recreate with new values

ALTER TABLE offmarket_leads
  DROP CONSTRAINT IF EXISTS offmarket_leads_execution_blocker_reason_check;

ALTER TABLE offmarket_leads
  ADD CONSTRAINT offmarket_leads_execution_blocker_reason_check
    CHECK (execution_blocker_reason IS NULL OR execution_blocker_reason IN (
      'no_contact',
      'no_price_intel',
      'no_buyer',
      'no_meeting',
      'sla_breach',
      'insufficient_data',
      'test_lead',
      'deal_kill',
      'cpcv_trigger',
      'ready_to_attack'
    ));

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_offmarket_leads_money_priority
  ON offmarket_leads (money_priority_score DESC NULLS LAST)
  WHERE money_priority_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_offmarket_leads_deal_kill
  ON offmarket_leads (deal_kill_flag)
  WHERE deal_kill_flag = TRUE;

CREATE INDEX IF NOT EXISTS idx_offmarket_leads_buyer_competition
  ON offmarket_leads (buyer_competition_flag)
  WHERE buyer_competition_flag = TRUE;

SELECT 'Migration 013 complete — Money Engine' AS status,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'offmarket_leads'
     AND column_name IN (
       'money_priority_score','last_attempt_channel',
       'buyer_competition_flag','deal_kill_flag'
     )
  ) AS new_columns_added;

-- =================================================================
-- MIGRATION: 20260413_014_discipline_engine.sql
-- =================================================================

-- =============================================================================
-- Agency Group — Discipline Engine
-- Migration: 20260413_014_discipline_engine
-- FASE 21: execution_discipline_score, close_window_score, deal_momentum_score,
--           human_failure_flag, time_waste_flag, realistic_cpcv_forecast_flag
--
-- ADICIONA (6 colunas):
--   execution_discipline_score — mede disciplina operacional do agente (0-100)
--   close_window_score         — janela de fecho óptima (0-100)
--   deal_momentum_score        — actividade recente + progressão (0-100)
--   human_failure_flag         — agente a falhar SLA críticos
--   time_waste_flag            — deal a consumir tempo sem ROI possível
--   realistic_cpcv_forecast_flag — conta para o forecast conservador real
-- =============================================================================

-- ── Execution Discipline Score ────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS execution_discipline_score SMALLINT
    CHECK (execution_discipline_score IS NULL OR (execution_discipline_score BETWEEN 0 AND 100));

COMMENT ON COLUMN offmarket_leads.execution_discipline_score IS
  '0-100. Mede disciplina do agente dentro de cada milestone:
   contacto<2h(25) + visita<24h após contacto(25)
   + follow-up<24h após visita(25) + proposta<48h após visita(25).
   Score alto = agente executa rápido. Score baixo = SLA sistematicamente falhados.
   Set by /api/offmarket-leads/[id]/deal-eval.';

-- ── Close Window Score ────────────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS close_window_score SMALLINT
    CHECK (close_window_score IS NULL OR (close_window_score BETWEEN 0 AND 100));

COMMENT ON COLUMN offmarket_leads.close_window_score IS
  '0-100. Janela de fecho óptima AGORA:
   visita recente <48h(25) + buyer HIGH pressure(25)
   + vendedor com pressão alta(25) + desconto >15%(25).
   Score ≥75 = FECHAR ESTA SEMANA ou perder janela.
   Set by /api/offmarket-leads/[id]/deal-eval.';

-- ── Deal Momentum Score ───────────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS deal_momentum_score SMALLINT
    CHECK (deal_momentum_score IS NULL OR (deal_momentum_score BETWEEN 0 AND 100));

COMMENT ON COLUMN offmarket_leads.deal_momentum_score IS
  '0-100. Momentum actual do deal (últimos 7 dias):
   contacto activo(20) + visita recente(20) + proposta activa(20)
   + negociação viva(20) + tentativas de contacto ≥2(20).
   Score cai se pipeline estagnado. Alertar se deal_momentum < 20 e score ≥70.
   Set by /api/offmarket-leads/[id]/deal-eval.';

-- ── Human Failure Flag ────────────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS human_failure_flag BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN offmarket_leads.human_failure_flag IS
  'TRUE quando o agente está a falhar SLAs críticos:
   SLA breach sem nenhum contacto tentado, OU
   score ≥70 sem visita após 72h, OU
   contacto feito mas sem follow-up em 48h.
   Diferente do deal_kill_flag: aqui o problema é o agente, não o lead.
   Set by /api/offmarket-leads/[id]/deal-eval.';

-- ── Time Waste Flag ───────────────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS time_waste_flag BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN offmarket_leads.time_waste_flag IS
  'TRUE quando o deal está a consumir atenção sem ROI possível:
   sem comprador matched + sem contacto + criado >72h + score <65, OU
   ≥4 tentativas de contacto sem resposta + sem buyer.
   Diferente do deal_kill: time_waste pode ser revertido se aparecer buyer ou contacto.
   Set by /api/offmarket-leads/[id]/deal-eval.';

-- ── Realistic CPCV Forecast Flag ─────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS realistic_cpcv_forecast_flag BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN offmarket_leads.realistic_cpcv_forecast_flag IS
  'TRUE quando o lead conta para o forecast de CPCV conservador (realista):
   visita feita (first_meeting_at NOT NULL)
   + buyer pressure HIGH
   + deal_readiness_score ≥60.
   Só estes leads entram no forecast €€ apresentado à direcção.
   Set by /api/offmarket-leads/[id]/deal-eval.';

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_offmarket_leads_discipline
  ON offmarket_leads (execution_discipline_score DESC NULLS LAST)
  WHERE execution_discipline_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_offmarket_leads_close_window
  ON offmarket_leads (close_window_score DESC NULLS LAST)
  WHERE close_window_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_offmarket_leads_human_failure
  ON offmarket_leads (human_failure_flag)
  WHERE human_failure_flag = TRUE;

CREATE INDEX IF NOT EXISTS idx_offmarket_leads_time_waste
  ON offmarket_leads (time_waste_flag)
  WHERE time_waste_flag = TRUE;

CREATE INDEX IF NOT EXISTS idx_offmarket_leads_realistic_cpcv
  ON offmarket_leads (realistic_cpcv_forecast_flag, price_ask DESC NULLS LAST)
  WHERE realistic_cpcv_forecast_flag = TRUE;

SELECT 'Migration 014 complete — Discipline Engine' AS status,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'offmarket_leads'
     AND column_name IN (
       'execution_discipline_score','close_window_score','deal_momentum_score',
       'human_failure_flag','time_waste_flag','realistic_cpcv_forecast_flag'
     )
  ) AS new_columns_added;

-- =================================================================
-- MIGRATION: 20260413_015_source_dedup_watchlist.sql
-- =================================================================

-- =============================================================================
-- Agency Group — Source Dedup + Watchlist + Gate States + Contact Acquisition
-- Migration: 20260413_015_source_dedup_watchlist
--
-- ADICIONA:
--
-- [A] DEDUPLICAÇÃO DE FONTES
--   duplicate_cluster_id      — UUID do grupo de duplicados (mesmo imóvel, fontes diferentes)
--   duplicate_confidence_score — 0-100 confiança que é duplicado
--   canonical_record_flag      — TRUE = este é o registo master do cluster
--
-- [B] WATCHLIST ENGINE
--   watchlist_flag             — TRUE = em vigilância activa (preço pode mover)
--   watchlist_reason           — porquê está em watchlist
--   watchlist_priority         — high/medium/low
--   recheck_after              — quando rever (ex: preço reduziu, owner mudou)
--   reprice_monitoring_flag    — monitorizar mudanças de preço activamente
--
-- [C] GATE ENTRY STATES
--   gate_status                — estado de entrada no pipeline
--
-- [D] CONTACT ACQUISITION
--   contact_research_status    — pending/researching/found/failed/skipped
--   contact_confidence_score   — 0-100 confiança no contacto encontrado
--   contact_source             — como foi obtido o contacto
--   contact_attempts_count     — total de tentativas de contacto feitas
--   next_contact_channel       — canal recomendado para próxima tentativa
-- =============================================================================

-- ── [A] DEDUPLICAÇÃO DE FONTES ────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS duplicate_cluster_id UUID;

COMMENT ON COLUMN offmarket_leads.duplicate_cluster_id IS
  'UUID do grupo de duplicados. Mesmo imóvel aparece em múltiplas fontes (Idealista + OLX + e-leiloes).
   Todos os registos do mesmo imóvel partilham o mesmo cluster_id.
   NULL = sem duplicados conhecidos.
   Set by /api/offmarket-leads/dedup.';

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS duplicate_confidence_score SMALLINT
    CHECK (duplicate_confidence_score IS NULL OR (duplicate_confidence_score BETWEEN 0 AND 100));

COMMENT ON COLUMN offmarket_leads.duplicate_confidence_score IS
  '0-100 confiança que este registo é duplicado de outro.
   Calculado por: match de endereço(40%) + match de área(30%) + match de preço±10%(30%).
   ≥80 = duplicado quase certo. 50-79 = possível. <50 = único.
   Set by /api/offmarket-leads/dedup.';

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS canonical_record_flag BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN offmarket_leads.canonical_record_flag IS
  'TRUE = este é o registo master do cluster de duplicados.
   FALSE = este é um duplicado secundário (não aparece no Deal Desk principal).
   Por omissão TRUE (único). Set by /api/offmarket-leads/dedup quando cluster formado.';

-- ── [B] WATCHLIST ENGINE ──────────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS watchlist_flag BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN offmarket_leads.watchlist_flag IS
  'TRUE = lead em vigilância activa.
   Usado para imóveis bons mas ainda fora de preço, owner não contactado, ou a aguardar evento.
   Separado do pipeline activo — não conta para KPIs de execução.';

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS watchlist_reason TEXT
    CHECK (watchlist_reason IS NULL OR watchlist_reason IN (
      'price_too_high',
      'owner_unreachable',
      'pending_legal',
      'pending_probate',
      'market_timing',
      'buyer_budget_mismatch',
      'renovation_risk',
      'other'
    ));

COMMENT ON COLUMN offmarket_leads.watchlist_reason IS
  'Motivo pelo qual está em watchlist:
   price_too_high — preço acima do mercado, aguarda redução.
   owner_unreachable — proprietário inacessível, rever em 30 dias.
   pending_legal — processo legal pendente (herança, partilha, etc.).
   pending_probate — sucessão/habilitação em curso.
   market_timing — aguardar janela de mercado.
   buyer_budget_mismatch — sem buyer neste ticket agora.
   renovation_risk — grande obra, aguardar orçamento/decisão buyer.
   other — outro motivo (ver notes).';

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS watchlist_priority TEXT DEFAULT 'medium'
    CHECK (watchlist_priority IN ('high', 'medium', 'low'));

COMMENT ON COLUMN offmarket_leads.watchlist_priority IS
  'high = rever em ≤7 dias (ex: preço a cair, evento iminente).
   medium = rever em ≤30 dias (padrão).
   low = rever em ≤90 dias (sem urgência aparente).';

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS recheck_after DATE;

COMMENT ON COLUMN offmarket_leads.recheck_after IS
  'Data a partir da qual rever o lead (YYYY-MM-DD).
   Cron diário verifica leads com recheck_after <= hoje e alerta agente.
   NULL = sem data definida de recheck.';

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS reprice_monitoring_flag BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN offmarket_leads.reprice_monitoring_flag IS
  'TRUE = monitorizar preço do imóvel (scraping legal permitido a cada 7 dias).
   Trigger alerta quando descida de preço ≥5%.
   Usar em leads com watchlist_reason = price_too_high.';

-- ── [C] GATE ENTRY STATES ─────────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS gate_status TEXT DEFAULT 'accepted_raw'
    CHECK (gate_status IN (
      'accepted_raw',       -- entrou no pipeline, ainda não avaliado
      'accepted_priority',  -- score ≥70, pipeline activo
      'rejected_noise',     -- descartado como ruído (duplicado, off-scope, etc.)
      'duplicate_secondary',-- duplicado não-canonical — visível mas inactivo
      'watchlist'           -- em watchlist, fora do pipeline activo
    ));

COMMENT ON COLUMN offmarket_leads.gate_status IS
  'Estado de entrada e classificação no pipeline:
   accepted_raw       — lead novo, aguarda score e avaliação (default).
   accepted_priority  — score ≥70 confirmado, entra no Deal Desk activo.
   rejected_noise     — descartado: fora de zona, preço inviável, dados incompletos.
   duplicate_secondary — registo duplicado não-master, não aparece no Deal Desk.
   watchlist          — imóvel interessante mas fora do timing activo.
   Set automatically by scoring + dedup routines.';

-- ── [D] CONTACT ACQUISITION ───────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS contact_research_status TEXT DEFAULT 'pending'
    CHECK (contact_research_status IN (
      'pending',      -- contacto ainda não pesquisado
      'researching',  -- a pesquisar (Sofia / manual)
      'found',        -- contacto encontrado com boa confiança
      'failed',       -- pesquisa falhou, sem contacto
      'skipped'       -- skipped (ex: lead rejeitado antes de pesquisa)
    ));

COMMENT ON COLUMN offmarket_leads.contact_research_status IS
  'Estado da pesquisa de contacto do proprietário.
   pending → researching → found/failed.
   Bloqueia execution se = pending/failed (execution_blocker_reason = no_contact).';

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS contact_confidence_score SMALLINT
    CHECK (contact_confidence_score IS NULL OR (contact_confidence_score BETWEEN 0 AND 100));

COMMENT ON COLUMN offmarket_leads.contact_confidence_score IS
  '0-100 confiança no contacto encontrado.
   ≥80 = contacto confirmado (número directo ou email verificado).
   50-79 = provável (LinkedIn, referência indirecta).
   <50 = incerto — não ligar sem verificar primeiro.';

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS contact_source TEXT
    CHECK (contact_source IS NULL OR contact_source IN (
      'listing_agent',   -- agente do anúncio
      'land_registry',   -- registo predial / conservatória
      'linkedin',        -- LinkedIn prospecting
      'referral',        -- referência de rede
      'sofia_research',  -- Sofia AI encontrou
      'manual',          -- entrada manual pelo agente
      'unknown'
    ));

COMMENT ON COLUMN offmarket_leads.contact_source IS
  'Como foi obtido o contacto.
   listing_agent = contacto via anúncio (menos directo, perda de comissão possível).
   land_registry = pesquisa em registo predial (mais directo, mais lento).
   linkedin = LinkedIn outreach (eficaz para proprietários corporate).
   referral = rede de contactos (melhor conversão).
   sofia_research = Sofia AI pesquisou automaticamente.';

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS contact_attempts_count SMALLINT DEFAULT 0
    CHECK (contact_attempts_count >= 0);

COMMENT ON COLUMN offmarket_leads.contact_attempts_count IS
  'Total de tentativas de contacto realizadas (todos os canais).
   ≥4 tentativas sem resposta → time_waste_flag = TRUE.
   Incrementado por /api/offmarket-leads/[id]/log-contact-attempt.';

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS next_contact_channel TEXT
    CHECK (next_contact_channel IS NULL OR next_contact_channel IN (
      'phone', 'whatsapp', 'email', 'sms', 'visit', 'letter'
    ));

COMMENT ON COLUMN offmarket_leads.next_contact_channel IS
  'Canal recomendado para a próxima tentativa de contacto.
   Rotação automática: phone → whatsapp → email → sms → visit.
   Set by deal-eval based on last_attempt_channel + contact_attempts_count.';

-- ── INDEXES ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_offmarket_dedup_cluster
  ON offmarket_leads (duplicate_cluster_id)
  WHERE duplicate_cluster_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_offmarket_canonical
  ON offmarket_leads (canonical_record_flag, composite_score DESC NULLS LAST)
  WHERE canonical_record_flag = TRUE;

CREATE INDEX IF NOT EXISTS idx_offmarket_watchlist
  ON offmarket_leads (watchlist_flag, recheck_after)
  WHERE watchlist_flag = TRUE;

CREATE INDEX IF NOT EXISTS idx_offmarket_recheck
  ON offmarket_leads (recheck_after)
  WHERE recheck_after IS NOT NULL AND watchlist_flag = TRUE;

CREATE INDEX IF NOT EXISTS idx_offmarket_gate_status
  ON offmarket_leads (gate_status, composite_score DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_offmarket_contact_research
  ON offmarket_leads (contact_research_status)
  WHERE contact_research_status IN ('pending', 'researching');

CREATE INDEX IF NOT EXISTS idx_offmarket_reprice
  ON offmarket_leads (reprice_monitoring_flag, last_scored_at)
  WHERE reprice_monitoring_flag = TRUE;

-- ── TRIGGER: auto gate_status from canonical + watchlist ─────────────────────

CREATE OR REPLACE FUNCTION fn_sync_gate_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Se marcado como watchlist, actualizar gate_status
  IF NEW.watchlist_flag = TRUE AND OLD.watchlist_flag = FALSE THEN
    NEW.gate_status := 'watchlist';
  END IF;
  -- Se marcado como duplicado não-canonical, actualizar gate_status
  IF NEW.canonical_record_flag = FALSE AND OLD.canonical_record_flag = TRUE THEN
    NEW.gate_status := 'duplicate_secondary';
  END IF;
  -- Se score ≥70 e canonical e activo, promover para priority
  IF NEW.composite_score >= 70
    AND NEW.canonical_record_flag = TRUE
    AND NEW.gate_status = 'accepted_raw'
  THEN
    NEW.gate_status := 'accepted_priority';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_gate_status ON offmarket_leads;
CREATE TRIGGER trg_sync_gate_status
  BEFORE UPDATE ON offmarket_leads
  FOR EACH ROW EXECUTE FUNCTION fn_sync_gate_status();

-- ── VERIFICATION ──────────────────────────────────────────────────────────────

SELECT 'Migration 015 complete — Source Dedup + Watchlist + Gate States + Contact Acquisition' AS status,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'offmarket_leads'
     AND column_name IN (
       'duplicate_cluster_id','duplicate_confidence_score','canonical_record_flag',
       'watchlist_flag','watchlist_reason','watchlist_priority',
       'recheck_after','reprice_monitoring_flag',
       'gate_status',
       'contact_research_status','contact_confidence_score','contact_source',
       'contact_attempts_count','next_contact_channel'
     )
  ) AS new_columns_added;

-- =================================================================
-- MIGRATION: 20260413_016_contact_intelligence.sql
-- =================================================================

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
