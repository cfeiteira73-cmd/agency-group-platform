-- =============================================================================
-- Agency Group — First Real Data Load Template
-- File: supabase/seeds/SEED_FIRST_DATA_TEMPLATE.sql
--
-- INSTRUÇÕES:
--   1. Abrir Supabase Dashboard → SQL Editor
--   2. Preencher CADA campo marcado com → ← com dado REAL
--   3. NÃO inventar dados — só inserir o que sabes com certeza
--   4. Campos NULL = informação que ainda não tens → obter depois
--   5. Executar por blocos (leads primeiro, depois buyers)
--
-- ALTERNATIVA: Usar o Portal → Off-Market Leads → "+ Nova Lead"
--   Basta: Cidade + Tipo de Ativo → sistema pontua e avalia tudo auto
--
-- ALTERNATIVA BUYER: Usar POST /api/buyers/create-minimal
--   Basta: nome + budget_max → sistema classifica tudo auto
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCO 1 — OFF-MARKET LEADS (5 templates reais)
-- Requisitos MÍNIMOS: cidade + tipo_ativo
-- Tudo o resto é bonus que melhora o score
-- ─────────────────────────────────────────────────────────────────────────────

-- LEAD 1 — Cascais T4 (preencher dados reais)
INSERT INTO offmarket_leads (
  nome, tipo_ativo, cidade, localizacao,
  area_m2, price_ask,
  contacto, contact_phone_owner, owner_name,
  urgency, source, source_network_type,
  notes,
  status, gate_status, score_status
) VALUES (
  'T4 Cascais',                    -- → nome descritivo (ex: "Vivenda T4 Quinta Patino")
  'Moradia',                        -- → tipo: Apartamento / Moradia / Terreno / Prédio / Loja
  'Cascais',                        -- cidade ✓ OBRIGATÓRIO
  NULL,                             -- → localização específica (ex: "Quinta da Marinha")
  NULL,                             -- → área m² (ex: 280)
  NULL,                             -- → preço pedido em € (ex: 1200000)
  NULL,                             -- → contacto livre (ex: "Via João Silva - mediador")
  NULL,                             -- → telefone direto dono (ex: "+351 912 345 678")
  NULL,                             -- → nome do proprietário
  'unknown',                        -- urgency: immediate / motivated / normal / unknown
  'manual',                         -- source: manual / network / referral / portal / scraping
  NULL,                             -- → rede (ex: "linkedin" / "referral" / "direct")
  NULL,                             -- → notas livres
  'new', 'accepted_raw', 'pending_score'
);

-- LEAD 2 — Lisboa Prédio (preencher dados reais)
INSERT INTO offmarket_leads (
  nome, tipo_ativo, cidade, localizacao,
  area_m2, price_ask,
  contacto, contact_phone_owner, owner_name,
  urgency, source, source_network_type,
  notes,
  status, gate_status, score_status
) VALUES (
  'Prédio Lisboa',                  -- → nome descritivo (ex: "Prédio Inteiro Mouraria 8 Fracções")
  'Prédio',                         -- → tipo
  'Lisboa',                         -- cidade ✓
  NULL,                             -- → bairro/zona (ex: "Mouraria" / "Alfama" / "Chiado")
  NULL,                             -- → área total m²
  NULL,                             -- → preço pedido € (ex: 2500000)
  NULL,                             -- → contacto
  NULL,                             -- → telefone dono
  NULL,                             -- → nome proprietário
  'unknown',
  'manual',
  NULL,
  NULL,
  'new', 'accepted_raw', 'pending_score'
);

-- LEAD 3 — Comporta Terreno (preencher dados reais)
INSERT INTO offmarket_leads (
  nome, tipo_ativo, cidade, localizacao,
  area_m2, price_ask,
  contacto, contact_phone_owner, owner_name,
  urgency, source, source_network_type,
  notes,
  status, gate_status, score_status
) VALUES (
  'Terreno Comporta',               -- → nome (ex: "Terreno Herdade Comporta 2.5ha")
  'Terreno',                        -- tipo
  'Comporta',                       -- cidade ✓
  NULL,                             -- → localização (ex: "Carvalhal" / "Pego")
  NULL,                             -- → área m² ou ha * 10000
  NULL,                             -- → preço € (ex: 1800000)
  NULL,
  NULL,
  NULL,
  'unknown',
  'manual',
  NULL,
  NULL,
  'new', 'accepted_raw', 'pending_score'
);

-- LEAD 4 — Porto Apartamento (preencher dados reais)
INSERT INTO offmarket_leads (
  nome, tipo_ativo, cidade, localizacao,
  area_m2, price_ask,
  contacto, contact_phone_owner, owner_name,
  urgency, source, source_network_type,
  notes,
  status, gate_status, score_status
) VALUES (
  'Apartamento Porto',              -- → nome (ex: "Duplex T3 Foz do Douro")
  'Apartamento',                    -- tipo
  'Porto',                          -- cidade ✓
  NULL,                             -- → zona (ex: "Foz" / "Bonfim" / "Cedofeita")
  NULL,                             -- → área m²
  NULL,                             -- → preço € (ex: 650000)
  NULL,
  NULL,
  NULL,
  'unknown',
  'manual',
  NULL,
  NULL,
  'new', 'accepted_raw', 'pending_score'
);

-- LEAD 5 — Algarve Moradia (preencher dados reais)
INSERT INTO offmarket_leads (
  nome, tipo_ativo, cidade, localizacao,
  area_m2, price_ask,
  contacto, contact_phone_owner, owner_name,
  urgency, source, source_network_type,
  notes,
  status, gate_status, score_status
) VALUES (
  'Moradia Algarve',                -- → nome (ex: "Villa T4 Quinta do Lago")
  'Moradia',                        -- tipo
  'Almancil',                       -- → cidade específica (ex: Almancil / Loulé / Vilamoura / Lagos)
  NULL,                             -- → resort/condomínio (ex: "Quinta do Lago" / "Vale do Lobo")
  NULL,                             -- → área m²
  NULL,                             -- → preço € (ex: 2200000)
  NULL,
  NULL,
  NULL,
  'unknown',
  'manual',
  NULL,
  NULL,
  'new', 'accepted_raw', 'pending_score'
);


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCO 2 — BUYERS / COMPRADORES (5 templates reais)
-- Requisitos MÍNIMOS: full_name + budget_max
-- ─────────────────────────────────────────────────────────────────────────────

-- BUYER 1 — Investor €500k–€1M Cascais
INSERT INTO contacts (
  full_name, name,
  phone, email,
  budget_min, budget_max,
  zonas, preferred_locations,
  buyer_type, liquidity_profile,
  active_status, status,
  notes, origin, last_contact_at
) VALUES (
  'Comprador A',                    -- → nome real do comprador
  'Comprador A',
  NULL,                             -- → telefone (ex: "+351 912 000 001")
  NULL,                             -- → email (ex: "investor@example.com")
  500000,                           -- → budget mínimo €
  1000000,                          -- → budget máximo €
  ARRAY['Cascais', 'Estoril'],      -- → zonas preferidas (ajustar)
  ARRAY['Cascais', 'Estoril'],
  'investor',                       -- buyer_type: investor / end_user / family_office / hnwi
  'unknown',                        -- liquidity: immediate / under_30_days / financed / unknown
  'active', 'active',
  NULL,                             -- → notas (ex: "Procura T3/T4 para arrendamento")
  'manual',
  NOW()
);

-- BUYER 2 — Investor €1M–€3M Lisboa
INSERT INTO contacts (
  full_name, name,
  phone, email,
  budget_min, budget_max,
  zonas, preferred_locations,
  buyer_type, liquidity_profile,
  active_status, status,
  notes, origin, last_contact_at
) VALUES (
  'Comprador B',                    -- → nome real
  'Comprador B',
  NULL,                             -- → telefone
  NULL,                             -- → email
  1000000,                          -- → budget mínimo €
  3000000,                          -- → budget máximo €
  ARRAY['Lisboa', 'Cascais'],       -- → zonas
  ARRAY['Lisboa', 'Cascais'],
  'investor',
  'unknown',
  'active', 'active',
  NULL,
  'manual',
  NOW()
);

-- BUYER 3 — Family Office €600k Cascais
INSERT INTO contacts (
  full_name, name,
  phone, email,
  budget_min, budget_max,
  zonas, preferred_locations,
  buyer_type, liquidity_profile,
  active_status, status,
  notes, origin, last_contact_at
) VALUES (
  'Family Office C',                -- → nome real / nome empresa
  'Family Office C',
  NULL,                             -- → telefone
  NULL,                             -- → email
  400000,                           -- → budget mínimo €
  600000,                           -- → budget máximo €
  ARRAY['Cascais'],                 -- → zonas
  ARRAY['Cascais'],
  'family_office',
  'unknown',
  'active', 'active',
  NULL,
  'manual',
  NOW()
);

-- BUYER 4 — Investor Comporta €2M
INSERT INTO contacts (
  full_name, name,
  phone, email,
  budget_min, budget_max,
  zonas, preferred_locations,
  buyer_type, liquidity_profile,
  active_status, status,
  notes, origin, last_contact_at
) VALUES (
  'Comprador D',                    -- → nome real
  'Comprador D',
  NULL,                             -- → telefone
  NULL,                             -- → email
  1500000,                          -- → budget mínimo €
  2000000,                          -- → budget máximo €
  ARRAY['Comporta', 'Melides', 'Grândola'],  -- → zonas
  ARRAY['Comporta', 'Melides', 'Grândola'],
  'investor',
  'unknown',
  'active', 'active',
  NULL,
  'manual',
  NOW()
);

-- BUYER 5 — Investor Porto €800k
INSERT INTO contacts (
  full_name, name,
  phone, email,
  budget_min, budget_max,
  zonas, preferred_locations,
  buyer_type, liquidity_profile,
  active_status, status,
  notes, origin, last_contact_at
) VALUES (
  'Comprador E',                    -- → nome real
  'Comprador E',
  NULL,                             -- → telefone
  NULL,                             -- → email
  500000,                           -- → budget mínimo €
  800000,                           -- → budget máximo €
  ARRAY['Porto', 'Foz do Douro', 'Matosinhos'],  -- → zonas
  ARRAY['Porto', 'Foz do Douro', 'Matosinhos'],
  'investor',
  'unknown',
  'active', 'active',
  NULL,
  'manual',
  NOW()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCO 3 — VERIFICAÇÃO APÓS INSERÇÃO
-- ─────────────────────────────────────────────────────────────────────────────

-- Ver leads inseridas
SELECT
  id, nome, cidade, tipo_ativo,
  price_ask, area_m2,
  data_quality_score,
  incomplete_data_flag, needs_enrichment_flag,
  score, status, created_at
FROM offmarket_leads
ORDER BY created_at DESC
LIMIT 10;

-- Ver buyers inseridos
SELECT
  id, full_name, buyer_type,
  budget_min, budget_max,
  zonas, liquidity_profile,
  buyer_score, buyer_tier, buyer_readiness_score,
  status, created_at
FROM contacts
WHERE origin = 'manual'
ORDER BY created_at DESC
LIMIT 10;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCO 4 — ACTIVAR PIPELINE VIA API (executar depois da inserção)
-- Copiar o lead_id e executar no terminal ou via Portal
-- ─────────────────────────────────────────────────────────────────────────────

-- Alternativa: criar directamente via API (portal faz isto automaticamente)
-- curl -X POST https://www.agencygroup.pt/api/offmarket-leads/manual \
--   -H "Content-Type: application/json" \
--   -H "Authorization: Bearer SEU_TOKEN" \
--   -d '{
--     "cidade": "Cascais",
--     "tipo_ativo": "Moradia",
--     "price_ask": 1200,
--     "area_m2": 280,
--     "contact_phone_owner": "+351912345678",
--     "owner_name": "Carlos Silva",
--     "urgency": "motivated",
--     "notes": "Proprietário quer vender em 60 dias. Herança."
--   }'

-- Alternativa buyer:
-- curl -X POST https://www.agencygroup.pt/api/buyers/create-minimal \
--   -H "Content-Type: application/json" \
--   -H "Authorization: Bearer SEU_TOKEN" \
--   -d '{
--     "nome": "João Ferreira",
--     "budget_max": 1200000,
--     "budget_min": 800000,
--     "zonas": ["Cascais", "Lisboa"],
--     "tipo": "investor",
--     "phone": "+351961234567",
--     "liquidity": "immediate"
--   }'
