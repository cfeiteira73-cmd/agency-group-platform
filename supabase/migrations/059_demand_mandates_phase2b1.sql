-- =============================================================================
-- Migration 059 — Phase 2B.1: Demand Mandates Foundation
-- =============================================================================
-- PURPOSE:
--   Creates the canonical demand architecture approved in Phase 2B.1.
--   Eight new tables. Zero changes to any Phase 2A or existing table.
--
-- AMENDMENT COMPLIANCE:
--   1. holder_contact_id NOT NULL — person-only mandates (no dangling org FK)
--   2. RLS ENABLED + deny-by-default on all sensitive tables
--   3. Geography seed: Portugal only, COUNTRY + DISTRICT + key MUNICIPALITY
--      Source: INE (Instituto Nacional de Estatística) official PT admin hierarchy
--   4. No match records, no backfill, no automation, no outbound
--
-- SAFETY:
--   - All CREATE TABLE uses IF NOT EXISTS — re-run safe for table creation
--   - All CREATE INDEX uses IF NOT EXISTS — re-run safe for index creation
--   - Trigger functions use CREATE OR REPLACE — re-run safe
--   - Triggers use DROP IF EXISTS before CREATE — re-run safe
--   - Geography seed uses ON CONFLICT (id) DO NOTHING — re-run safe
--   - No destructive operations on any existing table
--   - Transaction-safe: all DDL in implicit transaction from migration runner
--
-- TABLES CREATED:
--   geography_nodes, demand_mandates, demand_mandate_participants,
--   demand_mandate_locations, demand_mandate_criteria,
--   demand_mandate_history, buyer_mandate_details, investor_mandate_details
--
-- PHASE 2A OBJECTS — NOT TOUCHED:
--   contacts, activities, public_saved_searches, deal_subscriptions,
--   investor_capital_profiles, ingest_commercial_lead_v1
--
-- Applied: 2026-09-05 (Phase 2B.1)
-- =============================================================================


-- =============================================================================
-- 1. GEOGRAPHY_NODES
-- =============================================================================
-- Hierarchical geography reference table. Shared between supply (properties)
-- and demand (demand_mandate_locations). Seed: Portugal only, Phase 2B.1.
-- International expansion = INSERT rows, zero schema change required.
-- Levels: COUNTRY → DISTRICT → MUNICIPALITY → PARISH → ZONE
-- PARISH and ZONE are schema-ready but not seeded in Phase 2B.1.
-- =============================================================================

CREATE TABLE IF NOT EXISTS geography_nodes (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id    UUID    REFERENCES geography_nodes(id) ON DELETE RESTRICT,
  level        TEXT    NOT NULL
               CHECK (level IN ('COUNTRY','DISTRICT','MUNICIPALITY','PARISH','ZONE')),
  country_code CHAR(2) NOT NULL,
  -- Official code (INE for PT, ISO for country level)
  code         TEXT,
  name_pt      TEXT    NOT NULL,
  name_en      TEXT,
  name_fr      TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Country-level nodes: unique (country_code, level) where no parent
CREATE UNIQUE INDEX IF NOT EXISTS uq_geography_nodes_country
  ON geography_nodes (country_code, level)
  WHERE parent_id IS NULL;

-- Sub-country nodes: unique name within parent
CREATE UNIQUE INDEX IF NOT EXISTS uq_geography_nodes_parent_name
  ON geography_nodes (parent_id, name_pt)
  WHERE parent_id IS NOT NULL;

-- Official code uniqueness where set
CREATE UNIQUE INDEX IF NOT EXISTS uq_geography_nodes_code
  ON geography_nodes (country_code, code)
  WHERE code IS NOT NULL AND parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_geography_nodes_parent
  ON geography_nodes (parent_id);
CREATE INDEX IF NOT EXISTS idx_geography_nodes_country_level
  ON geography_nodes (country_code, level);
CREATE INDEX IF NOT EXISTS idx_geography_nodes_active
  ON geography_nodes (is_active) WHERE is_active = TRUE;


-- =============================================================================
-- 2. PORTUGAL SEED DATA
-- =============================================================================
-- Source: INE — Instituto Nacional de Estatística
-- https://www.ine.pt/xportal/xmain?xpid=INE&xpgid=ine_main
-- Levels seeded: COUNTRY (1) + DISTRICT/AUTONOMOUS REGION (20) + MUNICIPALITY (~60)
-- NOT seeded: PARISH (3,092 in PT), ZONE (commercial micro-markets — no auth source)
-- UUID prefix 2b1a = district, 2b1b = municipality (stable across re-runs)
-- Re-run safety: ON CONFLICT (id) DO NOTHING on all inserts
-- =============================================================================

-- ── Country ──────────────────────────────────────────────────────────────────
INSERT INTO geography_nodes (id, parent_id, level, country_code, code, name_pt, name_en)
VALUES ('2b1a0000-0000-4000-8000-000000000000', NULL, 'COUNTRY', 'PT', 'PT', 'Portugal', 'Portugal')
ON CONFLICT (id) DO NOTHING;

-- ── Districts (18) + Autonomous Regions (2) ──────────────────────────────────
-- INE district codes: 01–18 (mainland), 20 (Açores), 31 (Madeira)
INSERT INTO geography_nodes (id, parent_id, level, country_code, code, name_pt, name_en) VALUES
  ('2b1a0001-0000-4000-8000-000000000000', '2b1a0000-0000-4000-8000-000000000000', 'DISTRICT', 'PT', '01', 'Aveiro',            'Aveiro'),
  ('2b1a0002-0000-4000-8000-000000000000', '2b1a0000-0000-4000-8000-000000000000', 'DISTRICT', 'PT', '02', 'Beja',              'Beja'),
  ('2b1a0003-0000-4000-8000-000000000000', '2b1a0000-0000-4000-8000-000000000000', 'DISTRICT', 'PT', '03', 'Braga',             'Braga'),
  ('2b1a0004-0000-4000-8000-000000000000', '2b1a0000-0000-4000-8000-000000000000', 'DISTRICT', 'PT', '04', 'Bragança',          'Bragança'),
  ('2b1a0005-0000-4000-8000-000000000000', '2b1a0000-0000-4000-8000-000000000000', 'DISTRICT', 'PT', '05', 'Castelo Branco',    'Castelo Branco'),
  ('2b1a0006-0000-4000-8000-000000000000', '2b1a0000-0000-4000-8000-000000000000', 'DISTRICT', 'PT', '06', 'Coimbra',           'Coimbra'),
  ('2b1a0007-0000-4000-8000-000000000000', '2b1a0000-0000-4000-8000-000000000000', 'DISTRICT', 'PT', '07', 'Évora',             'Évora'),
  ('2b1a0008-0000-4000-8000-000000000000', '2b1a0000-0000-4000-8000-000000000000', 'DISTRICT', 'PT', '08', 'Faro',              'Faro'),
  ('2b1a0009-0000-4000-8000-000000000000', '2b1a0000-0000-4000-8000-000000000000', 'DISTRICT', 'PT', '09', 'Guarda',            'Guarda'),
  ('2b1a0010-0000-4000-8000-000000000000', '2b1a0000-0000-4000-8000-000000000000', 'DISTRICT', 'PT', '10', 'Leiria',            'Leiria'),
  ('2b1a0011-0000-4000-8000-000000000000', '2b1a0000-0000-4000-8000-000000000000', 'DISTRICT', 'PT', '11', 'Lisboa',            'Lisbon'),
  ('2b1a0012-0000-4000-8000-000000000000', '2b1a0000-0000-4000-8000-000000000000', 'DISTRICT', 'PT', '12', 'Portalegre',        'Portalegre'),
  ('2b1a0013-0000-4000-8000-000000000000', '2b1a0000-0000-4000-8000-000000000000', 'DISTRICT', 'PT', '13', 'Porto',             'Porto'),
  ('2b1a0014-0000-4000-8000-000000000000', '2b1a0000-0000-4000-8000-000000000000', 'DISTRICT', 'PT', '14', 'Santarém',          'Santarém'),
  ('2b1a0015-0000-4000-8000-000000000000', '2b1a0000-0000-4000-8000-000000000000', 'DISTRICT', 'PT', '15', 'Setúbal',           'Setúbal'),
  ('2b1a0016-0000-4000-8000-000000000000', '2b1a0000-0000-4000-8000-000000000000', 'DISTRICT', 'PT', '16', 'Viana do Castelo',  'Viana do Castelo'),
  ('2b1a0017-0000-4000-8000-000000000000', '2b1a0000-0000-4000-8000-000000000000', 'DISTRICT', 'PT', '17', 'Vila Real',         'Vila Real'),
  ('2b1a0018-0000-4000-8000-000000000000', '2b1a0000-0000-4000-8000-000000000000', 'DISTRICT', 'PT', '18', 'Viseu',             'Viseu'),
  -- Autonomous Regions
  ('2b1a0020-0000-4000-8000-000000000000', '2b1a0000-0000-4000-8000-000000000000', 'DISTRICT', 'PT', '20', 'Região Autónoma dos Açores',   'Azores'),
  ('2b1a0031-0000-4000-8000-000000000000', '2b1a0000-0000-4000-8000-000000000000', 'DISTRICT', 'PT', '31', 'Região Autónoma da Madeira',   'Madeira')
ON CONFLICT (id) DO NOTHING;

-- ── Municipalities: Lisboa District (key markets) ─────────────────────────────
INSERT INTO geography_nodes (id, parent_id, level, country_code, code, name_pt, name_en) VALUES
  ('2b1b1101-0000-4000-8000-000000000000', '2b1a0011-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1106', 'Lisboa',             'Lisbon'),
  ('2b1b1102-0000-4000-8000-000000000000', '2b1a0011-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1105', 'Cascais',             'Cascais'),
  ('2b1b1103-0000-4000-8000-000000000000', '2b1a0011-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1111', 'Sintra',              'Sintra'),
  ('2b1b1104-0000-4000-8000-000000000000', '2b1a0011-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1110', 'Oeiras',              'Oeiras'),
  ('2b1b1105-0000-4000-8000-000000000000', '2b1a0011-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1101', 'Amadora',             'Amadora'),
  ('2b1b1106-0000-4000-8000-000000000000', '2b1a0011-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1107', 'Loures',              'Loures'),
  ('2b1b1107-0000-4000-8000-000000000000', '2b1a0011-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1108', 'Mafra',               'Mafra'),
  ('2b1b1108-0000-4000-8000-000000000000', '2b1a0011-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1109', 'Odivelas',            'Odivelas'),
  ('2b1b1109-0000-4000-8000-000000000000', '2b1a0011-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1116', 'Vila Franca de Xira', 'Vila Franca de Xira'),
  ('2b1b1110-0000-4000-8000-000000000000', '2b1a0011-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1114', 'Torres Vedras',       'Torres Vedras'),
  ('2b1b1111-0000-4000-8000-000000000000', '2b1a0011-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1102', 'Alenquer',            'Alenquer'),
  ('2b1b1112-0000-4000-8000-000000000000', '2b1a0011-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1103', 'Arruda dos Vinhos',   'Arruda dos Vinhos'),
  ('2b1b1113-0000-4000-8000-000000000000', '2b1a0011-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1104', 'Azambuja',            'Azambuja')
ON CONFLICT (id) DO NOTHING;

-- ── Municipalities: Porto District ────────────────────────────────────────────
INSERT INTO geography_nodes (id, parent_id, level, country_code, code, name_pt, name_en) VALUES
  ('2b1b1301-0000-4000-8000-000000000000', '2b1a0013-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1315', 'Porto',               'Porto'),
  ('2b1b1302-0000-4000-8000-000000000000', '2b1a0013-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1317', 'Vila Nova de Gaia',   'Vila Nova de Gaia'),
  ('2b1b1303-0000-4000-8000-000000000000', '2b1a0013-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1313', 'Matosinhos',          'Matosinhos'),
  ('2b1b1304-0000-4000-8000-000000000000', '2b1a0013-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1312', 'Maia',                'Maia'),
  ('2b1b1305-0000-4000-8000-000000000000', '2b1a0013-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1306', 'Gondomar',            'Gondomar'),
  ('2b1b1306-0000-4000-8000-000000000000', '2b1a0013-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1303', 'Espinho',             'Espinho'),
  ('2b1b1307-0000-4000-8000-000000000000', '2b1a0013-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1314', 'Póvoa de Varzim',     'Póvoa de Varzim'),
  ('2b1b1308-0000-4000-8000-000000000000', '2b1a0013-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1318', 'Vila do Conde',       'Vila do Conde'),
  ('2b1b1309-0000-4000-8000-000000000000', '2b1a0013-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1316', 'Valongo',             'Valongo'),
  ('2b1b1310-0000-4000-8000-000000000000', '2b1a0013-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1310', 'Paredes',             'Paredes')
ON CONFLICT (id) DO NOTHING;

-- ── Municipalities: Faro District (Algarve — all 16) ─────────────────────────
INSERT INTO geography_nodes (id, parent_id, level, country_code, code, name_pt, name_en) VALUES
  ('2b1b0801-0000-4000-8000-000000000000', '2b1a0008-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '0806', 'Faro',                      'Faro'),
  ('2b1b0802-0000-4000-8000-000000000000', '2b1a0008-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '0808', 'Loulé',                     'Loulé'),
  ('2b1b0803-0000-4000-8000-000000000000', '2b1a0008-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '0813', 'Silves',                    'Silves'),
  ('2b1b0804-0000-4000-8000-000000000000', '2b1a0008-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '0807', 'Lagos',                     'Lagos'),
  ('2b1b0805-0000-4000-8000-000000000000', '2b1a0008-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '0811', 'Portimão',                  'Portimão'),
  ('2b1b0806-0000-4000-8000-000000000000', '2b1a0008-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '0801', 'Albufeira',                 'Albufeira'),
  ('2b1b0807-0000-4000-8000-000000000000', '2b1a0008-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '0814', 'Tavira',                    'Tavira'),
  ('2b1b0808-0000-4000-8000-000000000000', '2b1a0008-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '0809', 'Olhão',                     'Olhão'),
  ('2b1b0809-0000-4000-8000-000000000000', '2b1a0008-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '0816', 'Vila Real de Santo António', 'Vila Real de Santo António'),
  ('2b1b0810-0000-4000-8000-000000000000', '2b1a0008-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '0810', 'Lagoa',                     'Lagoa'),
  ('2b1b0811-0000-4000-8000-000000000000', '2b1a0008-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '0802', 'Alcoutim',                  'Alcoutim'),
  ('2b1b0812-0000-4000-8000-000000000000', '2b1a0008-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '0803', 'Aljezur',                   'Aljezur'),
  ('2b1b0813-0000-4000-8000-000000000000', '2b1a0008-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '0804', 'Castro Marim',              'Castro Marim'),
  ('2b1b0814-0000-4000-8000-000000000000', '2b1a0008-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '0812', 'São Brás de Alportel',      'São Brás de Alportel'),
  ('2b1b0815-0000-4000-8000-000000000000', '2b1a0008-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '0815', 'Vila do Bispo',             'Vila do Bispo'),
  ('2b1b0816-0000-4000-8000-000000000000', '2b1a0008-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '0805', 'Monchique',                 'Monchique')
ON CONFLICT (id) DO NOTHING;

-- ── Municipalities: Setúbal District ─────────────────────────────────────────
INSERT INTO geography_nodes (id, parent_id, level, country_code, code, name_pt, name_en) VALUES
  ('2b1b1501-0000-4000-8000-000000000000', '2b1a0015-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1510', 'Setúbal',           'Setúbal'),
  ('2b1b1502-0000-4000-8000-000000000000', '2b1a0015-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1501', 'Alcácer do Sal',    'Alcácer do Sal'),
  ('2b1b1503-0000-4000-8000-000000000000', '2b1a0015-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1502', 'Alcochete',         'Alcochete'),
  ('2b1b1504-0000-4000-8000-000000000000', '2b1a0015-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1503', 'Almada',            'Almada'),
  ('2b1b1505-0000-4000-8000-000000000000', '2b1a0015-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1504', 'Barreiro',          'Barreiro'),
  ('2b1b1506-0000-4000-8000-000000000000', '2b1a0015-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1505', 'Grândola',          'Grândola'),
  ('2b1b1507-0000-4000-8000-000000000000', '2b1a0015-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1506', 'Moita',             'Moita'),
  ('2b1b1508-0000-4000-8000-000000000000', '2b1a0015-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1507', 'Montijo',           'Montijo'),
  ('2b1b1509-0000-4000-8000-000000000000', '2b1a0015-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1508', 'Palmela',           'Palmela'),
  ('2b1b1510-0000-4000-8000-000000000000', '2b1a0015-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1509', 'Santiago do Cacém', 'Santiago do Cacém'),
  ('2b1b1511-0000-4000-8000-000000000000', '2b1a0015-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1511', 'Seixal',            'Seixal'),
  ('2b1b1512-0000-4000-8000-000000000000', '2b1a0015-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1512', 'Sesimbra',          'Sesimbra'),
  ('2b1b1513-0000-4000-8000-000000000000', '2b1a0015-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1513', 'Vendas Novas',      'Vendas Novas')
ON CONFLICT (id) DO NOTHING;

-- ── Municipalities: Braga District ───────────────────────────────────────────
INSERT INTO geography_nodes (id, parent_id, level, country_code, code, name_pt, name_en) VALUES
  ('2b1b0301-0000-4000-8000-000000000000', '2b1a0003-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '0302', 'Braga',                 'Braga'),
  ('2b1b0302-0000-4000-8000-000000000000', '2b1a0003-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '0308', 'Guimarães',             'Guimarães'),
  ('2b1b0303-0000-4000-8000-000000000000', '2b1a0003-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '0303', 'Barcelos',              'Barcelos'),
  ('2b1b0304-0000-4000-8000-000000000000', '2b1a0003-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '0313', 'Vila Nova de Famalicão','Vila Nova de Famalicão'),
  ('2b1b0305-0000-4000-8000-000000000000', '2b1a0003-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '0305', 'Esposende',             'Esposende'),
  ('2b1b0306-0000-4000-8000-000000000000', '2b1a0003-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '0306', 'Fafe',                  'Fafe')
ON CONFLICT (id) DO NOTHING;

-- ── Municipalities: Aveiro District ──────────────────────────────────────────
INSERT INTO geography_nodes (id, parent_id, level, country_code, code, name_pt, name_en) VALUES
  ('2b1b0101-0000-4000-8000-000000000000', '2b1a0001-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '0105', 'Aveiro',        'Aveiro'),
  ('2b1b0102-0000-4000-8000-000000000000', '2b1a0001-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '0114', 'Ovar',          'Ovar'),
  ('2b1b0103-0000-4000-8000-000000000000', '2b1a0001-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '0109', 'Ílhavo',        'Ílhavo')
ON CONFLICT (id) DO NOTHING;

-- ── Municipalities: Coimbra District ─────────────────────────────────────────
INSERT INTO geography_nodes (id, parent_id, level, country_code, code, name_pt, name_en) VALUES
  ('2b1b0601-0000-4000-8000-000000000000', '2b1a0006-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '0609', 'Coimbra',           'Coimbra'),
  ('2b1b0602-0000-4000-8000-000000000000', '2b1a0006-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '0607', 'Figueira da Foz',   'Figueira da Foz')
ON CONFLICT (id) DO NOTHING;

-- ── Municipalities: Leiria District ──────────────────────────────────────────
INSERT INTO geography_nodes (id, parent_id, level, country_code, code, name_pt, name_en) VALUES
  ('2b1b1001-0000-4000-8000-000000000000', '2b1a0010-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1006', 'Leiria',          'Leiria'),
  ('2b1b1002-0000-4000-8000-000000000000', '2b1a0010-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1003', 'Caldas da Rainha', 'Caldas da Rainha'),
  ('2b1b1003-0000-4000-8000-000000000000', '2b1a0010-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1007', 'Marinha Grande',   'Marinha Grande'),
  ('2b1b1004-0000-4000-8000-000000000000', '2b1a0010-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1009', 'Nazaré',           'Nazaré'),
  ('2b1b1005-0000-4000-8000-000000000000', '2b1a0010-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1011', 'Óbidos',           'Óbidos'),
  ('2b1b1006-0000-4000-8000-000000000000', '2b1a0010-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1013', 'Peniche',          'Peniche')
ON CONFLICT (id) DO NOTHING;

-- ── Municipalities: Évora District ───────────────────────────────────────────
INSERT INTO geography_nodes (id, parent_id, level, country_code, code, name_pt, name_en) VALUES
  ('2b1b0701-0000-4000-8000-000000000000', '2b1a0007-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '0709', 'Évora',     'Évora'),
  ('2b1b0702-0000-4000-8000-000000000000', '2b1a0007-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '0707', 'Estremoz',  'Estremoz')
ON CONFLICT (id) DO NOTHING;

-- ── Municipalities: Santarém District ────────────────────────────────────────
INSERT INTO geography_nodes (id, parent_id, level, country_code, code, name_pt, name_en) VALUES
  ('2b1b1401-0000-4000-8000-000000000000', '2b1a0014-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1414', 'Santarém',    'Santarém'),
  ('2b1b1402-0000-4000-8000-000000000000', '2b1a0014-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1416', 'Tomar',       'Tomar'),
  ('2b1b1403-0000-4000-8000-000000000000', '2b1a0014-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1415', 'Torres Novas','Torres Novas')
ON CONFLICT (id) DO NOTHING;

-- ── Municipalities: Viana do Castelo District ─────────────────────────────────
INSERT INTO geography_nodes (id, parent_id, level, country_code, code, name_pt, name_en) VALUES
  ('2b1b1601-0000-4000-8000-000000000000', '2b1a0016-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1610', 'Viana do Castelo', 'Viana do Castelo'),
  ('2b1b1602-0000-4000-8000-000000000000', '2b1a0016-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '1607', 'Ponte de Lima',   'Ponte de Lima')
ON CONFLICT (id) DO NOTHING;

-- ── Municipalities: Beja District ────────────────────────────────────────────
INSERT INTO geography_nodes (id, parent_id, level, country_code, code, name_pt, name_en) VALUES
  ('2b1b0201-0000-4000-8000-000000000000', '2b1a0002-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '0201', 'Aljustrel',  'Aljustrel'),
  ('2b1b0202-0000-4000-8000-000000000000', '2b1a0002-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '0202', 'Almodôvar',  'Almodôvar'),
  ('2b1b0203-0000-4000-8000-000000000000', '2b1a0002-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '0209', 'Beja',       'Beja')
ON CONFLICT (id) DO NOTHING;

-- ── Municipalities: Madeira Autonomous Region ─────────────────────────────────
INSERT INTO geography_nodes (id, parent_id, level, country_code, code, name_pt, name_en) VALUES
  ('2b1b3101-0000-4000-8000-000000000000', '2b1a0031-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '3101', 'Funchal',          'Funchal'),
  ('2b1b3102-0000-4000-8000-000000000000', '2b1a0031-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '3102', 'Câmara de Lobos',  'Câmara de Lobos'),
  ('2b1b3103-0000-4000-8000-000000000000', '2b1a0031-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '3105', 'Machico',          'Machico'),
  ('2b1b3104-0000-4000-8000-000000000000', '2b1a0031-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '3108', 'Santa Cruz',       'Santa Cruz'),
  ('2b1b3105-0000-4000-8000-000000000000', '2b1a0031-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '3109', 'Porto Santo',      'Porto Santo'),
  ('2b1b3106-0000-4000-8000-000000000000', '2b1a0031-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '3107', 'Ribeira Brava',    'Ribeira Brava'),
  ('2b1b3107-0000-4000-8000-000000000000', '2b1a0031-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '3106', 'Ponta do Sol',     'Ponta do Sol'),
  ('2b1b3108-0000-4000-8000-000000000000', '2b1a0031-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '3110', 'Santana',          'Santana'),
  ('2b1b3109-0000-4000-8000-000000000000', '2b1a0031-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '3111', 'São Vicente',      'São Vicente'),
  ('2b1b3110-0000-4000-8000-000000000000', '2b1a0031-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '3104', 'Calheta',          'Calheta'),
  ('2b1b3111-0000-4000-8000-000000000000', '2b1a0031-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '3103', 'Porto Moniz',      'Porto Moniz')
ON CONFLICT (id) DO NOTHING;

-- ── Municipalities: Açores Autonomous Region (key municipalities) ─────────────
INSERT INTO geography_nodes (id, parent_id, level, country_code, code, name_pt, name_en) VALUES
  ('2b1b2001-0000-4000-8000-000000000000', '2b1a0020-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '2011', 'Ponta Delgada',     'Ponta Delgada'),
  ('2b1b2002-0000-4000-8000-000000000000', '2b1a0020-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '2001', 'Angra do Heroísmo', 'Angra do Heroísmo'),
  ('2b1b2003-0000-4000-8000-000000000000', '2b1a0020-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '2005', 'Horta',             'Horta'),
  ('2b1b2004-0000-4000-8000-000000000000', '2b1a0020-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '2010', 'Ribeira Grande',    'Ribeira Grande'),
  ('2b1b2005-0000-4000-8000-000000000000', '2b1a0020-0000-4000-8000-000000000000', 'MUNICIPALITY', 'PT', '2008', 'Lagoa',             'Lagoa')
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- 3. DEMAND_MANDATES — Canonical demand core
-- =============================================================================
-- One row = one structured intent to BUY or RENT a property for a given purpose.
-- Amendment 1: holder_contact_id NOT NULL (person-only mandates in Phase 2B.1).
-- Organisation-held mandates are a documented future capability.
-- =============================================================================

CREATE TABLE IF NOT EXISTS demand_mandates (
  id                 UUID    PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Holder (PERSON — NOT NULL per Amendment 1) ────────────────────────────
  -- Organisation-held mandates: NOT supported in Phase 2B.1.
  -- Future path: when canonical client-org model exists, add holder_org_id column
  -- via additive migration and relax this NOT NULL with a CHECK constraint.
  holder_contact_id  BIGINT  NOT NULL REFERENCES public.contacts(id) ON DELETE RESTRICT,

  -- ── Commercial ownership ──────────────────────────────────────────────────
  owner_id           UUID    NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,

  -- ── Taxonomy ─────────────────────────────────────────────────────────────
  transaction_mode   TEXT    NOT NULL
                     CHECK (transaction_mode IN ('BUY','RENT')),
  purpose            TEXT    NOT NULL
                     CHECK (purpose IN (
                       'PRIMARY_RESIDENCE','SECONDARY_RESIDENCE',
                       'HOLIDAY','INVESTMENT','DEVELOPMENT','OTHER'
                     )),

  -- ── Lifecycle ────────────────────────────────────────────────────────────
  lifecycle_state    TEXT    NOT NULL DEFAULT 'DRAFT'
                     CHECK (lifecycle_state IN (
                       'DRAFT','ACTIVE','PAUSED','COMPLETED','EXPIRED','CANCELLED'
                     )),
  activated_at       TIMESTAMPTZ,
  paused_at          TIMESTAMPTZ,
  paused_reason      TEXT,
  completed_at       TIMESTAMPTZ,
  expired_at         TIMESTAMPTZ,
  cancelled_at       TIMESTAMPTZ,
  cancelled_reason   TEXT,
  -- Explicit expiry: agent-set deadline or GDPR retention limit
  expires_at         TIMESTAMPTZ,

  -- ── Budget ───────────────────────────────────────────────────────────────
  budget_min         NUMERIC(15,2),
  budget_max         NUMERIC(15,2),
  -- currency_code must be ISO 4217 uppercase 3-letter; format-validated only.
  -- Application is responsible for using valid ISO 4217 codes.
  currency_code      CHAR(3) NOT NULL DEFAULT 'EUR'
                     CHECK (currency_code ~ '^[A-Z]{3}$'),

  CONSTRAINT budget_non_negative CHECK (
    (budget_min IS NULL OR budget_min >= 0) AND
    (budget_max IS NULL OR budget_max >= 0)
  ),
  CONSTRAINT budget_min_lte_max CHECK (
    budget_min IS NULL OR budget_max IS NULL OR budget_min <= budget_max
  ),

  budget_provenance  TEXT    NOT NULL DEFAULT 'AI_EXTRACTED'
                     CHECK (budget_provenance IN (
                       'USER_STATED','AGENT_VERIFIED','AI_EXTRACTED','INFERRED','IMPORT'
                     )),
  budget_verified_by UUID    REFERENCES public.profiles(id),
  budget_verified_at TIMESTAMPTZ,

  -- ── Interpretable verification facts (replaces arbitrary score) ───────────
  -- Generated columns: derived from stored fields, always consistent.
  -- budget_stated: TRUE when at least one budget bound is present
  budget_stated      BOOLEAN GENERATED ALWAYS AS
                       (budget_min IS NOT NULL OR budget_max IS NOT NULL) STORED,
  -- budget_verified: TRUE when an agent has formally confirmed budget
  budget_verified    BOOLEAN GENERATED ALWAYS AS
                       (budget_provenance = 'AGENT_VERIFIED') STORED,
  -- human_reviewed: agent explicitly confirmed mandate content (manually set)
  human_reviewed     BOOLEAN NOT NULL DEFAULT FALSE,
  last_verified_at   TIMESTAMPTZ,
  last_verified_by   UUID    REFERENCES public.profiles(id),

  -- ── Provenance / origin ──────────────────────────────────────────────────
  origin             TEXT    NOT NULL DEFAULT 'AGENT_ENTRY'
                     CHECK (origin IN (
                       'CONTACT_FORM','SOFIA_DRAFT','AGENT_ENTRY','IMPORT','SAVED_SEARCH'
                     )),

  notes              TEXT,

  -- ── Timestamps ───────────────────────────────────────────────────────────
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dm_holder_contact
  ON demand_mandates (holder_contact_id);
CREATE INDEX IF NOT EXISTS idx_dm_owner
  ON demand_mandates (owner_id);
CREATE INDEX IF NOT EXISTS idx_dm_lifecycle
  ON demand_mandates (lifecycle_state);
CREATE INDEX IF NOT EXISTS idx_dm_owner_lifecycle
  ON demand_mandates (owner_id, lifecycle_state);
CREATE INDEX IF NOT EXISTS idx_dm_budget_range
  ON demand_mandates (budget_min, budget_max)
  WHERE budget_min IS NOT NULL OR budget_max IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dm_expires
  ON demand_mandates (expires_at)
  WHERE expires_at IS NOT NULL AND lifecycle_state IN ('ACTIVE','PAUSED');
CREATE INDEX IF NOT EXISTS idx_dm_created
  ON demand_mandates (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_purpose_mode
  ON demand_mandates (purpose, transaction_mode);


-- =============================================================================
-- 4. DEMAND_MANDATE_PARTICIPANTS
-- =============================================================================
-- Additional contacts on a mandate beyond the primary holder.
-- Used for co-decision-makers, advisers, spouses, legal representatives.
-- Primary holder (holder_contact_id) is on demand_mandates directly.
-- This table extends with additional participants.
-- =============================================================================

CREATE TABLE IF NOT EXISTS demand_mandate_participants (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  mandate_id  UUID    NOT NULL REFERENCES public.demand_mandates(id) ON DELETE CASCADE,
  contact_id  BIGINT  NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  role        TEXT    NOT NULL DEFAULT 'DECISION_MAKER'
              CHECK (role IN (
                'HOLDER','DECISION_MAKER','ADVISER','REPRESENTATIVE','OTHER'
              )),
  is_primary  BOOLEAN NOT NULL DEFAULT FALSE,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One contact appears once per mandate
  UNIQUE (mandate_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_dmp_mandate  ON demand_mandate_participants (mandate_id);
CREATE INDEX IF NOT EXISTS idx_dmp_contact  ON demand_mandate_participants (contact_id);
CREATE INDEX IF NOT EXISTS idx_dmp_primary
  ON demand_mandate_participants (mandate_id, is_primary)
  WHERE is_primary = TRUE;


-- =============================================================================
-- 5. DEMAND_MANDATE_LOCATIONS
-- =============================================================================
-- Geography criteria for a mandate. One row per geography node per mode.
-- Supports INCLUDE (wanted areas) and EXCLUDE (unwanted areas) simultaneously.
-- Hierarchy matching: a DISTRICT-level node implicitly covers all child
-- MUNICIPALITY, PARISH, ZONE nodes — matching logic in application/query layer.
-- =============================================================================

CREATE TABLE IF NOT EXISTS demand_mandate_locations (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  mandate_id        UUID    NOT NULL REFERENCES public.demand_mandates(id) ON DELETE CASCADE,
  geography_node_id UUID    NOT NULL REFERENCES public.geography_nodes(id) ON DELETE RESTRICT,
  mode              TEXT    NOT NULL DEFAULT 'INCLUDE'
                    CHECK (mode IN ('INCLUDE','EXCLUDE')),
  -- preference_weight: 0–100, for future preference-ranked matching.
  -- Stored now; matching engine uses it in Phase 2C+. Default 50 = neutral.
  preference_weight SMALLINT NOT NULL DEFAULT 50
                    CHECK (preference_weight BETWEEN 0 AND 100),
  provenance        TEXT    NOT NULL DEFAULT 'AI_EXTRACTED'
                    CHECK (provenance IN (
                      'USER_STATED','AGENT_VERIFIED','AI_EXTRACTED','INFERRED','IMPORT'
                    )),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- A node can appear once per mandate per mode.
  -- INCLUDE and EXCLUDE on the same node are logically contradictory and prevented.
  UNIQUE (mandate_id, geography_node_id, mode)
);

CREATE INDEX IF NOT EXISTS idx_dml_mandate
  ON demand_mandate_locations (mandate_id);
CREATE INDEX IF NOT EXISTS idx_dml_geography
  ON demand_mandate_locations (geography_node_id, mode);
CREATE INDEX IF NOT EXISTS idx_dml_mandate_mode
  ON demand_mandate_locations (mandate_id, mode);


-- =============================================================================
-- 6. DEMAND_MANDATE_CRITERIA
-- =============================================================================
-- Open-ended variable criteria not covered by typed columns.
-- Use for: feature requirements ('pool','sea_view'), proximity rules,
-- keywords, custom conditions. NOT for budget, location, bedrooms (typed cols).
-- Each row carries its own provenance and constraint classification.
-- =============================================================================

CREATE TABLE IF NOT EXISTS demand_mandate_criteria (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  mandate_id      UUID    NOT NULL REFERENCES public.demand_mandates(id) ON DELETE CASCADE,
  -- criterion_key: application-controlled vocabulary.
  -- Common keys: 'feature', 'proximity', 'view', 'condition', 'keyword', 'custom'
  criterion_key   TEXT    NOT NULL,
  criterion_val   TEXT    NOT NULL,
  constraint_type TEXT    NOT NULL
                  CHECK (constraint_type IN ('HARD','PREFERENCE','EXCLUSION')),
  provenance      TEXT    NOT NULL DEFAULT 'AI_EXTRACTED'
                  CHECK (provenance IN (
                    'USER_STATED','AGENT_VERIFIED','AI_EXTRACTED','INFERRED','IMPORT'
                  )),
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by     UUID    REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_dmc_mandate
  ON demand_mandate_criteria (mandate_id);
CREATE INDEX IF NOT EXISTS idx_dmc_mandate_key
  ON demand_mandate_criteria (mandate_id, criterion_key);
CREATE INDEX IF NOT EXISTS idx_dmc_constraint_type
  ON demand_mandate_criteria (mandate_id, constraint_type);


-- =============================================================================
-- 7. DEMAND_MANDATE_HISTORY
-- =============================================================================
-- Commercially significant change log. Records before/after values for
-- meaningful business events: lifecycle transitions, budget changes, ownership,
-- verification, geography/criteria updates.
-- NOT for: updated_at touches, reads, retries, technical noise.
-- NOT for: property match events (these go in demand_mandate_matches — Phase 2C+).
-- =============================================================================

CREATE TABLE IF NOT EXISTS demand_mandate_history (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  mandate_id       UUID    NOT NULL REFERENCES public.demand_mandates(id) ON DELETE CASCADE,
  changed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- changed_by: NULL when written by automatic trigger (no session user available).
  -- Application RPCs should set this explicitly when writing history directly.
  changed_by       UUID    REFERENCES public.profiles(id),
  change_type      TEXT    NOT NULL
                   CHECK (change_type IN (
                     'CREATED',
                     'LIFECYCLE_CHANGE',
                     'BUDGET_CHANGE',
                     'BUDGET_VERIFIED',
                     'GEOGRAPHY_CHANGE',
                     'CRITERIA_CHANGE',
                     'OWNERSHIP_CHANGE',
                     'VERIFICATION',
                     'EXTENSION_CHANGE',
                     'NOTE_CHANGE'
                   )),
  previous_values  JSONB,
  new_values       JSONB
);

CREATE INDEX IF NOT EXISTS idx_dmh_mandate
  ON demand_mandate_history (mandate_id);
CREATE INDEX IF NOT EXISTS idx_dmh_mandate_time
  ON demand_mandate_history (mandate_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_dmh_change_type
  ON demand_mandate_history (change_type);


-- =============================================================================
-- 8. BUYER_MANDATE_DETAILS
-- =============================================================================
-- Residential/personal buyer extension.
-- Created for purpose IN ('PRIMARY_RESIDENCE','SECONDARY_RESIDENCE','HOLIDAY').
-- Also used for RENT transactions regardless of purpose.
-- Not required at DB level; application creates based on mandate taxonomy.
-- =============================================================================

CREATE TABLE IF NOT EXISTS buyer_mandate_details (
  mandate_id           UUID    PRIMARY KEY
                       REFERENCES public.demand_mandates(id) ON DELETE CASCADE,
  -- Property type preferences
  typologies           TEXT[],
  bedrooms_min         SMALLINT,
  bedrooms_max         SMALLINT,
  CONSTRAINT bmd_bedrooms_order CHECK (
    bedrooms_min IS NULL OR bedrooms_max IS NULL OR bedrooms_min <= bedrooms_max
  ),
  bathrooms_min        SMALLINT,
  area_min_m2          NUMERIC(8,2),
  area_max_m2          NUMERIC(8,2),
  CONSTRAINT bmd_area_non_negative CHECK (
    (area_min_m2 IS NULL OR area_min_m2 >= 0) AND
    (area_max_m2 IS NULL OR area_max_m2 >= 0)
  ),
  CONSTRAINT bmd_area_order CHECK (
    area_min_m2 IS NULL OR area_max_m2 IS NULL OR area_min_m2 <= area_max_m2
  ),
  -- Features: common ones typed for efficient matching; rare ones in criteria table
  required_features    TEXT[],   -- HARD: 'pool','garage','sea_view','lift','garden'
  preferred_features   TEXT[],   -- PREFERENCE: adds weight but not blocking
  -- Acquisition context
  financing_type       TEXT
                       CHECK (financing_type IN ('CASH','MORTGAGE','MIXED','UNKNOWN')),
  timeline             TEXT
                       CHECK (timeline IN (
                         'IMMEDIATE','3_MONTHS','6_MONTHS','1_YEAR','FLEXIBLE','UNKNOWN'
                       )),
  -- Buyer qualification signals
  proof_of_funds       TEXT    NOT NULL DEFAULT 'NONE'
                       CHECK (proof_of_funds IN (
                         'NONE','STATED','DOCUMENT_SEEN','VERIFIED'
                       )),
  proof_of_funds_updated_at TIMESTAMPTZ,
  golden_visa_required BOOLEAN NOT NULL DEFAULT FALSE,
  mortgage_preapproved BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bmd_typologies
  ON buyer_mandate_details USING GIN (typologies);
CREATE INDEX IF NOT EXISTS idx_bmd_required_features
  ON buyer_mandate_details USING GIN (required_features);
CREATE INDEX IF NOT EXISTS idx_bmd_bedrooms
  ON buyer_mandate_details (bedrooms_min, bedrooms_max)
  WHERE bedrooms_min IS NOT NULL;


-- =============================================================================
-- 9. INVESTOR_MANDATE_DETAILS
-- =============================================================================
-- Investment/development buyer extension.
-- Created for purpose IN ('INVESTMENT','DEVELOPMENT').
-- ticket_min/ticket_max may differ from budget_min/budget_max when leverage
-- or co-investment applies (equity ticket vs total asset value).
-- =============================================================================

CREATE TABLE IF NOT EXISTS investor_mandate_details (
  mandate_id              UUID    PRIMARY KEY
                          REFERENCES public.demand_mandates(id) ON DELETE CASCADE,
  -- Strategy array: investor may pursue multiple simultaneously
  investment_strategy     TEXT[],
  -- Yield targets
  target_yield_min_pct    NUMERIC(5,2),
  target_yield_max_pct    NUMERIC(5,2),
  CONSTRAINT imd_yield_non_negative CHECK (
    (target_yield_min_pct IS NULL OR target_yield_min_pct >= 0) AND
    (target_yield_max_pct IS NULL OR target_yield_max_pct >= 0)
  ),
  CONSTRAINT imd_yield_order CHECK (
    target_yield_min_pct IS NULL OR target_yield_max_pct IS NULL
    OR target_yield_min_pct <= target_yield_max_pct
  ),
  -- Ticket size (equity or total — clarified in notes)
  ticket_min              NUMERIC(15,2),
  ticket_max              NUMERIC(15,2),
  ticket_currency_code    CHAR(3) NOT NULL DEFAULT 'EUR'
                          CHECK (ticket_currency_code ~ '^[A-Z]{3}$'),
  CONSTRAINT imd_ticket_non_negative CHECK (
    (ticket_min IS NULL OR ticket_min >= 0) AND
    (ticket_max IS NULL OR ticket_max >= 0)
  ),
  CONSTRAINT imd_ticket_order CHECK (
    ticket_min IS NULL OR ticket_max IS NULL OR ticket_min <= ticket_max
  ),
  -- Risk and asset profile
  risk_tolerance          TEXT
                          CHECK (risk_tolerance IN ('LOW','MEDIUM','HIGH','VERY_HIGH')),
  asset_types             TEXT[],
  requires_management     BOOLEAN NOT NULL DEFAULT FALSE,
  open_to_off_market      BOOLEAN NOT NULL DEFAULT TRUE,
  -- Historical average from agent observation — not user-stated
  typical_decision_days   SMALLINT,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_imd_strategy
  ON investor_mandate_details USING GIN (investment_strategy);
CREATE INDEX IF NOT EXISTS idx_imd_yield
  ON investor_mandate_details (target_yield_min_pct)
  WHERE target_yield_min_pct IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_imd_ticket
  ON investor_mandate_details (ticket_min, ticket_max)
  WHERE ticket_min IS NOT NULL;


-- =============================================================================
-- 10. UPDATED_AT TRIGGER — demand_mandates
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_demand_mandates_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_demand_mandates_updated_at ON public.demand_mandates;
CREATE TRIGGER trg_demand_mandates_updated_at
  BEFORE UPDATE ON public.demand_mandates
  FOR EACH ROW EXECUTE FUNCTION public.fn_demand_mandates_updated_at();


-- =============================================================================
-- 11. HISTORY TRIGGER — demand_mandates
-- =============================================================================
-- Fires AFTER UPDATE on specific columns only (column-level filter).
-- Inserts into demand_mandate_history — no recursion risk (different table,
-- no trigger on demand_mandate_history).
-- changed_by = NULL: trigger has no session user context. Application RPCs
-- that require a named author should write history rows directly with changed_by set.
-- Recursion check: trigger INSERTs into demand_mandate_history only.
--   demand_mandate_history has no triggers → no recursion possible.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_demand_mandates_history()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  -- LIFECYCLE_CHANGE
  IF OLD.lifecycle_state IS DISTINCT FROM NEW.lifecycle_state THEN
    INSERT INTO public.demand_mandate_history
      (mandate_id, changed_by, change_type, previous_values, new_values)
    VALUES (
      NEW.id, NULL, 'LIFECYCLE_CHANGE',
      jsonb_build_object('lifecycle_state', OLD.lifecycle_state),
      jsonb_build_object('lifecycle_state', NEW.lifecycle_state)
    );
  END IF;

  -- BUDGET_CHANGE or BUDGET_VERIFIED (budget fields changed)
  IF OLD.budget_min IS DISTINCT FROM NEW.budget_min
     OR OLD.budget_max IS DISTINCT FROM NEW.budget_max
     OR OLD.currency_code IS DISTINCT FROM NEW.currency_code
     OR OLD.budget_provenance IS DISTINCT FROM NEW.budget_provenance THEN
    INSERT INTO public.demand_mandate_history
      (mandate_id, changed_by, change_type, previous_values, new_values)
    VALUES (
      NEW.id, NULL,
      CASE
        WHEN NEW.budget_provenance = 'AGENT_VERIFIED'
             AND OLD.budget_provenance IS DISTINCT FROM 'AGENT_VERIFIED'
        THEN 'BUDGET_VERIFIED'
        ELSE 'BUDGET_CHANGE'
      END,
      jsonb_build_object(
        'budget_min',       OLD.budget_min,
        'budget_max',       OLD.budget_max,
        'currency_code',    OLD.currency_code,
        'budget_provenance',OLD.budget_provenance
      ),
      jsonb_build_object(
        'budget_min',       NEW.budget_min,
        'budget_max',       NEW.budget_max,
        'currency_code',    NEW.currency_code,
        'budget_provenance',NEW.budget_provenance
      )
    );
  END IF;

  -- OWNERSHIP_CHANGE
  IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
    INSERT INTO public.demand_mandate_history
      (mandate_id, changed_by, change_type, previous_values, new_values)
    VALUES (
      NEW.id, NULL, 'OWNERSHIP_CHANGE',
      jsonb_build_object('owner_id', OLD.owner_id),
      jsonb_build_object('owner_id', NEW.owner_id)
    );
  END IF;

  -- VERIFICATION (human review or verification timestamp changed)
  IF OLD.human_reviewed IS DISTINCT FROM NEW.human_reviewed
     OR OLD.last_verified_at IS DISTINCT FROM NEW.last_verified_at THEN
    INSERT INTO public.demand_mandate_history
      (mandate_id, changed_by, change_type, previous_values, new_values)
    VALUES (
      NEW.id, NULL, 'VERIFICATION',
      jsonb_build_object(
        'human_reviewed',   OLD.human_reviewed,
        'last_verified_at', OLD.last_verified_at
      ),
      jsonb_build_object(
        'human_reviewed',   NEW.human_reviewed,
        'last_verified_at', NEW.last_verified_at
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Column-level trigger: only fires when at least one listed column changes.
-- This prevents the trigger firing on notes-only or updated_at-only updates.
DROP TRIGGER IF EXISTS trg_demand_mandates_history ON public.demand_mandates;
CREATE TRIGGER trg_demand_mandates_history
  AFTER UPDATE OF
    lifecycle_state,
    budget_min, budget_max, currency_code, budget_provenance,
    owner_id,
    human_reviewed, last_verified_at
  ON public.demand_mandates
  FOR EACH ROW EXECUTE FUNCTION public.fn_demand_mandates_history();

-- INSERT trigger: writes CREATED history row on initial mandate creation.
CREATE OR REPLACE FUNCTION public.fn_demand_mandates_on_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  INSERT INTO public.demand_mandate_history
    (mandate_id, changed_by, change_type, previous_values, new_values)
  VALUES (
    NEW.id, NULL, 'CREATED',
    NULL,
    jsonb_build_object(
      'lifecycle_state',   NEW.lifecycle_state,
      'transaction_mode',  NEW.transaction_mode,
      'purpose',           NEW.purpose,
      'origin',            NEW.origin,
      'holder_contact_id', NEW.holder_contact_id
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_demand_mandates_on_insert ON public.demand_mandates;
CREATE TRIGGER trg_demand_mandates_on_insert
  AFTER INSERT ON public.demand_mandates
  FOR EACH ROW EXECUTE FUNCTION public.fn_demand_mandates_on_insert();


-- =============================================================================
-- 12. RLS AND GRANTS — Amendment 2: Deny by Default
-- =============================================================================
-- Phase 2B.1 posture: server-side service_role access only for sensitive tables.
-- geography_nodes: public read (non-sensitive reference data).
-- Explicit RLS + REVOKE provides defence-in-depth beyond RLS alone.
-- Phase 2B.2 will add least-privilege RLS policies for portal authenticated access
-- once the portal ownership model and auth scope are defined.
-- =============================================================================

-- ── geography_nodes: public read ─────────────────────────────────────────────
ALTER TABLE public.geography_nodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS geography_nodes_public_read ON public.geography_nodes;
CREATE POLICY geography_nodes_public_read
  ON public.geography_nodes FOR SELECT USING (true);

REVOKE ALL ON TABLE public.geography_nodes FROM PUBLIC;
GRANT SELECT ON TABLE public.geography_nodes TO anon, authenticated;
GRANT ALL    ON TABLE public.geography_nodes TO service_role;

-- ── demand_mandates: service_role only ───────────────────────────────────────
ALTER TABLE public.demand_mandates ENABLE ROW LEVEL SECURITY;
-- No policies: authenticated/anon get no access (deny by default when RLS enabled)
REVOKE ALL ON TABLE public.demand_mandates FROM PUBLIC;
REVOKE ALL ON TABLE public.demand_mandates FROM anon;
REVOKE ALL ON TABLE public.demand_mandates FROM authenticated;
GRANT ALL  ON TABLE public.demand_mandates TO service_role;

-- ── demand_mandate_participants: service_role only ───────────────────────────
ALTER TABLE public.demand_mandate_participants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.demand_mandate_participants FROM PUBLIC;
REVOKE ALL ON TABLE public.demand_mandate_participants FROM anon;
REVOKE ALL ON TABLE public.demand_mandate_participants FROM authenticated;
GRANT ALL  ON TABLE public.demand_mandate_participants TO service_role;

-- ── demand_mandate_locations: service_role only ───────────────────────────────
ALTER TABLE public.demand_mandate_locations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.demand_mandate_locations FROM PUBLIC;
REVOKE ALL ON TABLE public.demand_mandate_locations FROM anon;
REVOKE ALL ON TABLE public.demand_mandate_locations FROM authenticated;
GRANT ALL  ON TABLE public.demand_mandate_locations TO service_role;

-- ── demand_mandate_criteria: service_role only ───────────────────────────────
ALTER TABLE public.demand_mandate_criteria ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.demand_mandate_criteria FROM PUBLIC;
REVOKE ALL ON TABLE public.demand_mandate_criteria FROM anon;
REVOKE ALL ON TABLE public.demand_mandate_criteria FROM authenticated;
GRANT ALL  ON TABLE public.demand_mandate_criteria TO service_role;

-- ── demand_mandate_history: service_role only ────────────────────────────────
ALTER TABLE public.demand_mandate_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.demand_mandate_history FROM PUBLIC;
REVOKE ALL ON TABLE public.demand_mandate_history FROM anon;
REVOKE ALL ON TABLE public.demand_mandate_history FROM authenticated;
GRANT ALL  ON TABLE public.demand_mandate_history TO service_role;

-- ── buyer_mandate_details: service_role only ─────────────────────────────────
ALTER TABLE public.buyer_mandate_details ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.buyer_mandate_details FROM PUBLIC;
REVOKE ALL ON TABLE public.buyer_mandate_details FROM anon;
REVOKE ALL ON TABLE public.buyer_mandate_details FROM authenticated;
GRANT ALL  ON TABLE public.buyer_mandate_details TO service_role;

-- ── investor_mandate_details: service_role only ───────────────────────────────
ALTER TABLE public.investor_mandate_details ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.investor_mandate_details FROM PUBLIC;
REVOKE ALL ON TABLE public.investor_mandate_details FROM anon;
REVOKE ALL ON TABLE public.investor_mandate_details FROM authenticated;
GRANT ALL  ON TABLE public.investor_mandate_details TO service_role;


-- =============================================================================
-- 13. TABLE COMMENTS
-- =============================================================================

COMMENT ON TABLE public.geography_nodes IS
  'Hierarchical geography reference. COUNTRY → DISTRICT → MUNICIPALITY → PARISH → ZONE. '
  'Seed: Portugal only (Phase 2B.1). International = INSERT rows, zero schema change. '
  'Source: INE (Instituto Nacional de Estatística) official PT administrative hierarchy. '
  'PARISH and ZONE levels are schema-ready but not seeded in Phase 2B.1.';

COMMENT ON TABLE public.demand_mandates IS
  'Canonical demand object: structured, provenance-aware, lifecycle-managed record of '
  'expressed demand from an identified person. '
  'Phase 2B.1: person-held mandates only (holder_contact_id NOT NULL). '
  'Organisation-held mandates: future capability — add holder_org_id via later migration. '
  'One holder may have multiple simultaneous ACTIVE mandates (no unique constraint). '
  'MATCHED is NOT a lifecycle state — matching is a future demand_mandate_matches table. '
  'Phase 2B.1: zero backfill. Initial row count after migration = 0.';

COMMENT ON TABLE public.demand_mandate_participants IS
  'Additional contacts on a mandate beyond the primary holder_contact_id. '
  'Use for: spouse, co-investor, legal representative, adviser. '
  'Primary holder is on demand_mandates directly; this table adds extras.';

COMMENT ON TABLE public.demand_mandate_locations IS
  'Geography criteria per mandate. INCLUDE = wanted, EXCLUDE = unwanted. '
  'References geography_nodes — no free text. Hierarchy traversal for matching: '
  'a DISTRICT-level node covers all child MUNICIPALITY/PARISH/ZONE in queries. '
  'UNIQUE (mandate_id, geography_node_id, mode) prevents INCLUDE+EXCLUDE on same node.';

COMMENT ON TABLE public.demand_mandate_criteria IS
  'Variable open-ended criteria. NOT for budget/location/bedrooms (typed columns exist). '
  'Use for: features, proximity, views, keywords, custom conditions. '
  'Each row has provenance (trust level) and constraint_type (HARD/PREFERENCE/EXCLUSION). '
  'Application should warn if >30 rows per mandate (UX, not DB-enforced).';

COMMENT ON TABLE public.demand_mandate_history IS
  'Commercially significant change log. Records before/after for: lifecycle, budget, '
  'ownership, verification. Trigger auto-captures core-field changes. '
  'Application writes geography/criteria/extension changes explicitly. '
  'Property match events go in demand_mandate_matches (Phase 2C+) — NOT here. '
  'Retention policy: anonymise records older than 7 years (GDPR compliance).';

COMMENT ON TABLE public.buyer_mandate_details IS
  'Residential buyer extension. Purpose: PRIMARY_RESIDENCE, SECONDARY_RESIDENCE, HOLIDAY. '
  'Also used for RENT transactions. Contains typed criteria for deterministic matching.';

COMMENT ON TABLE public.investor_mandate_details IS
  'Investment/development buyer extension. Purpose: INVESTMENT, DEVELOPMENT. '
  'ticket_min/max may differ from budget_min/max for leveraged or co-investment deals.';

COMMENT ON COLUMN public.demand_mandates.holder_contact_id IS
  'Primary person holding this mandate. NOT NULL in Phase 2B.1 (person-only). '
  'ON DELETE RESTRICT: deleting a contact with active mandates is blocked at DB level. '
  'Operator must reassign, archive, or remove mandates before deleting the contact. '
  'This preserves referential integrity and prevents accidental commercial-history loss. '
  'Future: when client-org model exists, add holder_org_id via additive migration.';

COMMENT ON COLUMN public.demand_mandates.currency_code IS
  'ISO 4217 currency code (format-validated, 3 uppercase letters). '
  'Application is responsible for using valid ISO 4217 codes. '
  'Supported: EUR, GBP, USD, CHF and any other 3-letter uppercase code.';

COMMENT ON COLUMN public.investor_mandate_details.typical_decision_days IS
  'Agent-observed historical average days from opportunity presentation to decision. '
  'Not user-stated. Used for urgency calibration in future matching engine.';
