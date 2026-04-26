-- =============================================================================
-- Agency Group — Seed 30 Additional Properties
-- Brings total from ~25 → 55+ properties
-- Live schema columns: id (text, required), nome, zona, tipo, preco, area, quartos, status, descricao
-- tipo CHECK: Apartamento | Moradia | Villa | Penthouse | Quinta | Herdade
-- id: gen_random_uuid()::text (no default in live DB)
-- Safe: WHERE NOT EXISTS (no unique constraint on nome)
-- Run in Supabase SQL Editor
-- =============================================================================

INSERT INTO properties (id, nome, zona, tipo, preco, area, quartos, status, descricao)
SELECT gen_random_uuid()::text, v.nome, v.zona, v.tipo, v.preco, v.area, v.quartos, v.status, v.descricao
FROM (VALUES
-- ─── LISBOA ──────────────────────────────────────────────────────────────────
('Apartamento Avenidas Novas','Lisboa','Apartamento',395000,110,3,'active','T3 renovado em condomínio privativo com piscina. Cozinha equipada, varandas sul, garagem box.'),
('Penthouse Parque das Nações','Lisboa','Penthouse',1250000,195,4,'active','Duplex T4 com terraço privativo 60m² e vista rio. Condomínio premium com spa e ginásio.'),
('Moradia Lumiar','Lisboa','Moradia',890000,320,5,'active','Moradia V5 com jardim privado 400m². Piscina exterior, garagem tripla, domótica.'),
('Studio Cais do Sodré','Lisboa','Apartamento',185000,42,1,'active','Studio premium renovado com vista Tejo. Excelente para arrendamento turístico. AL activo.'),
('Apartamento Intendente','Lisboa','Apartamento',265000,75,2,'active','T2 em edifício pombalino restaurado. Tectos altos, soalho original, varanda. Zona em valorização.'),
('T3 Belém Riverside','Lisboa','Apartamento',720000,145,3,'active','T3 novo frente ao Tejo. Arquitectura contemporânea, varandas amplas, 2 garagens.'),
('Moradia Restelo Exclusiva','Lisboa','Moradia',2400000,480,6,'active','Moradia V6 em banda em zona nobre. Jardim, piscina interior, cinema privado. Mandato exclusivo.'),
('Apartamento Campo de Ourique','Lisboa','Apartamento',320000,85,2,'active','T2 luminoso com varanda sul. Piso 3 com elevador, remodelado 2023. Zona residencial premium.'),
-- ─── CASCAIS ─────────────────────────────────────────────────────────────────
('Villa Estoril Frontline','Cascais','Villa',1850000,380,5,'active','Villa V5 frente ao campo de golfe. Piscina aquecida, garagem 4 lugares, segurança 24h.'),
('Apartamento Cascais Centro','Cascais','Apartamento',620000,130,3,'active','T3 em condomínio fechado a 300m da marina. Terraço, piscina, 2 garagens.'),
('Quinta do Birre','Cascais','Quinta',3800000,850,7,'active','Quinta com 5000m² de terreno, casa principal V7 e casa de hóspedes. Cavalariças, lagoa privada.'),
('T2 Parede Praia','Cascais','Apartamento',315000,80,2,'active','T2 a 50m da praia da Parede. Vista mar, varanda, garagem. Arrendamento garantido na época.'),
('Townhouse Birre','Cascais','Moradia',780000,210,4,'active','Moradia em banda V4 em condomínio privativo. Jardim, garagem dupla, piscina partilhada.'),
('Penthouse Marina Cascais','Cascais','Penthouse',1650000,220,4,'active','T4+1 duplex com terraço 120m² e vista marina. 3 garagens, arrecadação, condomínio premium.'),
-- ─── ALGARVE ─────────────────────────────────────────────────────────────────
('Villa Vilamoura Golf','Algarve','Villa',1200000,280,4,'active','V4 em condomínio de luxo com vista campo de golfe. Piscina privada, jacuzzi, garagem tripla.'),
('Apartamento Meia Praia','Algarve','Apartamento',425000,105,3,'active','T3 renovado em resort a 100m da praia. Piscina, ténis, restaurante. Gestão de arrendamento incluída.'),
('Quinta Silves','Algarve','Quinta',950000,600,5,'active','Propriedade rural com casa V5 e 3 cottages. 12ha com horta biológica e oliveiras.'),
('Moradia Carvoeiro','Algarve','Moradia',685000,160,3,'active','V3 com vista mar em Carvoeiro. Piscina de sal, jardim paisagístico, terraço 360°.'),
('Loft Faro Histórico','Algarve','Apartamento',145000,55,1,'active','Loft T1 em edifício histórico no centro de Faro. Tecto abobadado, detalhes originais.'),
-- ─── PORTO ───────────────────────────────────────────────────────────────────
('Apartamento Foz do Douro','Porto','Apartamento',1350000,195,4,'active','T4 de luxo frente ao Oceano. Terraço, garagem tripla, acabamentos premium.'),
('Studio Porto Centro','Porto','Apartamento',165000,38,1,'active','Studio T0+1 renovado em Massarelos. Rooftop com vista para o Douro. Ideal Airbnb.'),
('Moradia Boavista','Porto','Moradia',920000,310,5,'active','V5 em condomínio fechado junto à Boavista. Jardim, piscina, garagem dupla.'),
('T2 Matosinhos Sul','Porto','Apartamento',280000,78,2,'active','T2 a 2 min da praia de Matosinhos Sul. Renovado 2023, varanda sul, lugar garagem.'),
('Apartamento Bonfim','Porto','Apartamento',215000,72,2,'active','T2 em zona em forte reabilitação. Alto potencial de valorização. Remodelação parcial.'),
-- ─── SINTRA / SETÚBAL ────────────────────────────────────────────────────────
('Quinta Sintra Serra','Sintra','Quinta',2800000,750,8,'active','Quinta histórica com casa principal V8 e casas secundárias. Parque privado 3ha. UNESCO.'),
('Moradia Sintra Village','Sintra','Moradia',565000,200,4,'active','Moradia V4 a 5 min do centro histórico. Jardim, lareira, vista Serra. Remodelação total 2022.'),
('Herdade Comporta','Setúbal','Herdade',4500000,1200,6,'active','Herdade 15ha com casa principal e 4 bungalows. Praia privada a 2km. Projecto turístico aprovado.'),
-- ─── MADEIRA ─────────────────────────────────────────────────────────────────
('Apartamento Funchal Marina','Madeira','Apartamento',380000,115,3,'active','T3 com vista marina do Funchal. Terraço, piscina, ginásio. 500m do centro histórico.'),
('Villa Palheiro','Madeira','Villa',1450000,340,5,'active','V5 em zona nobre do Palheiro. Vista 360° oceano e cidade. Piscina infinita, jardim tropical.'),
('Quinta Santana','Madeira','Quinta',520000,180,3,'active','Turismo rural V3 com 5000m² de terreno. Produção banana e vinha. Licença AL activa.')
) AS v(nome, zona, tipo, preco, area, quartos, status, descricao)
WHERE NOT EXISTS (
  SELECT 1 FROM properties p WHERE p.nome = v.nome
);

-- Verify final count
SELECT
  COUNT(*)                                    AS total_properties,
  COUNT(*) FILTER (WHERE status = 'active')  AS active,
  COUNT(*) FILTER (WHERE zona = 'Lisboa')    AS lisboa,
  COUNT(*) FILTER (WHERE zona = 'Cascais')   AS cascais,
  COUNT(*) FILTER (WHERE zona = 'Algarve')   AS algarve,
  COUNT(*) FILTER (WHERE zona = 'Porto')     AS porto,
  COUNT(*) FILTER (WHERE zona = 'Sintra')    AS sintra,
  COUNT(*) FILTER (WHERE zona = 'Madeira')   AS madeira
FROM properties;
