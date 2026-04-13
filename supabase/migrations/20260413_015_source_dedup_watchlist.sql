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
