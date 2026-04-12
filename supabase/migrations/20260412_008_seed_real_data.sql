-- =============================================================================
-- Agency Group — Real Data Seed Template
-- Migration 008 — FASE 14: Dados Reais para Operação
-- INSTRUÇÕES:
--   1. Substituir TODOS os valores placeholder por dados reais
--   2. Verificar que migrations 001–007 já foram executadas
--   3. Executar no Supabase SQL Editor
--   4. Depois correr: GET /api/buyers/score?force=true
--   5. Depois correr: POST /api/offmarket-leads/{id}/match-buyers para top 5 leads
-- =============================================================================

-- =============================================================================
-- BLOCO A — COMPRADORES REAIS (mínimo 20, obrigatório os campos marcados *)
-- Substitua os valores entre < > por dados reais
-- =============================================================================

DO $$
BEGIN
  -- Só insere se ainda não existirem compradores reais (non-test) com budget
  -- Remove esta guarda se quiser forçar reinserção

  -- ── COMPRADOR 1 ──────────────────────────────────────────────────────────
  INSERT INTO contacts (
    full_name, email, phone, whatsapp,
    role, status,
    lead_tier,      -- * A / B / C
    lead_score,
    budget_min,     -- * em euros
    budget_max,     -- * em euros
    preferred_locations,  -- * array de zonas
    typologies_wanted,    -- * array de tipos
    liquidity_profile,    -- * immediate / under_30_days / financed / unknown
    buyer_type,           -- individual / family_office / developer / fund / investor
    deals_closed_count,
    avg_close_days,
    notes, source
  ) VALUES (
    '<Nome Completo>',
    '<email@dominio.com>',
    '<+351912345678>',
    '<+351912345678>',
    'buyer', 'qualified',
    'A',   -- tier
    85,    -- lead_score estimado
    500000,   -- budget_min €
    1500000,  -- budget_max €
    ARRAY['Lisboa', 'Cascais', 'Sintra'],
    ARRAY['moradia', 'apartamento', 'villa'],
    'immediate',
    'individual',
    2,    -- deals fechados anteriormente
    45,   -- dias médios para fechar
    'Comprador qualificado — Lisboa premium. Proof of funds verificado.',
    'crm_real'
  ) ON CONFLICT (email) DO UPDATE SET
    budget_min         = EXCLUDED.budget_min,
    budget_max         = EXCLUDED.budget_max,
    preferred_locations = EXCLUDED.preferred_locations,
    typologies_wanted  = EXCLUDED.typologies_wanted,
    liquidity_profile  = EXCLUDED.liquidity_profile,
    lead_tier          = EXCLUDED.lead_tier,
    updated_at         = NOW();

  -- ── COMPRADOR 2 ──────────────────────────────────────────────────────────
  INSERT INTO contacts (
    full_name, email, phone, whatsapp,
    role, status, lead_tier, lead_score,
    budget_min, budget_max,
    preferred_locations, typologies_wanted,
    liquidity_profile, buyer_type,
    deals_closed_count, avg_close_days,
    notes, source
  ) VALUES (
    '<Nome Completo 2>',
    '<email2@dominio.com>',
    '<+351912345679>',
    '<+351912345679>',
    'buyer', 'active',
    'A', 78,
    800000, 3000000,
    ARRAY['Algarve', 'Vilamoura', 'Quinta do Lago', 'Vale do Lobo'],
    ARRAY['moradia', 'villa', 'quinta'],
    'immediate',
    'investor',
    5, 30,
    'Investidor Algarve premium. Fundo familiar. Proof of funds OK.',
    'crm_real'
  ) ON CONFLICT (email) DO UPDATE SET
    budget_min = EXCLUDED.budget_min, budget_max = EXCLUDED.budget_max,
    preferred_locations = EXCLUDED.preferred_locations, typologies_wanted = EXCLUDED.typologies_wanted,
    liquidity_profile = EXCLUDED.liquidity_profile, lead_tier = EXCLUDED.lead_tier, updated_at = NOW();

  -- ── COMPRADOR 3 ──────────────────────────────────────────────────────────
  INSERT INTO contacts (
    full_name, email, phone, role, status, lead_tier, lead_score,
    budget_min, budget_max, preferred_locations, typologies_wanted,
    liquidity_profile, buyer_type, notes, source
  ) VALUES (
    '<Nome Completo 3>', '<email3@dominio.com>', '<+351912345680>',
    'buyer', 'prospect', 'B', 65,
    200000, 700000,
    ARRAY['Porto', 'Foz do Douro', 'Matosinhos'],
    ARRAY['apartamento', 'moradia'],
    'financed', 'individual',
    'Comprador Porto. Aprovação bancária em curso.',
    'crm_real'
  ) ON CONFLICT (email) DO NOTHING;

  -- ── COMPRADOR 4 ──────────────────────────────────────────────────────────
  INSERT INTO contacts (
    full_name, email, phone, role, status, lead_tier, lead_score,
    budget_min, budget_max, preferred_locations, typologies_wanted,
    liquidity_profile, buyer_type, deals_closed_count, notes, source
  ) VALUES (
    '<Nome Completo 4>', '<email4@dominio.com>', '<+351912345681>',
    'buyer', 'vip', 'A', 92,
    1000000, 5000000,
    ARRAY['Lisboa', 'Cascais', 'Comporta', 'Alentejo'],
    ARRAY['moradia', 'quinta', 'hotel', 'villa'],
    'immediate', 'family_office', 8,
    'Family office. HNWI. Compradores reincidentes. Execução rápida comprovada.',
    'crm_real'
  ) ON CONFLICT (email) DO NOTHING;

  -- ── COMPRADOR 5 ──────────────────────────────────────────────────────────
  INSERT INTO contacts (
    full_name, email, phone, role, status, lead_tier, lead_score,
    budget_min, budget_max, preferred_locations, typologies_wanted,
    liquidity_profile, buyer_type, notes, source
  ) VALUES (
    '<Nome Completo 5>', '<email5@dominio.com>', '<+351912345682>',
    'buyer', 'qualified', 'B', 70,
    300000, 900000,
    ARRAY['Madeira', 'Funchal', 'Calheta'],
    ARRAY['moradia', 'apartamento', 'villa'],
    'under_30_days', 'individual',
    'Comprador Madeira. Liquidez em 30 dias.',
    'crm_real'
  ) ON CONFLICT (email) DO NOTHING;

  -- ── COMPRADORES 6–20: Copiar o bloco acima e ajustar dados ───────────────
  -- Mínimo obrigatório para operação real: 20 compradores com:
  --   budget_min, budget_max, preferred_locations, typologies_wanted, lead_tier, liquidity_profile

  RAISE NOTICE 'Seed compradores reais: inseridos com ON CONFLICT DO NOTHING — verificar dados';
END $$;


-- =============================================================================
-- BLOCO B — LEADS OFF-MARKET REAIS (mínimo 10)
-- Substituir valores entre < > por dados reais de leads capturadas
-- =============================================================================

DO $$
BEGIN
  -- ── LEAD 1 ───────────────────────────────────────────────────────────────
  INSERT INTO offmarket_leads (
    nome,           -- * nome da lead / referência
    tipo_ativo,     -- * moradia / apartamento / terreno / prédio / quinta / etc
    cidade,         -- * cidade principal
    localizacao,    -- zona/freguesia/morada aproximada
    area_m2,
    price_ask,      -- preço pedido pelo vendedor (ou NULL se desconhecido)
    price_estimate, -- estimativa AVM / avaliação interna
    score,          -- * 0-100 (scorer automático vai sobrescrever se score_status = pending_score)
    score_status,   -- scored / pending_score
    urgency,        -- immediate / high / medium / low / unknown
    status,         -- new / contacted / interested / etc
    contacto,       -- telemóvel ou email do vendedor
    owner_type,     -- individual / empresa / herança / fundo
    source,         -- fonte: manual / idealista / olx / parceiro / etc
    notes,
    assigned_to     -- email do advisor responsável
  ) VALUES (
    '<Nome da Propriedade ou Referência>',
    'moradia',
    '<Cidade>',
    '<Zona/Freguesia>',
    <area_m2>,      -- ex: 320
    <price_ask>,    -- ex: 1200000
    <price_estimate>, -- ex: 1150000
    <score>,        -- ex: 75 (ou NULL para pending_score)
    'scored',
    'high',
    'new',
    '<+351912345683>',
    'individual',
    'manual',
    '<Notas internas sobre a lead>',
    '<advisor@agencygroup.pt>'
  ) ON CONFLICT DO NOTHING;

  -- ── LEAD 2 ───────────────────────────────────────────────────────────────
  INSERT INTO offmarket_leads (
    nome, tipo_ativo, cidade, localizacao, area_m2,
    price_ask, price_estimate, score, score_status, urgency,
    status, contacto, owner_type, source, notes, assigned_to
  ) VALUES (
    '<Nome Lead 2>', 'apartamento', '<Cidade>', '<Zona>',
    <area>, <price_ask>, <price_est>, <score>, 'scored',
    'medium', 'new', '<contacto>', 'individual', 'manual',
    '<notas>', '<advisor@agencygroup.pt>'
  ) ON CONFLICT DO NOTHING;

  -- ── LEADS 3–10: Copiar bloco acima com dados reais ───────────────────────
  -- Mínimo 10 leads para ter P0/P1/preclose visíveis no Deal Desk

  RAISE NOTICE 'Seed leads reais: verificar inserção';
END $$;


-- =============================================================================
-- BLOCO C — PARCEIROS INSTITUCIONAIS REAIS (mínimo 3)
-- nivel_prioridade: 'A' (topo), 'B' (médio), 'C' (baixo)  ← TEXT não integer
-- estado: 'prospect' | 'contactado' | 'reuniao_feita' | 'parceiro_activo' | 'dormente' | 'inactivo'
-- origem: 'evento' | 'referral' | 'linkedin' | 'cold_outreach' | 'portal' | 'conference' | 'introducao_directa' | 'outro'
-- =============================================================================

DO $$
BEGIN
  INSERT INTO institutional_partners (
    nome, empresa, tipo, cidade,
    email, phone,
    nivel_prioridade,  -- 'A' (máximo), 'B' (médio), 'C' (baixo)
    estado,            -- 'parceiro_activo' / 'contactado' / 'reuniao_feita' / 'prospect'
    notes, origem
  ) VALUES
  (
    '<Nome Parceiro 1>', '<Escritório de Advogados / Banco / Solicitador>',
    'advogado',  -- advogado / contabilista / banco / gestor_patrimonio / notario / solicitador
    '<Cidade>',
    '<email@parceiro.pt>', '<+351912345684>',
    'A', 'parceiro_activo',
    'Advogado especializado em imobiliário. Referencia clientes recorrentemente.',
    'referral'
  ),
  (
    '<Nome Parceiro 2>', '<Empresa>',
    'contabilista', '<Cidade>',
    '<email@parceiro2.pt>', '<+351912345685>',
    'B', 'reuniao_feita',
    'Contabilista com clientela de alto valor. Operações de herança e reestruturação.',
    'linkedin'
  ),
  (
    '<Nome Parceiro 3>', '<Empresa>',
    'gestor_patrimonio', '<Cidade>',
    '<email@parceiro3.pt>', '<+351912345686>',
    'A', 'parceiro_activo',
    'Gestor de patrimônio. Múltiplos clientes HNWI com mandato de compra.',
    'introducao_directa'
  )
  ON CONFLICT (email) DO NOTHING;

  RAISE NOTICE 'Seed parceiros institucionais: inseridos';
END $$;


-- =============================================================================
-- BLOCO D — PÓS-SEED: COMANDOS A EXECUTAR (via API, não SQL)
-- =============================================================================
-- Depois de executar este script:
--
-- 1. Correr batch buyer scoring:
--    GET https://agencygroup.pt/api/buyers/score?limit=100&force=true
--    (ou aguardar cron das 06:00 UTC dias úteis)
--
-- 2. Correr scoring das leads sem score:
--    GET https://agencygroup.pt/api/offmarket-leads/score?limit=100&only_pending=true
--
-- 3. Correr matching nas top 5 leads (score > 60):
--    POST https://agencygroup.pt/api/offmarket-leads/{lead_id}/match-buyers
--    (repetir para cada lead_id com score alto)
--
-- 4. Verificar no portal:
--    /portal → Deal Desk → Execução Diária
--    Deve mostrar P0/P1 reais com attack_recommendation preenchida
--
-- 5. Verificar buyer pool:
--    GET https://agencygroup.pt/api/buyers/pool
--    Deve retornar summary com tier_a > 0

-- =============================================================================
-- BLOCO E — VALIDAÇÃO (executar após seed + scoring)
-- =============================================================================

-- Verificar compradores com score preenchido:
-- SELECT full_name, lead_tier, buyer_score, budget_min, budget_max,
--        preferred_locations, typologies_wanted, liquidity_profile
-- FROM contacts
-- WHERE role = 'buyer' AND budget_max IS NOT NULL
-- ORDER BY buyer_score DESC NULLS LAST
-- LIMIT 20;

-- Verificar leads com buyer match:
-- SELECT nome, score, matched_buyers_count, best_buyer_match_score,
--        attack_recommendation, deal_priority_score
-- FROM offmarket_leads
-- WHERE score >= 50
-- ORDER BY deal_priority_score DESC NULLS LAST, score DESC
-- LIMIT 10;

-- Verificar buyer pool view:
-- SELECT * FROM buyer_pool LIMIT 5;

-- Verificar audit view:
-- SELECT * FROM buyer_pool_audit ORDER BY buyer_readiness_score DESC LIMIT 10;
