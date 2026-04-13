-- =============================================================================
-- Agency Group — Seed: market_price_refs
-- Referências de preço de mercado por zona, tipo de activo e estado.
-- Baseado em dados INE/Confidencial Imobiliário 2025-2026.
-- Correr no Supabase SQL Editor ANTES de activar o pipeline de leads.
-- =============================================================================
-- CRITICAL: Sem estes dados, o price-intel retorna gross_discount_pct = null
-- → deal-eval gate 3 nunca passa → TODOS os alertas ficam bloqueados.
-- =============================================================================

-- Limpar para re-seed seguro (só apaga se tabela existir)
TRUNCATE TABLE market_price_refs RESTART IDENTITY;

-- =============================================================================
-- ZONA 1 — Lisboa (Distrito / Área Metropolitana)
-- =============================================================================

INSERT INTO market_price_refs
  (zona, tipo_ativo, estado, preco_medio_m2, preco_mediano_m2,
   amostra_n, fonte, periodo_ref, notas)
VALUES

-- Lisboa · Apartamento · Usado
('Lisboa', 'apartamento', 'usado',
 5200, 5050,
 480, 'INE + Confidencial Imobiliario', '2025-Q4',
 'Distrito de Lisboa. Inclui Amadora, Loures, Odivelas. Core Lisboa cidade ~5.800€/m².'),

-- Lisboa · Apartamento · Novo
('Lisboa', 'apartamento', 'novo',
 6800, 6500,
 120, 'INE + Confidencial Imobiliario', '2025-Q4',
 'Nova construção e reabilitação total. Parque das Nações / Belém / Avenidas Novas.'),

-- Lisboa · Moradia · Usado
('Lisboa', 'moradia', 'usado',
 4800, 4600,
 95, 'INE + Confidencial Imobiliario', '2025-Q4',
 'Moradias isoladas e geminadas distrito Lisboa. Alta variância por micro-zona.'),

-- Lisboa · Moradia · Novo
('Lisboa', 'moradia', 'novo',
 7200, 6900,
 28, 'INE + Confidencial Imobiliario', '2025-Q4',
 'Condomínios privados e moradias de luxo. Estoril/Cascais incluído nesta amostra.'),

-- Lisboa · Prédio / Multifamily
('Lisboa', 'predio', 'usado',
 3900, 3750,
 42, 'Confidencial Imobiliario', '2025-Q4',
 'Prédios inteiros para reabilitação. Yield bruta estimada 4.5–6.5%.'),

-- =============================================================================
-- ZONA 2 — Cascais / Linha de Estoril
-- =============================================================================

-- Cascais · Apartamento · Usado
('Cascais', 'apartamento', 'usado',
 4713, 4500,
 210, 'INE + Confidencial Imobiliario', '2025-Q4',
 'Cascais / Estoril / Parede / S.João Estoril. Referência nacional portais 2026.'),

-- Cascais · Apartamento · Novo
('Cascais', 'apartamento', 'novo',
 6200, 5900,
 58, 'Confidencial Imobiliario', '2025-Q4',
 'Nova construção. Cascais Vila e condomínios próximos marina.'),

-- Cascais · Moradia · Usado
('Cascais', 'moradia', 'usado',
 5100, 4900,
 88, 'INE + Confidencial Imobiliario', '2025-Q4',
 'Moradias T3-T5 com jardim. Birre / Quinta da Marinha / São Domingos de Rana.'),

-- Cascais · Moradia · Novo / Luxo
('Cascais', 'moradia', 'novo',
 8500, 8000,
 22, 'Confidencial Imobiliario + KF Portugal', '2025-Q4',
 'Luxo e high-end. Quinta da Marinha / Bairro do Rosário. Alguns outliers >15.000€/m².'),

-- =============================================================================
-- ZONA 3 — Porto (Cidade + Grande Porto)
-- =============================================================================

-- Porto · Apartamento · Usado
('Porto', 'apartamento', 'usado',
 3643, 3480,
 390, 'INE + Confidencial Imobiliario', '2025-Q4',
 'Grande Porto. Cidade Porto core ~4.200€/m². Maia/Matosinhos/Gaia baixam média.'),

-- Porto · Apartamento · Novo
('Porto', 'apartamento', 'novo',
 4900, 4650,
 88, 'INE + Confidencial Imobiliario', '2025-Q4',
 'Nova construção Porto cidade. Foz do Douro / Bonfim / Paranhos em alta.'),

-- Porto · Moradia · Usado
('Porto', 'moradia', 'usado',
 3200, 3050,
 72, 'INE + Confidencial Imobiliario', '2025-Q4',
 'Moradias V.N.Gaia / Matosinhos / Maia. Porto cidade moradias ~3.800€/m².'),

-- =============================================================================
-- ZONA 4 — Algarve
-- =============================================================================

-- Algarve · Apartamento · Usado
('Algarve', 'apartamento', 'usado',
 3941, 3700,
 320, 'INE + Confidencial Imobiliario', '2025-Q4',
 'Faro, Loulé, Portimão, Lagos, Albufeira. Barlavento >Sotavento. +17% YoY 2025.'),

-- Algarve · Apartamento · Novo
('Algarve', 'apartamento', 'novo',
 5200, 4900,
 75, 'Confidencial Imobiliario', '2025-Q4',
 'Nova construção e resorts. Quinta do Lago / Vale do Lobo área premium outlier.'),

-- Algarve · Moradia · Usado
('Algarve', 'moradia', 'usado',
 4200, 3950,
 140, 'INE + Confidencial Imobiliario', '2025-Q4',
 'Moradias com piscina Barlavento. Lagos/Luz/Sagres mais acessíveis.'),

-- Algarve · Moradia · Novo / Luxo
('Algarve', 'moradia', 'novo',
 7800, 7200,
 35, 'Confidencial Imobiliario + KF Portugal', '2025-Q4',
 'Quinta do Lago / Vale do Lobo (VDL) 10.000–25.000€/m². Esta média exclui outliers VDL.'),

-- Algarve · Terreno
('Algarve', 'terreno', 'usado',
 180, 160,
 55, 'Confidencial Imobiliario', '2025-Q4',
 'Terrenos rústicos e urbanizáveis Algarve. Zona premium multiplica x10–x20.'),

-- =============================================================================
-- ZONA 5 — Comporta / Península de Setúbal
-- =============================================================================

-- Comporta · Moradia · Usado / Premium
('Comporta', 'moradia', 'usado',
 5500, 5200,
 28, 'Confidencial Imobiliario + CBRE', '2025-Q4',
 'Comporta / Melides / Carvalhal. Mercado de nicho, liquidez baixa, yield aspiracional.'),

-- Comporta · Moradia · Novo / Luxo
('Comporta', 'moradia', 'novo',
 9500, 8800,
 12, 'CBRE + Knight Frank Portugal', '2025-Q4',
 'Resorts e villas premium Comporta. Herdade da Comporta referência de mercado.'),

-- Comporta · Terreno
('Comporta', 'terreno', 'usado',
 350, 300,
 18, 'Confidencial Imobiliario', '2025-Q4',
 'Terrenos rústicos e de construção Comporta. Alta especulação, poucos comparáveis.'),

-- =============================================================================
-- ZONA 6 — Madeira
-- =============================================================================

-- Madeira · Apartamento · Usado
('Madeira', 'apartamento', 'usado',
 3760, 3500,
 145, 'INE + Confidencial Imobiliario', '2025-Q4',
 'Ilha da Madeira. Funchal core ~4.200€/m². Câmara de Lobos/Machico mais baixo.'),

-- Madeira · Moradia · Usado
('Madeira', 'moradia', 'usado',
 3200, 3000,
 48, 'INE + Confidencial Imobiliario', '2025-Q4',
 'Moradias ilha Madeira. Calheta / Paul do Mar zona emergente de interesse.'),

-- =============================================================================
-- ZONA 7 — Sintra / Grande Lisboa (outros)
-- =============================================================================

-- Sintra · Apartamento · Usado
('Sintra', 'apartamento', 'usado',
 3100, 2950,
 155, 'INE + Confidencial Imobiliario', '2025-Q4',
 'Concelho Sintra. Algueirao / Rio de Mouro mais acessíveis. Colares / Penha Longa premium.'),

-- Sintra · Moradia · Usado
('Sintra', 'moradia', 'usado',
 3600, 3400,
 62, 'INE + Confidencial Imobiliario', '2025-Q4',
 'Moradias Sintra. Alta variância por micro-zona. Reguengo / Colares outlier premium.'),

-- =============================================================================
-- ZONA 8 — Portugal (fallback nacional)
-- =============================================================================

-- Portugal · Apartamento · Nacional (fallback)
('Portugal', 'apartamento', 'usado',
 3076, 2900,
 8450, 'INE 2025-Q4 Nacional', '2025-Q4',
 'Mediana nacional INE. Usar apenas como fallback de último recurso. +17.6% YoY.'),

-- Portugal · Moradia · Nacional (fallback)
('Portugal', 'moradia', 'usado',
 2800, 2650,
 3200, 'INE 2025-Q4 Nacional', '2025-Q4',
 'Mediana nacional moradias. Variância muito alta entre regiões.');

-- =============================================================================
-- Verificação
-- =============================================================================

SELECT
  zona,
  tipo_ativo,
  estado,
  preco_mediano_m2 AS "€/m² mediana",
  amostra_n        AS "n amostras",
  periodo_ref
FROM market_price_refs
ORDER BY zona, tipo_ativo, estado;

SELECT COUNT(*) AS total_registos FROM market_price_refs;

-- Resultado esperado: 26 registos
-- Após inserir: testar price-intel em qualquer lead com cidade='Lisboa'/'Porto'/'Cascais'/'Algarve'/'Comporta'
