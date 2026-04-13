-- =============================================================================
-- Agency Group — Data Quality Engine
-- Migration: 20260413_017_data_quality
--
-- ADICIONA:
--   incomplete_data_flag     — input incompleto, não entra no pipeline principal
--   needs_enrichment_flag    — dados básicos OK mas faltam campos para score completo
--   high_quality_lead_flag   — lead com dados completos, score, buyer, price intel
--   data_quality_score       — 0-100 qualidade total dos dados do lead
--   city_normalized          — cidade normalizada (sem acentos, lowercase, canónica)
--   tipo_ativo_normalized    — tipo de activo normalizado (canonical form)
-- =============================================================================

-- ── Data Quality Flags ────────────────────────────────────────────────────────

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS incomplete_data_flag BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN offmarket_leads.incomplete_data_flag IS
  'TRUE quando faltam dados essenciais: cidade OU tipo_ativo em falta.
   Leads incompletos NÃO entram no pipeline de scoring/matching principal.
   Resolver antes de processar: preencher cidade + tipo_ativo no mínimo.';

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS needs_enrichment_flag BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN offmarket_leads.needs_enrichment_flag IS
  'TRUE quando dados básicos OK (cidade + tipo) mas faltam para score completo:
   price_ask em falta OU area_m2 em falta OU contacto em falta.
   Entra no pipeline mas com score inferior (dados insuficientes).
   Prioridade de enriquecimento: obter preço + área + contacto.';

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS high_quality_lead_flag BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN offmarket_leads.high_quality_lead_flag IS
  'TRUE quando lead tem dados completos:
   cidade ✓ + tipo_ativo ✓ + price_ask ✓ + area_m2 ✓
   + score calculado + buyer match feito + price intel calculado.
   Estes leads têm prioridade máxima no Deal Desk.';

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS data_quality_score SMALLINT DEFAULT 0
    CHECK (data_quality_score BETWEEN 0 AND 100);

COMMENT ON COLUMN offmarket_leads.data_quality_score IS
  '0-100 qualidade total dos dados:
   cidade(15) + tipo_ativo(15) + price_ask(15) + area_m2(10)
   + contacto(15) + score_calculado(10) + buyer_match(10) + price_intel(10).
   <40 = dados insuficientes.
   40-69 = dados parciais.
   ≥70 = dados suficientes para decisão.';

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS city_normalized TEXT;

COMMENT ON COLUMN offmarket_leads.city_normalized IS
  'Cidade normalizada para matching e dedup: lowercase, sem acentos, canónica.
   Ex: "Lisboa" → "lisboa", "Cascais" → "cascais", "PORTO" → "porto".
   Calculado automaticamente ao inserir/actualizar cidade.';

ALTER TABLE offmarket_leads
  ADD COLUMN IF NOT EXISTS tipo_ativo_normalized TEXT;

COMMENT ON COLUMN offmarket_leads.tipo_ativo_normalized IS
  'Tipo de activo normalizado: lowercase canónico.
   Ex: "Apartamento T4" → "apartamento", "MORADIA" → "moradia".
   Calculado automaticamente ao inserir/actualizar tipo_ativo.';

-- ── Auto-compute data quality on insert/update ────────────────────────────────

CREATE OR REPLACE FUNCTION fn_compute_data_quality()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  dq_score SMALLINT := 0;
BEGIN
  -- ── Normalize city ──────────────────────────────────────────────────
  IF NEW.cidade IS NOT NULL THEN
    NEW.city_normalized := lower(
      translate(trim(NEW.cidade),
        'àáâãäåèéêëìíîïòóôõöùúûüýÿÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÝçÇ',
        'aaaaaaeeeeiiiioooooouuuuyyAAAAAAEEEEIIIIOOOOOUUUUYcC'
      )
    );
  ELSE
    NEW.city_normalized := NULL;
  END IF;

  -- ── Normalize tipo_ativo ────────────────────────────────────────────
  IF NEW.tipo_ativo IS NOT NULL THEN
    NEW.tipo_ativo_normalized := lower(split_part(trim(NEW.tipo_ativo), ' ', 1));
  ELSE
    NEW.tipo_ativo_normalized := NULL;
  END IF;

  -- ── Data Quality Score ──────────────────────────────────────────────
  IF NEW.cidade IS NOT NULL AND NEW.cidade <> '' THEN dq_score := dq_score + 15; END IF;
  IF NEW.tipo_ativo IS NOT NULL AND NEW.tipo_ativo <> '' THEN dq_score := dq_score + 15; END IF;
  IF NEW.price_ask IS NOT NULL AND NEW.price_ask > 0 THEN dq_score := dq_score + 15; END IF;
  IF NEW.area_m2 IS NOT NULL AND NEW.area_m2 > 0 THEN dq_score := dq_score + 10; END IF;
  IF NEW.contacto IS NOT NULL OR NEW.contact_phone_owner IS NOT NULL THEN dq_score := dq_score + 15; END IF;
  IF NEW.score IS NOT NULL THEN dq_score := dq_score + 10; END IF;
  IF NEW.buyer_matched_at IS NOT NULL OR (NEW.matched_buyers_count IS NOT NULL AND NEW.matched_buyers_count > 0) THEN dq_score := dq_score + 10; END IF;
  IF NEW.gross_discount_pct IS NOT NULL THEN dq_score := dq_score + 10; END IF;
  NEW.data_quality_score := dq_score;

  -- ── Quality Flags ───────────────────────────────────────────────────
  -- incomplete: falta cidade ou tipo_ativo
  NEW.incomplete_data_flag := (
    NEW.cidade IS NULL OR NEW.cidade = '' OR
    NEW.tipo_ativo IS NULL OR NEW.tipo_ativo = ''
  );

  -- needs_enrichment: dados básicos OK mas incompletos
  NEW.needs_enrichment_flag := (
    NOT NEW.incomplete_data_flag AND
    (NEW.price_ask IS NULL OR NEW.area_m2 IS NULL OR
     (NEW.contacto IS NULL AND NEW.contact_phone_owner IS NULL))
  );

  -- high_quality: dados completos + avaliado
  NEW.high_quality_lead_flag := (
    NOT NEW.incomplete_data_flag AND
    NEW.price_ask IS NOT NULL AND NEW.area_m2 IS NOT NULL AND
    NEW.score IS NOT NULL AND NEW.gross_discount_pct IS NOT NULL AND
    (NEW.matched_buyers_count IS NOT NULL AND NEW.matched_buyers_count > 0)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compute_data_quality ON offmarket_leads;
CREATE TRIGGER trg_compute_data_quality
  BEFORE INSERT OR UPDATE OF cidade, tipo_ativo, price_ask, area_m2,
    contacto, contact_phone_owner, score, gross_discount_pct,
    matched_buyers_count, buyer_matched_at
  ON offmarket_leads
  FOR EACH ROW EXECUTE FUNCTION fn_compute_data_quality();

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_offmarket_data_quality
  ON offmarket_leads (data_quality_score DESC, score DESC NULLS LAST)
  WHERE incomplete_data_flag = FALSE;

CREATE INDEX IF NOT EXISTS idx_offmarket_high_quality
  ON offmarket_leads (high_quality_lead_flag, money_priority_score DESC NULLS LAST)
  WHERE high_quality_lead_flag = TRUE;

CREATE INDEX IF NOT EXISTS idx_offmarket_incomplete
  ON offmarket_leads (incomplete_data_flag, created_at DESC)
  WHERE incomplete_data_flag = TRUE;

CREATE INDEX IF NOT EXISTS idx_offmarket_city_normalized
  ON offmarket_leads (city_normalized)
  WHERE city_normalized IS NOT NULL;

-- ── Verification ─────────────────────────────────────────────────────────────

SELECT 'Migration 017 complete — Data Quality Engine' AS status,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'offmarket_leads'
     AND column_name IN (
       'incomplete_data_flag','needs_enrichment_flag','high_quality_lead_flag',
       'data_quality_score','city_normalized','tipo_ativo_normalized'
     )
  ) AS new_columns_added;
