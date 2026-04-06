# DATABASE SCHEMA — BACKUP COMPLETO
## Supabase PostgreSQL — Agency Group Portal
## Data do backup: 2026-04-06
## AMI: 22506 | Segmento: €100K–€100M | Portugal + Espanha + Madeira + Açores

---

> **DOCUMENTO DE RECUPERAÇÃO DE DESASTRES**
> Este ficheiro contém toda a informação necessária para restaurar a base de dados do Agency Group Portal do zero. Guarda numa localização segura fora do repositório (ex: password manager, cofre cifrado).

---

## ÍNDICE

1. [Extensões PostgreSQL](#1-extensões-postgresql)
2. [Enums (tipos personalizados)](#2-enums-tipos-personalizados)
3. [Tabelas](#3-tabelas)
4. [Triggers e Funções](#4-triggers-e-funções)
5. [Migrações (cronologia completa)](#5-migrações-cronologia-completa)
6. [Como Restaurar a Base de Dados](#6-como-restaurar-a-base-de-dados)
7. [SQL Completo de Restauro](#7-sql-completo-de-restauro)

---

## 1. EXTENSÕES POSTGRESQL

Todas activadas no schema `extensions` do Supabase (não requerem instalação manual — estão disponíveis em todos os projectos Supabase):

| Extensão | Versão | Propósito |
|---|---|---|
| `uuid-ossp` | built-in | Geração de UUIDs v4 (`uuid_generate_v4()`) — alternativa ao `gen_random_uuid()` |
| `vector` (pgvector) | ≥ 0.5.0 | Embeddings vectoriais 1536-dim para matching semântico de propriedades com IA |
| `pg_trgm` | built-in | Índices trigramas para pesquisa de texto fuzzy (nomes de contactos, moradas) |
| `btree_gin` | built-in | Índices GIN para arrays (`features[]`, `tags[]`, `preferred_locations[]`) |
| `pgcrypto` | built-in | Funções criptográficas (usada internamente pelo Supabase Auth) |

**Activação:**
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

---

## 2. ENUMS (tipos personalizados)

### `property_status`
Estado de uma propriedade no ciclo de vida do negócio.
| Valor | Descrição |
|---|---|
| `active` | Listada e disponível |
| `under_offer` | Oferta aceite, aguarda CPCV |
| `cpcv` | Contrato Promessa assinado |
| `sold` | Escritura concluída |
| `withdrawn` | Retirada do mercado |
| `rented` | Arrendada |
| `off_market` | Disponível mas não listada publicamente |

**Usado em:** `properties.status`

---

### `property_type`
Tipologia do imóvel.
| Valor | Tradução |
|---|---|
| `apartment` | Apartamento |
| `villa` | Villa |
| `townhouse` | Moradia em banda |
| `penthouse` | Penthouse |
| `land` | Terreno |
| `commercial` | Comercial |
| `office` | Escritório |
| `warehouse` | Armazém |
| `hotel` | Hotel |
| `development_plot` | Lote para promoção |

**Usado em:** `properties.type`

---

### `contact_status`
Estado do contacto no funil de vendas.
| Valor | Probabilidade | Descrição |
|---|---|---|
| `lead` | 5% | Contacto inicial, não qualificado |
| `prospect` | 15% | Contactado, demonstrou interesse |
| `qualified` | 30% | Comprador/vendedor qualificado confirmado |
| `active` | 45% | A pesquisar/vender activamente |
| `negotiating` | 70% | Em negociação activa |
| `client` | 100% | Concluiu pelo menos uma transacção |
| `vip` | 100% | Cliente de alto valor, transacções repetidas |
| `dormant` | — | Sem contacto há mais de 90 dias |
| `lost` | 0% | Desistiu ou sem resposta |
| `referrer` | — | Parceiro de referência apenas |

**Usado em:** `contacts.status`

---

### `contact_role`
Papel do contacto na relação imobiliária.
| Valor | Descrição |
|---|---|
| `buyer` | Comprador |
| `seller` | Vendedor |
| `investor` | Investidor |
| `tenant` | Inquilino |
| `landlord` | Proprietário arrendatário |
| `referrer` | Parceiro de referência |
| `developer` | Promotor imobiliário |
| `solicitor` | Advogado |
| `notary` | Notário |
| `other` | Outro |

**Usado em:** `contacts.role`

---

### `deal_stage`
Estágio do negócio no pipeline de vendas.
| Valor | Probabilidade | Lado |
|---|---|---|
| `lead` | 5% | Compra |
| `qualification` | 15% | Compra |
| `visit_scheduled` | 30% | Compra |
| `visit_done` | 40% | Compra |
| `proposal` | 60% | Compra |
| `negotiation` | 70% | Compra |
| `cpcv` | 90% | Compra |
| `escritura` | 97% | Compra |
| `post_sale` | 100% | Compra |
| `prospecting` | 20% | Venda |
| `valuation` | 45% | Venda |
| `mandate` | 60% | Venda |
| `active_listing` | 65% | Venda |
| `offer_received` | 75% | Venda |
| `cpcv_sell` | 90% | Venda |
| `escritura_sell` | 97% | Venda |

**Usado em:** `deals.stage`

---

### `deal_type`
Tipo de representação no negócio.
| Valor | Descrição |
|---|---|
| `buy_side` | Representação do comprador |
| `sell_side` | Representação do vendedor |
| `dual_agency` | Representação de ambos (com divulgação) |
| `rental` | Arrendamento |
| `investment` | Investimento |

**Usado em:** `deals.type`

---

### `activity_type`
Tipo de interacção no log de actividades.
| Valor | Descrição |
|---|---|
| `call_outbound` | Chamada de saída |
| `call_inbound` | Chamada de entrada |
| `email_sent` | Email enviado |
| `email_received` | Email recebido |
| `whatsapp_sent` | WhatsApp enviado |
| `whatsapp_received` | WhatsApp recebido |
| `meeting` | Reunião |
| `visit` | Visita ao imóvel |
| `note` | Nota manual |
| `document_sent` | Documento enviado |
| `offer_made` | Proposta feita |
| `offer_received` | Proposta recebida |
| `task_completed` | Tarefa concluída |
| `system_event` | Evento do sistema/automação |

**Usado em:** `activities.type`

---

### `signal_type`
Tipo de sinal de oportunidade off-market.
| Valor | Fonte | Descrição |
|---|---|---|
| `inheritance` | DR / notário | Herdeiro a vender imóvel herdado |
| `insolvency` | Diário da República | Processo de insolvência |
| `divorce` | DR / tribunais | Divórcio / partilha de bens |
| `relocation` | Rede / LinkedIn | Proprietário a mudar de cidade/país |
| `multi_property` | AT / registos | Proprietário com múltiplos imóveis |
| `price_reduction` | Portais | Redução de preço no mercado |
| `stagnated_listing` | Portais | Imóvel há mais de 180 dias |
| `new_below_avm` | AVM engine | Novo imóvel abaixo do valor de mercado |
| `listing_removed` | Portais | Removido do portal (negociação directa?) |
| `hot_zone_new` | Market monitor | Nova listagem em zona de alta procura |

**Usado em:** `signals.type`

---

### `signal_status`
Estado de processamento de um sinal.
| Valor | Descrição |
|---|---|
| `new` | Recém detectado |
| `in_progress` | A ser investigado |
| `contacted` | Proprietário contactado |
| `converted` | Convertido em negócio/mandato |
| `dismissed` | Descartado |

**Usado em:** `signals.status`

---

### `task_status`
Estado de uma tarefa.
| Valor | Descrição |
|---|---|
| `pending` | Pendente |
| `in_progress` | Em progresso |
| `completed` | Concluída |
| `cancelled` | Cancelada |
| `deferred` | Adiada |

**Usado em:** `tasks.status` (versão v2 do schema)

---

### `notification_channel`
Canal de entrega de notificações.
| Valor | Serviço |
|---|---|
| `email` | Resend |
| `whatsapp` | Meta Business API |
| `push` | VAPID / Web Push |
| `sms` | Twilio |
| `in_app` | Portal web |

**Usado em:** `notifications.channel`

---

### `referral_tier`
Nível do programa de referências.
| Valor | Referências Necessárias | Bónus Comissão |
|---|---|---|
| `bronze` | 0–2 | +0% |
| `silver` | 3–5 | +0,1% |
| `gold` | 6–10 | +0,2% |
| `platinum` | 11+ | +0,25% |

**Usado em:** `referral_network.tier`

---

### `lead_tier`
Classificação A/B/C do lead por score.
| Valor | Score | Descrição |
|---|---|---|
| `A` | > 70 | Hot — prioridade máxima |
| `B` | 40–70 | Warm — follow-up regular |
| `C` | < 40 | Cold — sequência automatizada |

**Usado em:** `contacts.lead_tier`

---

## 3. TABELAS

### `profiles`
**Descrição:** Perfis dos consultores e staff da Agency Group. Ligado 1:1 à tabela `auth.users` do Supabase Auth. Cada utilizador autenticado tem um perfil aqui.

| Campo | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | — | PK, FK → `auth.users(id)` ON DELETE CASCADE |
| `full_name` | TEXT | NOT NULL | — | Nome completo do consultor |
| `email` | TEXT | NOT NULL | — | Email único (UNIQUE constraint) |
| `phone` | TEXT | NULL | — | Telefone |
| `role` | TEXT | NOT NULL | `'consultant'` | `admin` / `manager` / `consultant` / `assistant` |
| `ami_number` | TEXT | NULL | `'AMI 22506'` | Número AMI da agência |
| `avatar_url` | TEXT | NULL | — | URL da fotografia (Supabase Storage) |
| `whatsapp_number` | TEXT | NULL | — | Número WhatsApp do consultor |
| `is_active` | BOOLEAN | NOT NULL | `TRUE` | Consultor activo ou arquivado |
| `monthly_target` | DECIMAL(12,2) | NULL | — | Objectivo mensal de GCI em EUR |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | Data de criação |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | Actualizado por trigger |

**Índices:** Nenhum adicional (PK é o índice principal)

**Foreign Keys:**
- `id` → `auth.users(id)` ON DELETE CASCADE

**RLS Policies:**
| Policy | Operação | Regra |
|---|---|---|
| `profiles_select` | SELECT | Próprio perfil (`id = auth.uid()`) OU admin/manager |
| `profiles_update` | UPDATE | Próprio perfil OU admin/manager |

**Trigger:** `trg_profiles_updated_at` — actualiza `updated_at` antes de UPDATE

---

### `contacts`
**Descrição:** Tabela mestra de contactos — compradores, vendedores, investidores, parceiros de referência. Perfis de comprador e vendedor embutidos para evitar JOINs nas operações mais comuns. Motor central de todos os workflows n8n.

| Campo | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `uuid_generate_v4()` | PK |
| `full_name` | TEXT | NOT NULL | — | Nome completo |
| `email` | TEXT | NULL | — | Email (indexado, com filtro NOT NULL) |
| `phone` | TEXT | NULL | — | Telefone (indexado, com filtro NOT NULL) |
| `whatsapp` | TEXT | NULL | — | Número WhatsApp |
| `nationality` | CHAR(2) | NULL | — | ISO 3166-1: PT, US, FR, GB, DE, AE, CN |
| `language` | TEXT | NULL | `'pt'` | BCP 47: pt, en, fr, de, ar, zh |
| `role` | contact_role | NOT NULL | `'buyer'` | Papel no negócio |
| `status` | contact_status | NOT NULL | `'lead'` | Estado no funil |
| `lead_tier` | lead_tier | NULL | — | Classificação A/B/C |
| `lead_score` | SMALLINT | NULL | `0` | Score 0–100 |
| `lead_score_breakdown` | JSONB | NULL | — | Ex: `{budget:30, source:20, phone:10}` |
| `source` | TEXT | NULL | — | `referral`, `idealista_premium`, `website`, `cold_call`, `instagram` |
| `source_detail` | TEXT | NULL | — | Detalhe da fonte |
| `referrer_id` | UUID | NULL | — | FK → `contacts(id)` ON DELETE SET NULL |
| `assigned_to` | UUID | NULL | — | FK → `profiles(id)` ON DELETE SET NULL |
| `budget_min` | DECIMAL(12,2) | NULL | — | Orçamento mínimo (EUR) |
| `budget_max` | DECIMAL(12,2) | NULL | — | Orçamento máximo (EUR) |
| `preferred_locations` | TEXT[] | NULL | — | Ex: `['Lisboa','Cascais','Sintra']` |
| `typologies_wanted` | TEXT[] | NULL | — | Ex: `['apartment','villa']` |
| `bedrooms_min` | SMALLINT | NULL | — | Quartos mínimos |
| `bedrooms_max` | SMALLINT | NULL | — | Quartos máximos |
| `features_required` | TEXT[] | NULL | — | Ex: `['pool','garage','sea_view']` |
| `use_type` | TEXT | NULL | — | `primary_residence` / `investment` / `holiday` / `golden_visa` |
| `timeline` | TEXT | NULL | — | `immediate` / `3months` / `6months` / `1year` |
| `financing_type` | TEXT | NULL | — | `cash` / `mortgage` / `mixed` |
| `property_to_sell_id` | UUID | NULL | — | ID da propriedade a vender (quando criada) |
| `asking_price` | DECIMAL(12,2) | NULL | — | Preço pedido (lado vendedor) |
| `motivation_score` | SMALLINT | NULL | — | Motivação 1–5 (BETWEEN 1 AND 5) |
| `last_contact_at` | TIMESTAMPTZ | NULL | — | Último contacto (actualizado por trigger) |
| `next_followup_at` | TIMESTAMPTZ | NULL | — | Próximo follow-up |
| `total_interactions` | INT | NULL | `0` | Nº total de interacções (actualizado por trigger) |
| `opt_out_marketing` | BOOLEAN | NOT NULL | `FALSE` | Recusou marketing |
| `opt_out_whatsapp` | BOOLEAN | NOT NULL | `FALSE` | Recusou WhatsApp |
| `gdpr_consent` | BOOLEAN | NOT NULL | `FALSE` | Consentimento RGPD |
| `gdpr_consent_at` | TIMESTAMPTZ | NULL | — | Data do consentimento RGPD |
| `enriched_at` | TIMESTAMPTZ | NULL | — | Data do enriquecimento Apollo/Clearbit |
| `clearbit_data` | JSONB | NULL | — | Dados brutos do Clearbit |
| `apollo_data` | JSONB | NULL | — | Dados brutos do Apollo.io |
| `linkedin_url` | TEXT | NULL | — | URL LinkedIn |
| `company` | TEXT | NULL | — | Empresa |
| `job_title` | TEXT | NULL | — | Cargo |
| `qualified_at` | TIMESTAMPTZ | NULL | — | Data de qualificação |
| `qualification_notes` | TEXT | NULL | — | Notas de qualificação |
| `ai_summary` | TEXT | NULL | — | Resumo gerado por Claude Haiku |
| `ai_suggested_action` | TEXT | NULL | — | Acção sugerida pela IA |
| `detected_intent` | TEXT | NULL | — | `buy_now` / `researching` / `investment_only` |
| `tags` | TEXT[] | NULL | — | Tags livres |
| `notes` | TEXT | NULL | — | Notas do consultor |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | Data de criação |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | Actualizado por trigger |

**Índices:**
```
idx_contacts_status        ON contacts(status)
idx_contacts_lead_tier     ON contacts(lead_tier)
idx_contacts_lead_score    ON contacts(lead_score DESC)
idx_contacts_assigned_to   ON contacts(assigned_to)
idx_contacts_nationality   ON contacts(nationality)
idx_contacts_source        ON contacts(source)
idx_contacts_last_contact  ON contacts(last_contact_at DESC NULLS LAST)
idx_contacts_next_followup ON contacts(next_followup_at ASC NULLS LAST)
idx_contacts_budget        ON contacts(budget_min, budget_max)
idx_contacts_email         ON contacts(email) WHERE email IS NOT NULL
idx_contacts_phone         ON contacts(phone) WHERE phone IS NOT NULL
idx_contacts_name_trgm     ON contacts USING gin(full_name gin_trgm_ops)
```

**Foreign Keys:**
- `referrer_id` → `contacts(id)` ON DELETE SET NULL (auto-referência)
- `assigned_to` → `profiles(id)` ON DELETE SET NULL

**RLS Policies:**
| Policy | Operação | Regra |
|---|---|---|
| `contacts_select` | SELECT | Admin OU `assigned_to = auth.uid()` OU não atribuído |
| `contacts_insert` | INSERT | Qualquer utilizador autenticado |
| `contacts_update` | UPDATE | Admin OU `assigned_to = auth.uid()` OU não atribuído |
| `contacts_delete` | DELETE | Apenas admins |

**Triggers:**
- `trg_contacts_updated_at` — actualiza `updated_at` antes de UPDATE
- `trg_activity_update_contact` (na tabela activities) — incrementa `total_interactions` e actualiza `last_contact_at` após INSERT em activities

---

### `properties`
**Descrição:** Propriedades geridas pela Agency Group — mandatos exclusivos, co-exclusivos, off-market. O campo `embedding` (vector 1536-dim) permite matching semântico IA via `match_properties()`.

| Campo | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `uuid_generate_v4()` | PK |
| `title` | TEXT | NOT NULL (relaxado em 003) | — | Título da propriedade |
| `description` | TEXT | NULL | — | Descrição em português |
| `description_en` | TEXT | NULL | — | Descrição em inglês |
| `description_fr` | TEXT | NULL | — | Descrição em francês |
| `status` | property_status | NOT NULL | `'active'` | Estado da propriedade |
| `type` | property_type | NOT NULL | — | Tipologia |
| `price` | DECIMAL(12,2) | NOT NULL | — | Preço de venda (EUR) |
| `price_previous` | DECIMAL(12,2) | NULL | — | Preço anterior (antes da redução) |
| `price_reduced_at` | TIMESTAMPTZ | NULL | — | Data da última redução |
| `price_per_sqm` | DECIMAL(8,2) | NULL | — | Preço por m² (calculado por trigger ou app) |
| `address` | TEXT | NULL | — | Morada completa |
| `street` | TEXT | NULL | — | Rua |
| `city` | TEXT | NULL | — | Cidade |
| `concelho` | TEXT | NULL | — | Município português |
| `distrito` | TEXT | NULL | — | Distrito |
| `parish` | TEXT | NULL | — | Freguesia |
| `postcode` | TEXT | NULL | — | Código postal |
| `country` | TEXT | NOT NULL | `'PT'` | País (ISO 3166-1) |
| `latitude` | DECIMAL(9,6) | NULL | — | Latitude GPS |
| `longitude` | DECIMAL(9,6) | NULL | — | Longitude GPS |
| `zone` | TEXT | NULL | — | Zona de mercado (ex: 'Chiado', 'Quinta da Marinha') |
| `area_m2` | DECIMAL(8,2) | NULL | — | Área útil em m² |
| `area_plot_m2` | DECIMAL(8,2) | NULL | — | Área do terreno em m² |
| `area_terraco_m2` | DECIMAL(8,2) | NULL | — | Área de terraço em m² |
| `bedrooms` | SMALLINT | NULL | — | Número de quartos |
| `bathrooms` | SMALLINT | NULL | — | Número de casas de banho |
| `parking_spaces` | SMALLINT | NULL | `0` | Lugares de estacionamento |
| `floor` | SMALLINT | NULL | — | Andar |
| `total_floors` | SMALLINT | NULL | — | Total de andares do edifício |
| `year_built` | SMALLINT | NULL | — | Ano de construção |
| `energy_certificate` | TEXT | NULL | — | Certificado energético: A+, A, B, B-, C, D, E, F, G |
| `condition` | TEXT | NULL | — | Estado: `new`, `excellent`, `good`, `needs_renovation`, `ruin` |
| `features` | TEXT[] | NULL | — | Características: `['pool','garage','lift','sea_view']` |
| `orientation` | TEXT | NULL | — | Orientação: `south`, `east`, `west`, `north`, `southwest` |
| `furnished` | BOOLEAN | NULL | `FALSE` | Mobilado |
| `is_exclusive` | BOOLEAN | NOT NULL | `FALSE` | Mandato exclusivo |
| `mandate_signed_at` | TIMESTAMPTZ | NULL | — | Data de assinatura do mandato |
| `mandate_expires_at` | TIMESTAMPTZ | NULL | — | Data de expiração do mandato |
| `owner_contact_id` | UUID | NULL | — | FK → `contacts(id)` ON DELETE SET NULL |
| `assigned_consultant` | UUID | NULL | — | FK → `profiles(id)` ON DELETE SET NULL |
| `idealista_id` | TEXT | NULL | — | ID no Idealista (deduplicação) |
| `imovirtual_id` | TEXT | NULL | — | ID no Imovirtual |
| `casasapo_id` | TEXT | NULL | — | ID no Casa Sapo |
| `olx_id` | TEXT | NULL | — | ID no OLX |
| `avm_estimate` | DECIMAL(12,2) | NULL | — | Estimativa do AVM (Automated Valuation Model) |
| `avm_confidence` | DECIMAL(4,3) | NULL | — | Confiança do AVM: 0.000–1.000 |
| `avm_updated_at` | TIMESTAMPTZ | NULL | — | Última actualização do AVM |
| `opportunity_score` | SMALLINT | NULL | `0` | Score de oportunidade 0–100 |
| `investor_suitable` | BOOLEAN | NOT NULL | `FALSE` | Adequado para investidores |
| `estimated_rental_yield` | DECIMAL(5,2) | NULL | — | Yield de arrendamento estimado (%) |
| `estimated_cap_rate` | DECIMAL(5,2) | NULL | — | Cap rate estimado (%) |
| `estimated_irr` | DECIMAL(5,2) | NULL | — | IRR estimada (%) |
| `photos` | TEXT[] | NULL | — | URLs Supabase Storage |
| `virtual_tour_url` | TEXT | NULL | — | URL visita virtual |
| `floor_plan_url` | TEXT | NULL | — | URL planta |
| `embedding` | vector(1536) | NULL | — | Embedding semântico para matching IA (cosine distance) |
| `source` | TEXT | NULL | `'direct'` | `direct`, `idealista`, `imovirtual`, `referral` |
| `is_off_market` | BOOLEAN | NOT NULL | `FALSE` | Propriedade off-market |
| `portal_published` | BOOLEAN | NOT NULL | `FALSE` | Publicada no portal web |
| `portal_published_at` | TIMESTAMPTZ | NULL | — | Data de publicação |
| `views_total` | INT | NULL | `0` | Total de visualizações |
| `inquiries_total` | INT | NULL | `0` | Total de pedidos de informação |
| `visits_total` | INT | NULL | `0` | Total de visitas realizadas |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | Data de criação |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | Actualizado por trigger |
| `nome` | TEXT | NULL | — | Nome display (adicionado em 003) |
| `zona` | TEXT | NULL | — | Zona display (adicionado em 003) |
| `bairro` | TEXT | NULL | — | Bairro (adicionado em 003) |
| `tipo` | TEXT | NULL | — | Tipo display (adicionado em 003) |
| `preco` | DECIMAL(12,2) | NULL | — | Preço display (adicionado em 003) |
| `area` | DECIMAL(8,2) | NULL | — | Área display (adicionado em 003) |
| `quartos` | SMALLINT | NULL | — | Quartos display (adicionado em 003) |
| `casas_banho` | SMALLINT | NULL | — | Casas de banho display (adicionado em 003) |
| `gradient` | TEXT | NULL | — | CSS gradient para UI (adicionado em 003) |

**Índices:**
```
idx_properties_status      ON properties(status)
idx_properties_type        ON properties(type)
idx_properties_price       ON properties(price)
idx_properties_concelho    ON properties(concelho)
idx_properties_zone        ON properties(zone)
idx_properties_bedrooms    ON properties(bedrooms)
idx_properties_opportunity ON properties(opportunity_score DESC)
idx_properties_investor    ON properties(investor_suitable) WHERE investor_suitable = TRUE
idx_properties_off_market  ON properties(is_off_market) WHERE is_off_market = TRUE
idx_properties_consultant  ON properties(assigned_consultant)
idx_properties_features    ON properties USING gin(features)
idx_properties_embedding   ON properties USING hnsw (embedding vector_cosine_ops) WITH (m=16, ef_construction=64)
idx_properties_title_trgm  ON properties USING gin(title gin_trgm_ops)
```

**Foreign Keys:**
- `owner_contact_id` → `contacts(id)` ON DELETE SET NULL
- `assigned_consultant` → `profiles(id)` ON DELETE SET NULL

**RLS Policies:**
| Policy | Operação | Regra |
|---|---|---|
| `properties_select` | SELECT | Admin OU `assigned_consultant = auth.uid()` OU `status = 'active'` |
| `properties_insert` | INSERT | Qualquer autenticado |
| `properties_update` | UPDATE | Admin OU `assigned_consultant = auth.uid()` |
| `properties_delete` | DELETE | Apenas admins |
| `Service role has full access to properties` | ALL | service_role (bypass RLS) |
| `Agents can read all properties` | SELECT | authenticated |

**Trigger:** `trg_properties_updated_at`

---

### `market_properties`
**Descrição:** Listagens de concorrentes obtidas por scraping (Idealista, Imovirtual, Casa Sapo, OLX, RE/MAX). Alimenta o modelo AVM (XGBoost) e a inteligência competitiva.

| Campo | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `uuid_generate_v4()` | PK |
| `source` | TEXT | NOT NULL | — | Portal de origem |
| `external_id` | TEXT | NOT NULL | — | ID no portal de origem (UNIQUE com source) |
| `source_url` | TEXT | NULL | — | URL da listagem |
| `typologia` | TEXT | NULL | — | Tipologia (T1, T2, V3, etc.) |
| `area_m2` | DECIMAL(8,2) | NULL | — | Área |
| `preco` | DECIMAL(12,2) | NULL | — | Preço actual |
| `preco_anterior` | DECIMAL(12,2) | NULL | — | Preço anterior |
| `price_per_sqm` | DECIMAL(8,2) | NULL | — | Preço por m² |
| `concelho` | TEXT | NULL | — | Município |
| `zona` | TEXT | NULL | — | Zona |
| `latitude` | DECIMAL(9,6) | NULL | — | Latitude GPS |
| `longitude` | DECIMAL(9,6) | NULL | — | Longitude GPS |
| `bedrooms` | SMALLINT | NULL | — | Quartos |
| `bathrooms` | SMALLINT | NULL | — | Casas de banho |
| `floor` | SMALLINT | NULL | — | Andar |
| `condition` | TEXT | NULL | — | Estado do imóvel |
| `features` | TEXT[] | NULL | — | Características |
| `photos` | TEXT[] | NULL | — | Fotos |
| `agencia` | TEXT | NULL | — | Agência anunciante |
| `days_on_market` | INT | NULL | — | Dias no mercado |
| `price_reductions` | SMALLINT | NULL | `0` | Número de reduções de preço |
| `first_seen_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | Primeira vez detectado |
| `last_seen_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | Última vez visto activo |
| `is_active` | BOOLEAN | NOT NULL | `TRUE` | Ainda activo nos portais |
| `raw_data` | JSONB | NULL | — | Dados brutos do scraper |

**Constraint único:** `UNIQUE(source, external_id)`

**Índices:**
```
idx_market_props_source   ON market_properties(source)
idx_market_props_concelho ON market_properties(concelho)
idx_market_props_price    ON market_properties(preco)
idx_market_props_active   ON market_properties(is_active) WHERE is_active = TRUE
```

**RLS:** Não configurado (acesso via service_role pela FastAPI/Railway)

---

### `deals`
**Descrição:** Pipeline de transacções completo: do primeiro contacto à escritura. Inclui GCI ponderado, análise de perda, NPS, e campos de compatibilidade com o portal. Comissão: 5% (50% CPCV + 50% Escritura).

| Campo | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `uuid_generate_v4()` | PK |
| `title` | TEXT | NULL (relaxado em 003) | — | Título do negócio |
| `reference` | TEXT | NULL | — | Ref auto-gerada: AG-2026-0001 (UNIQUE) |
| `contact_id` | UUID | NULL (relaxado em 003) | — | FK → `contacts(id)` ON DELETE RESTRICT |
| `property_id` | UUID | NULL | — | FK → `properties(id)` ON DELETE SET NULL |
| `assigned_consultant` | UUID | NULL | — | FK → `profiles(id)` ON DELETE SET NULL |
| `type` | deal_type | NOT NULL | `'buy_side'` | Tipo de representação |
| `stage` | deal_stage | NOT NULL | `'lead'` | Estágio no pipeline |
| `probability` | SMALLINT | NULL | `5` | Probabilidade 0–100 |
| `deal_value` | DECIMAL(12,2) | NULL | — | Valor do negócio (EUR) |
| `commission_rate` | DECIMAL(5,4) | NULL | `0.05` | Taxa de comissão (5%) |
| `gci_net` | DECIMAL(10,2) | NULL | — | GCI líquido calculado |
| `cpcv_date` | DATE | NULL | — | Data do CPCV |
| `escritura_date` | DATE | NULL | — | Data da Escritura |
| `expected_close_date` | DATE | NULL | — | Data prevista de fecho |
| `actual_close_date` | DATE | NULL | — | Data efectiva de fecho |
| `cpcv_deposit` | DECIMAL(12,2) | NULL | — | Valor do sinal/depósito CPCV |
| `cpcv_deposit_pct` | DECIMAL(5,2) | NULL | — | % do sinal CPCV |
| `notario_id` | UUID | NULL | — | FK → `contacts(id)` — Notário |
| `advogado_id` | UUID | NULL | — | FK → `contacts(id)` — Advogado |
| `initial_offer` | DECIMAL(12,2) | NULL | — | Proposta inicial |
| `accepted_offer` | DECIMAL(12,2) | NULL | — | Proposta aceite |
| `negotiation_notes` | TEXT | NULL | — | Notas de negociação |
| `lost_at` | TIMESTAMPTZ | NULL | — | Data de perda do negócio |
| `lost_reason` | TEXT | NULL | — | Razão: `price`, `competition`, `financing`, `changed_mind`, `timing` |
| `lost_to_agency` | TEXT | NULL | — | Agência que ganhou o negócio |
| `nps_score` | SMALLINT | NULL | — | NPS pós-venda 0–10 |
| `nps_comment` | TEXT | NULL | — | Comentário NPS |
| `google_review_requested` | BOOLEAN | NULL | `FALSE` | Review Google solicitada |
| `google_review_at` | TIMESTAMPTZ | NULL | — | Data da review Google |
| `ai_deal_memo` | TEXT | NULL | — | Memo gerado pelo Claude Sonnet |
| `ai_risk_factors` | JSONB | NULL | — | Factores de risco analisados pela IA |
| `source` | TEXT | NULL | — | Origem do negócio |
| `tags` | TEXT[] | NULL | — | Tags |
| `notes` | TEXT | NULL | — | Notas |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | Data de criação |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | Actualizado por trigger |
| `imovel` | TEXT | NULL | — | Descrição do imóvel para o portal (adicionado em 003) |
| `valor` | TEXT | NULL | — | Valor formatado: "€ 1.250.000" (adicionado em 003) |
| `fase` | TEXT | NULL | — | Nome da fase em PT: "Proposta Aceite" (adicionado em 003) |
| `comprador` | TEXT | NULL | — | Nome do comprador em texto (adicionado em 003) |
| `ref` | TEXT | NULL | — | Referência display: "AG-2026-001" (adicionado em 003) |
| `notas` | TEXT | NULL | — | Notas simples portal (adicionado em 003) |
| `cpcv_date_text` | TEXT | NULL | — | Data CPCV em texto (adicionado em 003) |
| `escritura_date_text` | TEXT | NULL | — | Data Escritura em texto (adicionado em 003) |

**Índices:**
```
idx_deals_stage       ON deals(stage)
idx_deals_contact     ON deals(contact_id)
idx_deals_property    ON deals(property_id)
idx_deals_consultant  ON deals(assigned_consultant)
idx_deals_close_date  ON deals(expected_close_date ASC NULLS LAST)
idx_deals_ref         ON deals(ref) WHERE ref IS NOT NULL  [UNIQUE]
```

**Sequência:** `deal_reference_seq` (inicia em 1)

**Foreign Keys:**
- `contact_id` → `contacts(id)` ON DELETE RESTRICT
- `property_id` → `properties(id)` ON DELETE SET NULL
- `assigned_consultant` → `profiles(id)` ON DELETE SET NULL
- `notario_id` → `contacts(id)` ON DELETE SET NULL
- `advogado_id` → `contacts(id)` ON DELETE SET NULL

**RLS Policies:**
| Policy | Operação | Regra |
|---|---|---|
| `deals_select` | SELECT | Admin OU `assigned_consultant = auth.uid()` |
| `deals_insert` | INSERT | Qualquer autenticado |
| `deals_update` | UPDATE | Admin OU `assigned_consultant = auth.uid()` |
| `deals_delete` | DELETE | Apenas admins |
| `Service role has full access to deals` | ALL | service_role |
| `Agents can read all deals` | SELECT | authenticated |
| `Agents can insert deals` | INSERT | authenticated |
| `Agents can update their deals` | UPDATE | authenticated |

**Triggers:**
- `trg_deals_reference` — gera referência AG-YYYY-NNNN antes de INSERT se NULL
- `trg_deals_updated_at` — actualiza `updated_at` antes de UPDATE

---

### `activities`
**Descrição:** Log de interacções append-only — chamadas, emails, WhatsApp, visitas, notas. Registo imutável (sem `updated_at`). Análise de sentimento via Claude Haiku.

| Campo | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `uuid_generate_v4()` | PK |
| `contact_id` | UUID | NULL | — | FK → `contacts(id)` ON DELETE CASCADE |
| `deal_id` | UUID | NULL | — | FK → `deals(id)` ON DELETE SET NULL |
| `property_id` | UUID | NULL | — | FK → `properties(id)` ON DELETE SET NULL |
| `performed_by` | UUID | NULL | — | FK → `profiles(id)` ON DELETE SET NULL |
| `type` | activity_type | NOT NULL | — | Tipo de actividade |
| `subject` | TEXT | NULL | — | Assunto |
| `body` | TEXT | NULL | — | Corpo/conteúdo |
| `duration_min` | INT | NULL | — | Duração em minutos |
| `outcome` | TEXT | NULL | — | `interested`, `not_interested`, `callback`, `voicemail` |
| `sentiment` | TEXT | NULL | — | `positive`, `neutral`, `negative` |
| `sentiment_score` | DECIMAL(4,3) | NULL | — | Score -1.0 a +1.0 |
| `ai_summary` | TEXT | NULL | — | Resumo gerado pela IA |
| `is_automated` | BOOLEAN | NOT NULL | `FALSE` | Gerado por automação n8n |
| `automation_id` | TEXT | NULL | — | ID de execução n8n |
| `occurred_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | Quando aconteceu |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | Quando foi registado |

> **Nota:** Sem `updated_at` — registos são imutáveis por design.

**Índices:**
```
idx_activities_contact  ON activities(contact_id, occurred_at DESC)
idx_activities_deal     ON activities(deal_id)
idx_activities_type     ON activities(type)
idx_activities_occurred ON activities(occurred_at DESC)
```

**Foreign Keys:**
- `contact_id` → `contacts(id)` ON DELETE CASCADE
- `deal_id` → `deals(id)` ON DELETE SET NULL
- `property_id` → `properties(id)` ON DELETE SET NULL
- `performed_by` → `profiles(id)` ON DELETE SET NULL

**RLS Policies:**
| Policy | Operação | Regra |
|---|---|---|
| `activities_select` | SELECT | Admin OU `performed_by = auth.uid()` OU contacto atribuído ao utilizador |
| `activities_insert` | INSERT | Qualquer autenticado |
| `activities_delete` | DELETE | Apenas admins |

---

### `tasks`
**Descrição:** Gestão de tarefas dos consultores. Geradas automaticamente pelos workflows n8n (sequência CPCV D+7/14/25/escritura-3, reactivação dormentes, follow-up pós-venda). Existe em duas versões ligeiramente diferentes (schema.sql simplificado e 001_initial_schema.sql v2).

| Campo | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `uuid_generate_v4()` | PK |
| `contact_id` | UUID | NULL | — | FK → `contacts(id)` ON DELETE CASCADE |
| `deal_id` | UUID | NULL | — | FK → `deals(id)` ON DELETE CASCADE |
| `property_id` | UUID | NULL | — | FK → `properties(id)` ON DELETE SET NULL |
| `assigned_to` | UUID | NULL | — | FK → `profiles(id)` — Consultor responsável |
| `created_by` | UUID | NULL | — | FK → `profiles(id)` — Quem criou |
| `title` | TEXT | NOT NULL | — | Título da tarefa |
| `description` | TEXT | NULL | — | Descrição detalhada |
| `type` | TEXT | NULL | — | `call`, `email`, `visit`, `follow_up`, `document`, `review` |
| `status` | task_status | NOT NULL | `'pending'` | Estado |
| `priority` | SMALLINT | NULL | `3` | Prioridade 1–5 |
| `due_at` | TIMESTAMPTZ | NULL | — | Data/hora limite |
| `completed_at` | TIMESTAMPTZ | NULL | — | Data de conclusão |
| `is_recurring` | BOOLEAN | NOT NULL | `FALSE` | Tarefa recorrente |
| `recurrence_rule` | TEXT | NULL | — | RRULE: `FREQ=WEEKLY;BYDAY=MO,WE` |
| `is_automated` | BOOLEAN | NOT NULL | `FALSE` | Gerada por automação |
| `automation_sequence` | TEXT | NULL | — | Nome da sequência n8n |
| `tags` | TEXT[] | NULL | — | Tags |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | Data de criação |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | Actualizado por trigger |

**Índices:**
```
idx_tasks_assigned ON tasks(assigned_to, status)
idx_tasks_due      ON tasks(due_at ASC NULLS LAST) WHERE status = 'pending'
idx_tasks_contact  ON tasks(contact_id)
```

**RLS Policies:**
| Policy | Operação | Regra |
|---|---|---|
| `tasks_select` | SELECT | Admin OU `assigned_to = auth.uid()` OU `created_by = auth.uid()` |
| `tasks_insert` | INSERT | Qualquer autenticado |
| `tasks_update` | UPDATE | Admin OU `assigned_to = auth.uid()` |
| `tasks_delete` | DELETE | Admin OU `created_by = auth.uid()` |

**Trigger:** `trg_tasks_updated_at`

---

### `investor_profiles`
**Descrição:** Perfil alargado de investidor para matching de negócios e deal memos. Ligado 1:1 a `contacts`. Usado pelo Workflow D (alertas investidor) e pelo motor de matching IA.

| Campo | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `uuid_generate_v4()` | PK |
| `contact_id` | UUID | NOT NULL UNIQUE | — | FK → `contacts(id)` ON DELETE CASCADE |
| `segment` | TEXT | NULL | — | `family_office`, `nhr_golden_visa`, `flipper`, `developer`, `hnwi` |
| `deal_size_min` | DECIMAL(12,2) | NULL | — | Valor mínimo de investimento |
| `deal_size_max` | DECIMAL(12,2) | NULL | — | Valor máximo de investimento |
| `preferred_zones` | TEXT[] | NULL | — | Zonas preferidas |
| `asset_classes` | TEXT[] | NULL | — | Classes de activos |
| `yield_target_min` | DECIMAL(5,2) | NULL | — | Yield mínima pretendida (%) |
| `yield_target_max` | DECIMAL(5,2) | NULL | — | Yield máxima pretendida (%) |
| `irr_target` | DECIMAL(5,2) | NULL | — | IRR pretendida (%) |
| `cap_rate_min` | DECIMAL(5,2) | NULL | — | Cap rate mínimo (%) |
| `hold_period_years` | SMALLINT | NULL | — | Período de detenção em anos |
| `deal_flow_pref` | TEXT[] | NULL | — | `off_market`, `below_avm`, `value_add`, `turnkey` |
| `exit_strategy` | TEXT | NULL | — | `rental_income`, `capital_gain`, `flip`, `mixed` |
| `financing_pref` | TEXT | NULL | — | `all_cash`, `leveraged`, `flexible` |
| `preferred_language` | TEXT | NULL | `'en'` | Idioma preferido para relatórios |
| `report_frequency` | TEXT | NULL | `'weekly'` | Frequência de relatórios |
| `deals_completed` | INT | NULL | `0` | Negócios concluídos |
| `total_invested` | DECIMAL(14,2) | NULL | `0` | Total investido (EUR) |
| `last_deal_memo_at` | TIMESTAMPTZ | NULL | — | Último deal memo enviado |
| `alert_threshold` | SMALLINT | NULL | `70` | Notificar quando `opportunity_score >= X` |
| `notes` | TEXT | NULL | — | Notas |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | Data de criação |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | Actualizado por trigger |

**RLS Policies:**
| Policy | Operação | Regra |
|---|---|---|
| `investor_profiles_select` | SELECT | Admin OU contacto atribuído ao utilizador |
| `investor_profiles_insert` | INSERT | Qualquer autenticado |
| `investor_profiles_update` | UPDATE | Admin OU contacto atribuído ao utilizador |

**Trigger:** `trg_investor_profiles_updated_at`

---

### `signals`
**Descrição:** Sinais de oportunidade off-market — parsing do Diário da República (insolvências/heranças), monitorização de mercado, rede de agentes. Score de probabilidade 0–100 e prioridade 1–5.

| Campo | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `uuid_generate_v4()` | PK |
| `type` | signal_type | NOT NULL | — | Tipo de sinal |
| `status` | signal_status | NOT NULL | `'new'` | Estado de processamento |
| `priority` | SMALLINT | NOT NULL | `3` | Prioridade 1–5 |
| `probability_score` | SMALLINT | NULL | `0` | Probabilidade 0–100 |
| `property_id` | UUID | NULL | — | FK → `properties(id)` ON DELETE SET NULL |
| `property_address` | TEXT | NULL | — | Morada do imóvel |
| `property_zone` | TEXT | NULL | — | Zona do imóvel |
| `estimated_value` | DECIMAL(12,2) | NULL | — | Valor estimado |
| `owner_name` | TEXT | NULL | — | Nome do proprietário |
| `owner_contact_id` | UUID | NULL | — | FK → `contacts(id)` ON DELETE SET NULL |
| `signal_date` | DATE | NOT NULL | `CURRENT_DATE` | Data do sinal |
| `source` | TEXT | NULL | — | `dre_parser`, `market_monitor`, `manual`, `network` |
| `source_url` | TEXT | NULL | — | URL da fonte |
| `source_reference` | TEXT | NULL | — | Número de publicação no DR |
| `raw_data` | JSONB | NULL | — | Dados brutos |
| `recommended_action` | TEXT | NULL | — | Acção recomendada |
| `action_deadline` | DATE | NULL | — | Prazo para agir |
| `assigned_to` | UUID | NULL | — | FK → `profiles(id)` ON DELETE SET NULL |
| `notified_agents` | UUID[] | NULL | — | Array de UUIDs dos agentes notificados |
| `acted_on` | BOOLEAN | NOT NULL | `FALSE` | Foi accionado |
| `acted_on_at` | TIMESTAMPTZ | NULL | — | Data de acção |
| `converted_deal_id` | UUID | NULL | — | FK → `deals(id)` ON DELETE SET NULL |
| `ai_analysis` | TEXT | NULL | — | Análise de oportunidade gerada pelo Claude |
| `score_breakdown` | JSONB | NULL | — | `{type:35, recency:20, zone:15, value:10}` |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | Data de criação |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | Actualizado por trigger |

**Índices:**
```
idx_signals_type     ON signals(type)
idx_signals_status   ON signals(status)
idx_signals_priority ON signals(priority DESC, probability_score DESC)
idx_signals_date     ON signals(signal_date DESC)
idx_signals_zone     ON signals(property_zone)
```

**RLS Policies:**
| Policy | Operação | Regra |
|---|---|---|
| `signals_select` | SELECT | Qualquer autenticado |
| `signals_insert` | INSERT | Qualquer autenticado |
| `signals_update` | UPDATE | Admin OU `assigned_to = auth.uid()` |
| `Service role has full access to signals` | ALL | service_role |
| `Agents can manage signals` | ALL | `true` (adicionada em 002) |

**Trigger:** `trg_signals_updated_at`

---

### `automations_log`
**Descrição:** Audit trail de execuções dos workflows n8n. Permite debug, análise de custo por workflow, e rastreamento de performance. Inserido pelo service_role via n8n.

| Campo | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `uuid_generate_v4()` | PK |
| `workflow_name` | TEXT | NOT NULL | — | Nome: `lead_enrichment`, `dormant_reactivation`, etc. |
| `execution_id` | TEXT | NULL | — | ID de execução n8n |
| `trigger_type` | TEXT | NULL | — | `webhook`, `cron`, `manual`, `supabase_event` |
| `trigger_payload` | JSONB | NULL | — | Payload do trigger |
| `contact_id` | UUID | NULL | — | FK → `contacts(id)` ON DELETE SET NULL |
| `deal_id` | UUID | NULL | — | FK → `deals(id)` ON DELETE SET NULL |
| `property_id` | UUID | NULL | — | FK → `properties(id)` ON DELETE SET NULL |
| `status` | TEXT | NOT NULL | `'running'` | `running`, `success`, `error`, `partial` |
| `started_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | Início da execução |
| `completed_at` | TIMESTAMPTZ | NULL | — | Fim da execução |
| `duration_ms` | INT | NULL | — | Duração em ms |
| `outcome` | JSONB | NULL | — | Ex: `{actions_taken:[...], messages_sent:2}` |
| `error_message` | TEXT | NULL | — | Mensagem de erro |
| `retry_count` | SMALLINT | NULL | `0` | Número de tentativas |
| `tokens_used` | INT | NULL | — | Tokens Claude utilizados |
| `estimated_cost_eur` | DECIMAL(8,6) | NULL | — | Custo estimado em EUR |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | Data de criação |

**Índices:**
```
idx_automations_workflow ON automations_log(workflow_name, started_at DESC)
idx_automations_status   ON automations_log(status)
idx_automations_contact  ON automations_log(contact_id)
```

**RLS Policies:**
| Policy | Operação | Regra |
|---|---|---|
| `automations_log_select` | SELECT | Apenas admins |
| `automations_log_insert` | INSERT | Sempre TRUE (permite inserção pelo n8n service key) |

---

### `notifications`
**Descrição:** Fila de notificações multi-canal unificada: email (Resend), WhatsApp (Meta Business API), push (VAPID), SMS (Twilio). Rastreia estado de entrega com IDs externos.

| Campo | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `uuid_generate_v4()` | PK |
| `user_id` | UUID | NULL | — | FK → `profiles(id)` ON DELETE CASCADE |
| `contact_id` | UUID | NULL | — | FK → `contacts(id)` ON DELETE CASCADE |
| `channel` | notification_channel | NOT NULL | — | Canal de entrega |
| `subject` | TEXT | NULL | — | Assunto |
| `body` | TEXT | NOT NULL | — | Corpo da notificação |
| `template_id` | TEXT | NULL | — | ID do template |
| `template_vars` | JSONB | NULL | — | Variáveis do template |
| `status` | TEXT | NOT NULL | `'pending'` | `pending`, `sent`, `delivered`, `failed`, `bounced`, `opened` |
| `sent_at` | TIMESTAMPTZ | NULL | — | Data de envio |
| `delivered_at` | TIMESTAMPTZ | NULL | — | Data de entrega |
| `opened_at` | TIMESTAMPTZ | NULL | — | Data de abertura |
| `failed_at` | TIMESTAMPTZ | NULL | — | Data de falha |
| `failure_reason` | TEXT | NULL | — | Razão de falha |
| `retry_count` | SMALLINT | NULL | `0` | Tentativas de reenvio |
| `deal_id` | UUID | NULL | — | FK → `deals(id)` ON DELETE SET NULL |
| `property_id` | UUID | NULL | — | FK → `properties(id)` ON DELETE SET NULL |
| `signal_id` | UUID | NULL | — | FK → `signals(id)` ON DELETE SET NULL |
| `is_automated` | BOOLEAN | NOT NULL | `FALSE` | Enviada por automação |
| `automation_id` | TEXT | NULL | — | ID execução n8n |
| `external_id` | TEXT | NULL | — | ID Resend/Twilio |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | Data de criação |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | Actualizado por trigger |

**Índices:**
```
idx_notifications_user    ON notifications(user_id, status)
idx_notifications_pending ON notifications(status) WHERE status = 'pending'
```

**RLS Policies:**
| Policy | Operação | Regra |
|---|---|---|
| `notifications_select` | SELECT | `user_id = auth.uid()` OU admin |
| `notifications_insert` | INSERT | Qualquer autenticado |
| `notifications_update` | UPDATE | `user_id = auth.uid()` OU admin |

**Trigger:** `trg_notifications_updated_at`

---

### `market_snapshots`
**Descrição:** Métricas de mercado diárias agregadas por zona/tipologia. Geradas pelo Workflow B (Daily Market Intelligence). Alimentam o BI no Metabase e o modelo XGBoost AVM.

| Campo | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `uuid_generate_v4()` | PK |
| `snapshot_date` | DATE | NOT NULL | `CURRENT_DATE` | Data do snapshot |
| `concelho` | TEXT | NOT NULL | — | Município |
| `zone` | TEXT | NULL | — | Zona específica |
| `typologia` | TEXT | NULL | — | Tipologia (T1, T2, V3, etc.) |
| `median_price_sqm` | DECIMAL(8,2) | NULL | — | Mediana do preço por m² |
| `avg_price_sqm` | DECIMAL(8,2) | NULL | — | Média do preço por m² |
| `median_total_price` | DECIMAL(12,2) | NULL | — | Mediana do preço total |
| `active_listings` | INT | NULL | — | Listagens activas |
| `new_listings_7d` | INT | NULL | — | Novas listagens nos últimos 7 dias |
| `sold_last_30d` | INT | NULL | — | Vendidas nos últimos 30 dias |
| `avg_days_on_market` | DECIMAL(6,1) | NULL | — | Dias médios no mercado |
| `price_change_pct_30d` | DECIMAL(6,3) | NULL | — | Variação de preço 30 dias (%) |
| `price_change_pct_yoy` | DECIMAL(6,3) | NULL | — | Variação de preço anual (%) |
| `avg_discount_pct` | DECIMAL(5,2) | NULL | — | Desconto médio negociado (%) |
| `supply_demand_ratio` | DECIMAL(5,2) | NULL | — | Rácio oferta/procura |
| `hot_score` | SMALLINT | NULL | — | Score de "temperatura" da zona 0–100 |
| `source` | TEXT | NULL | `'aggregated'` | Fonte dos dados |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | Data de criação |

**Constraint único:** `UNIQUE(snapshot_date, concelho, zone, typologia)`

**Índices:**
```
idx_snapshots_date     ON market_snapshots(snapshot_date DESC)
idx_snapshots_concelho ON market_snapshots(concelho, snapshot_date DESC)
```

**RLS Policies (002):**
| Policy | Operação | Regra |
|---|---|---|
| `Anyone can read market snapshots` | SELECT | `true` |
| `Agents can insert snapshots` | INSERT | `true` |

---

### `visits`
**Descrição:** Agendamento e feedback de visitas a imóveis. Motor do Workflow 3: confirmação → lembrete T-24h → lembrete T-2h → feedback T+2h → relatório ao vendedor T+24h.

| Campo | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `uuid_generate_v4()` | PK |
| `property_id` | UUID | NOT NULL | — | FK → `properties(id)` ON DELETE CASCADE |
| `contact_id` | UUID | NOT NULL | — | FK → `contacts(id)` ON DELETE CASCADE |
| `deal_id` | UUID | NULL | — | FK → `deals(id)` ON DELETE SET NULL |
| `consultant_id` | UUID | NULL | — | FK → `profiles(id)` ON DELETE SET NULL |
| `scheduled_at` | TIMESTAMPTZ | NOT NULL | — | Data/hora da visita |
| `duration_min` | INT | NULL | `60` | Duração em minutos |
| `location_notes` | TEXT | NULL | — | Instruções de acesso |
| `status` | TEXT | NOT NULL | `'scheduled'` | `scheduled`, `confirmed`, `completed`, `cancelled`, `no_show` |
| `confirmed_at` | TIMESTAMPTZ | NULL | — | Data de confirmação |
| `completed_at` | TIMESTAMPTZ | NULL | — | Data de conclusão |
| `cancelled_at` | TIMESTAMPTZ | NULL | — | Data de cancelamento |
| `cancellation_reason` | TEXT | NULL | — | Razão de cancelamento |
| `feedback_score` | SMALLINT | NULL | — | Score 1–5 (1=adorei 70%, 2=interessante 45%, 3=não era 20%) |
| `feedback_comment` | TEXT | NULL | — | Comentário de feedback |
| `feedback_received_at` | TIMESTAMPTZ | NULL | — | Data do feedback |
| `probability_before` | SMALLINT | NULL | — | Probabilidade antes da visita |
| `probability_after` | SMALLINT | NULL | — | Probabilidade após a visita |
| `confirmation_sent` | BOOLEAN | NULL | `FALSE` | Confirmação enviada |
| `reminder_24h_sent` | BOOLEAN | NULL | `FALSE` | Lembrete 24h enviado |
| `reminder_2h_sent` | BOOLEAN | NULL | `FALSE` | Lembrete 2h enviado |
| `feedback_requested` | BOOLEAN | NULL | `FALSE` | Feedback solicitado |
| `notes` | TEXT | NULL | — | Notas |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | Data de criação |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | Actualizado por trigger |

**Índices:**
```
idx_visits_property  ON visits(property_id)
idx_visits_contact   ON visits(contact_id)
idx_visits_scheduled ON visits(scheduled_at ASC) WHERE status = 'scheduled'
```

**RLS Policies:**
| Policy | Operação | Regra |
|---|---|---|
| `visits_select` | SELECT | Admin OU `consultant_id = auth.uid()` OU contacto do utilizador |
| `visits_insert` | INSERT | Qualquer autenticado |
| `visits_update` | UPDATE | Admin OU `consultant_id = auth.uid()` |

**Trigger:** `trg_visits_updated_at`

---

### `vendor_reports`
**Descrição:** Relatórios semanais automatizados aos proprietários dos imóveis. Narrativa gerada pelo Claude Sonnet no idioma preferido do proprietário. Recomendação de preço: maintain/reduce_5/reduce_10/increase_3.

| Campo | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `uuid_generate_v4()` | PK |
| `property_id` | UUID | NOT NULL | — | FK → `properties(id)` ON DELETE CASCADE |
| `owner_contact_id` | UUID | NOT NULL | — | FK → `contacts(id)` ON DELETE RESTRICT |
| `period_start` | DATE | NOT NULL | — | Início do período |
| `period_end` | DATE | NOT NULL | — | Fim do período |
| `portal_views` | INT | NULL | `0` | Visualizações no portal |
| `unique_visitors` | INT | NULL | `0` | Visitantes únicos |
| `inquiries_received` | INT | NULL | `0` | Pedidos de informação recebidos |
| `visits_conducted` | INT | NULL | `0` | Visitas realizadas |
| `visit_feedback_avg` | DECIMAL(3,2) | NULL | — | Média de feedback das visitas |
| `comparable_listings` | INT | NULL | — | Nº de comparáveis no mercado |
| `comparable_avg_price` | DECIMAL(12,2) | NULL | — | Preço médio dos comparáveis |
| `comparable_avg_dom` | INT | NULL | — | Dias médios dos comparáveis |
| `current_price` | DECIMAL(12,2) | NULL | — | Preço actual |
| `avm_estimate` | DECIMAL(12,2) | NULL | — | Estimativa AVM |
| `price_recommendation` | TEXT | NULL | — | `maintain`, `reduce_5`, `reduce_10`, `increase_3` |
| `narrative_language` | TEXT | NULL | `'pt'` | Idioma da narrativa |
| `narrative` | TEXT | NULL | — | Narrativa ~300 palavras (Claude Sonnet) |
| `sent_at` | TIMESTAMPTZ | NULL | — | Data de envio |
| `email_status` | TEXT | NULL | — | Estado do email |
| `wa_status` | TEXT | NULL | — | Estado do WhatsApp |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | Data de criação |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | Actualizado por trigger |

**Índices:**
```
idx_vendor_reports_prop ON vendor_reports(property_id, period_end DESC)
```

**RLS Policies:**
| Policy | Operação | Regra |
|---|---|---|
| `vendor_reports_select` | SELECT | Qualquer autenticado |
| `vendor_reports_insert` | INSERT | Qualquer autenticado |
| `vendor_reports_update` | UPDATE | Apenas admins |

**Trigger:** `trg_vendor_reports_updated_at`

---

### `email_sequences`
**Descrição:** Definições de campanhas drip (sequências de emails). Cada sequência tem steps com offset de dias, canal, e template. Usada pelos Workflow 2 (reactivação dormentes) e Workflow 4 (pós-CPCV).

| Campo | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `uuid_generate_v4()` | PK |
| `name` | TEXT | NOT NULL UNIQUE | — | Nome da sequência |
| `description` | TEXT | NULL | — | Descrição |
| `trigger_event` | TEXT | NOT NULL | — | `new_lead`, `dormant_14d`, `post_cpcv`, `post_escritura` |
| `target_segment` | TEXT | NULL | — | `buyer_cold`, `investor`, `seller` |
| `is_active` | BOOLEAN | NOT NULL | `TRUE` | Activa |
| `steps` | JSONB | NOT NULL | `'[]'` | `[{day:0, channel:'email', template:'welcome'}, ...]` |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | Data de criação |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | Actualizado por trigger |

**Trigger:** `trg_email_sequences_updated_at`

---

### `contact_sequences`
**Descrição:** Inscrição de contactos em campanhas drip e progresso por step. Constraint único impede inscrição duplicada.

| Campo | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `uuid_generate_v4()` | PK |
| `contact_id` | UUID | NOT NULL | — | FK → `contacts(id)` ON DELETE CASCADE |
| `sequence_id` | UUID | NOT NULL | — | FK → `email_sequences(id)` ON DELETE CASCADE |
| `status` | TEXT | NOT NULL | `'active'` | `active`, `paused`, `completed`, `unsubscribed` |
| `current_step` | INT | NOT NULL | `0` | Step actual |
| `next_step_at` | TIMESTAMPTZ | NULL | — | Quando enviar o próximo step |
| `completed_at` | TIMESTAMPTZ | NULL | — | Data de conclusão |
| `enrolled_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | Data de inscrição |
| `enrolled_by` | TEXT | NULL | — | `n8n_workflow_1`, `manual`, `api` |
| `emails_sent` | INT | NULL | `0` | Emails enviados |
| `emails_opened` | INT | NULL | `0` | Emails abertos |
| `emails_clicked` | INT | NULL | `0` | Cliques em links |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | Data de criação |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | Actualizado por trigger |

**Constraint único:** `UNIQUE(contact_id, sequence_id)`

**RLS Policies:**
| Policy | Operação | Regra |
|---|---|---|
| `contact_sequences_select` | SELECT | Qualquer autenticado |
| `contact_sequences_insert` | INSERT | Qualquer autenticado |
| `contact_sequences_update` | UPDATE | Qualquer autenticado |

**Trigger:** `trg_contact_sequences_updated_at`

---

### `referral_network`
**Descrição:** Programa de gamificação de referências: Bronze→Silver→Gold→Platinum. Bónus de comissão e benefícios actualizados automaticamente por trigger quando `total_referrals` muda.

| Campo | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `uuid_generate_v4()` | PK |
| `contact_id` | UUID | NOT NULL UNIQUE | — | FK → `contacts(id)` ON DELETE CASCADE |
| `tier` | referral_tier | NOT NULL | `'bronze'` | Nível actual |
| `total_referrals` | INT | NOT NULL | `0` | Total de referências |
| `successful_deals` | INT | NOT NULL | `0` | Negócios convertidos |
| `total_commission_earned` | DECIMAL(10,2) | NOT NULL | `0` | Total ganho em comissões (EUR) |
| `commission_bonus_pct` | DECIMAL(5,4) | NOT NULL | `0` | Bónus: 0%, 0.1%, 0.2%, 0.25% |
| `has_newsletter` | BOOLEAN | NULL | `TRUE` | Acesso à newsletter |
| `has_market_reports` | BOOLEAN | NULL | `FALSE` | Relatórios de mercado (Silver+) |
| `has_vip_events` | BOOLEAN | NULL | `FALSE` | Eventos VIP (Gold+) |
| `has_off_market_access` | BOOLEAN | NULL | `FALSE` | Acesso off-market (Gold+) |
| `has_dedicated_account` | BOOLEAN | NULL | `FALSE` | Account manager dedicado (Platinum) |
| `last_referral_at` | TIMESTAMPTZ | NULL | — | Última referência |
| `next_tier_referrals` | INT | NULL | — | Referências para próximo nível |
| `notes` | TEXT | NULL | — | Notas |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | Data de criação |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | Actualizado por trigger |

**Índices:**
```
idx_referral_tier ON referral_network(tier)
```

**RLS Policies:**
| Policy | Operação | Regra |
|---|---|---|
| `referral_select` | SELECT | Qualquer autenticado |
| `referral_insert` | INSERT | Apenas admins |
| `referral_update` | UPDATE | Apenas admins |

**Triggers:**
- `trg_referral_network_updated_at` — actualiza `updated_at`
- `trg_referral_tier` — actualiza tier, commission_bonus_pct e benefícios BEFORE INSERT OR UPDATE OF total_referrals

---

### `market_data`
**Descrição:** Benchmarks de preço por zona, actualizados pelo scraper de mercado. Usados pelo portal para mostrar comparativos e pelo AVM.

| Campo | Tipo | Nullable | Default | Descrição |
|---|---|---|---|---|
| `zona` | TEXT | NOT NULL | — | PK — Nome da zona |
| `preco_m2` | DECIMAL(10,2) | NULL | — | Preço mediano por m² (EUR) |
| `yield_bruto` | DECIMAL(5,2) | NULL | — | Yield bruto de arrendamento (%) |
| `yoy_percent` | DECIMAL(5,2) | NULL | — | Variação anual (%) |
| `dias_mercado` | INT | NULL | — | Dias médios no mercado |
| `cached_at` | TIMESTAMPTZ | NULL | `NOW()` | Última actualização |

**Dados de seed incluídos (18 zonas):**
```
Lisboa €5.000/m² | Lisboa Chiado €7.000 | Lisboa Príncipe Real €7.400
Cascais €4.713 | Cascais Quinta Marinha €6.500 | Sintra €3.200
Porto €3.643 | Porto Foz €4.800 | Algarve €3.941
Algarve Vilamoura €5.500 | Algarve Lagos €4.200 | Comporta €8.500
Ericeira €3.500 | Madeira €3.760 | Açores €1.952
```

---

## 4. TRIGGERS E FUNÇÕES

### Trigger: `update_updated_at()`
Actualiza automaticamente o campo `updated_at` antes de qualquer UPDATE.

Aplicado a: `profiles`, `contacts`, `properties`, `deals`, `tasks`, `investor_profiles`, `signals`, `notifications`, `vendor_reports`, `email_sequences`, `contact_sequences`, `referral_network`, `visits`

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
```

---

### Trigger: `update_contact_last_activity()`
Após INSERT em `activities`, actualiza `last_contact_at` e incrementa `total_interactions` no contacto.

```sql
CREATE OR REPLACE FUNCTION update_contact_last_activity()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.contact_id IS NOT NULL THEN
    UPDATE contacts
    SET
      last_contact_at    = GREATEST(last_contact_at, NEW.occurred_at),
      total_interactions = total_interactions + 1
    WHERE id = NEW.contact_id;
  END IF;
  RETURN NEW;
END;
$$;
```

---

### Trigger: `generate_deal_reference()`
Gera automaticamente a referência do negócio no formato `AG-YYYY-NNNN` se não fornecida.

Usa a sequência `deal_reference_seq`.

```sql
CREATE SEQUENCE IF NOT EXISTS deal_reference_seq START WITH 1;

CREATE OR REPLACE FUNCTION generate_deal_reference()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.reference IS NULL THEN
    NEW.reference := 'AG-' || EXTRACT(YEAR FROM NOW())::TEXT
                     || '-' || LPAD(nextval('deal_reference_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;
```

---

### Trigger: `update_referral_tier()`
Actualiza automaticamente o tier, bónus de comissão e benefícios do parceiro de referência quando `total_referrals` é alterado.

Lógica de escalada:
- 0–2 referências → bronze, +0%
- 3–5 referências → silver, +0.1%
- 6–10 referências → gold, +0.2%
- 11+ referências → platinum, +0.25%

---

### Função: `match_properties()`
Pesquisa semântica de propriedades via pgvector (distância cosseno). Suporta filtros de orçamento, zona, tipologia e quartos.

```sql
CREATE OR REPLACE FUNCTION match_properties(
  query_embedding    vector(1536),
  match_threshold    FLOAT           DEFAULT 0.75,
  match_count        INT             DEFAULT 10,
  budget_min         DECIMAL         DEFAULT NULL,
  budget_max         DECIMAL         DEFAULT NULL,
  zonas              TEXT[]          DEFAULT NULL,
  property_types     TEXT[]          DEFAULT NULL,
  bedrooms_min_arg   INT             DEFAULT NULL,
  status_filter      property_status DEFAULT 'active'
)
RETURNS TABLE (id UUID, title TEXT, price DECIMAL, ...)
```

**Uso:** Motor de matching IA para compradores, alertas de investidor (Workflow D).

---

### Função: `get_pipeline_summary()`
KPIs do pipeline por etapa para o dashboard. Parâmetro opcional `p_consultant_id` para vista individual vs. equipa.

Retorna: `stage`, `deal_count`, `total_value`, `weighted_gci`, `avg_probability`

---

### Função: `is_admin()`
Helper para políticas RLS — verifica se o utilizador actual tem role `admin` ou `manager`.

```sql
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')
  );
$$;
```

---

## 5. MIGRAÇÕES (cronologia completa)

### Ordem de execução obrigatória:

| Ordem | Ficheiro | Tipo | O que faz |
|---|---|---|---|
| 1 | `001_initial_check.sql` | Diagnóstico | Verificação do estado das tabelas existentes — NÃO altera nada |
| 2 | `001_initial_schema.sql` | Schema principal | Cria toda a estrutura: extensões, enums, 13 tabelas, índices, triggers, funções, RLS |
| 3 | `002_missing_tables.sql` | Tabelas adicionais | Cria 7 tabelas em falta: profiles (v2), activities, visits, notifications, signals, market_snapshots, tasks |
| 4 | `002_seed_properties.sql` | Dados iniciais | Insere 20 propriedades do portfolio nos seguintes destinos: Lisboa (4), Cascais (3), Comporta (2), Porto (3), Algarve (2), Madeira (2), Sintra (2), Ericeira (2) |
| 5 | `003_portal_compat.sql` | Compatibilidade | Adiciona colunas de compatibilidade ao portal web: imovel, valor, fase, comprador, ref nas deals; nome, zona, bairro, tipo nos properties |
| 6 | `rls-policies.sql` | Políticas | Políticas RLS adicionais (versão inicial/simplificada) para users, properties, deals, contacts, visitas |
| — | `schema.sql` | Schema inicial | Schema simplificado original (3 tabelas apenas: contacts, deals, properties) — precede o schema v2 |

---

### Detalhes por migração:

#### `001_initial_check.sql`
- **Tipo:** Diagnóstico / read-only
- **O que faz:** SELECT em `information_schema.tables` para listar tabelas existentes com contagem de colunas
- **Tabelas criadas:** Nenhuma
- **Quando usar:** Antes de qualquer migração, para verificar o estado actual

#### `001_initial_schema.sql`
- **Tipo:** Schema principal v2.0 (produção)
- **O que faz:** Schema completo para CRM imobiliário de luxo com automação IA
- **Tabelas criadas:** `profiles`, `contacts`, `properties`, `market_properties`, `deals`, `activities`, `tasks`, `investor_profiles`, `signals`, `automations_log`, `notifications`, `market_snapshots`, `visits`, `vendor_reports`, `email_sequences`, `contact_sequences`, `referral_network`, `market_data`
- **Funções criadas:** `update_updated_at()`, `update_contact_last_activity()`, `generate_deal_reference()`, `update_referral_tier()`, `match_properties()`, `get_pipeline_summary()`, `is_admin()`
- **Sequências:** `deal_reference_seq`
- **Dados seed:** 18 zonas em `market_data`
- **RLS:** Activado em todas as tabelas com políticas granulares

#### `002_missing_tables.sql`
- **Tipo:** Tabelas adicionais e índices
- **O que faz:** Cria tabelas que estavam em falta após migração inicial
- **Tabelas criadas:** `profiles` (versão simplificada), `activities`, `visits`, `notifications`, `signals`, `market_snapshots`, `tasks`
- **Índices criados:** 8 índices de performance
- **Permissões:** GRANT a authenticated e service_role

> **Nota:** Algumas destas tabelas já existem em `001_initial_schema.sql`. O uso de `CREATE TABLE IF NOT EXISTS` garante idempotência.

#### `002_seed_properties.sql`
- **Tipo:** Dados iniciais
- **O que faz:** Insere 20 propriedades do portfolio Agency Group
- **Registos inseridos:**
  - Lisboa: Penthouse Príncipe Real (€2.85M), Apartamento Chiado (€1.45M), Moradia Belém (€3.2M), Apartamento Campo de Ourique (€780K)
  - Cascais: Villa Quinta da Marinha (€3.8M), Moradia Estoril Frente Mar (€2.1M), Apartamento Cascais Centro (€650K)
  - Comporta: Herdade Exclusiva (€6.5M), Villa Carvalhal (€1.85M)
  - Porto: Apartamento Foz do Douro (€980K), Penthouse Boavista (€1.2M), Apartamento Cedofeita (€420K)
  - Algarve: Villa Vale do Lobo (€4.2M), Apartamento Vilamoura Marina (€890K)
  - Madeira: Apartamento Funchal Prime (€980K), Villa Câmara de Lobos (€1.35M)
  - Sintra: Quinta Histórica (€2.8M), Moradia Colares (€1.1M)
  - Ericeira: Apartamento Surf (€450K), Villa Mafra (€1.65M)
- **Conflito:** ON CONFLICT (id) DO UPDATE — idempotente

#### `003_portal_compat.sql`
- **Tipo:** Migração de compatibilidade
- **O que faz:** Adiciona colunas de compatibilidade ao portal web sem quebrar o schema existente
- **Tabelas alteradas:**
  - `deals`: ADD COLUMN imovel, valor, fase, comprador, ref, notas, cpcv_date_text, escritura_date_text; ALTER COLUMN contact_id DROP NOT NULL; ALTER COLUMN title DROP NOT NULL
  - `properties`: ADD COLUMN nome, zona, bairro, tipo, preco, area, quartos, casas_banho, features (TEXT[]), gradient
  - `signals`: verificação condicional de política RLS
- **Índices:** `idx_deals_ref` UNIQUE WHERE ref IS NOT NULL
- **Políticas:** service_role full access em deals, contacts, properties, signals

#### `rls-policies.sql`
- **Tipo:** Políticas RLS adicionais (versão inicial/simplificada)
- **O que faz:** Define políticas RLS para o schema original simplificado
- **Tabelas:** `users`, `properties`, `deals`, `contacts`, `visitas`

> **Atenção:** Este ficheiro referencia a tabela `visitas` (com "s" no final) e `users` — nomes do schema inicial v1. No schema v2 (`001_initial_schema.sql`), a tabela chama-se `visits` e `profiles`. Executar com cuidado para evitar erros de tabela inexistente.

---

## 6. COMO RESTAURAR A BASE DE DADOS

### Pré-requisitos
- Conta Supabase (supabase.com)
- Acesso ao Supabase Dashboard ou CLI instalado
- Ficheiros SQL das migrações

### Passo 1 — Criar novo projecto Supabase

1. Aceder a [supabase.com/dashboard](https://supabase.com/dashboard)
2. Clicar em **New Project**
3. Configurar:
   - **Name:** `agency-group-portal` (ou nome equivalente)
   - **Database Password:** Guardar numa localização segura
   - **Region:** `West EU (Ireland)` — mais próximo de Portugal
   - **Pricing Plan:** Pro (necessário para pgvector e mais de 500MB)
4. Aguardar ~2 minutos para o projecto ficar pronto

### Passo 2 — Configurar variáveis de ambiente

Após criar o projecto, recolher as seguintes credenciais em **Settings → API**:

```env
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
SUPABASE_SERVICE_ROLE_KEY=[service-role-key]
```

### Passo 3 — Executar as migrações em ordem

Aceder a **SQL Editor** no Supabase Dashboard e executar os ficheiros **pela seguinte ordem exacta**:

```
1. supabase/migrations/001_initial_schema.sql   ← schema completo v2
2. supabase/migrations/002_missing_tables.sql   ← tabelas adicionais
3. supabase/migrations/002_seed_properties.sql  ← 20 propriedades portfolio
4. supabase/migrations/003_portal_compat.sql    ← compatibilidade portal
```

> **IMPORTANTE:** NÃO executar `001_initial_check.sql` (só diagnóstico) nem `schema.sql` (schema v1 obsoleto) nem `rls-policies.sql` (referencia tabelas v1).

### Passo 4 — Verificar RLS

Executar no SQL Editor para confirmar que RLS está activo:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

Todas as tabelas devem ter `rowsecurity = true`.

### Passo 5 — Verificar extensões e funções

```sql
-- Verificar extensões
SELECT extname, extversion FROM pg_extension
WHERE extname IN ('uuid-ossp', 'vector', 'pg_trgm', 'btree_gin', 'pgcrypto');

-- Verificar funções
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;
-- Deve mostrar: generate_deal_reference, get_pipeline_summary, is_admin, match_properties, update_contact_last_activity, update_referral_tier, update_updated_at

-- Verificar tabelas
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

### Passo 6 — Configurar autenticação

Em **Authentication → Providers**:

1. **Email** — activar (deve estar activo por default)
2. **Google OAuth** — configurar com:
   - Client ID e Secret do Google Cloud Console
   - Redirect URL: `https://[project-ref].supabase.co/auth/v1/callback`

Em **Authentication → URL Configuration**:
- Site URL: URL de produção da aplicação
- Redirect URLs: adicionar URLs permitidas

### Passo 7 — Criar primeiro utilizador admin

```sql
-- Após criar conta via Auth, promover a admin:
UPDATE profiles
SET role = 'admin'
WHERE email = 'admin@agencygroup.pt';
```

### Passo 8 — Configurar Storage (se necessário)

Em **Storage**, criar os seguintes buckets:
- `property-photos` — fotos de propriedades (público)
- `documents` — documentos privados (privado)
- `avatars` — fotos de perfil (público)

### Passo 9 — Verificação final

```sql
-- Confirmar contagem de registos
SELECT 'properties' as tabela, COUNT(*) as registos FROM properties
UNION ALL SELECT 'market_data', COUNT(*) FROM market_data
UNION ALL SELECT 'contacts', COUNT(*) FROM contacts
UNION ALL SELECT 'deals', COUNT(*) FROM deals;

-- Esperado: properties=20, market_data=18, contacts=0, deals=0
```

---

## 7. SQL COMPLETO DE RESTAURO

SQL completo das tabelas críticas para restauro manual ou emergência:

### Extensões e Enums

```sql
-- EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ENUMS
CREATE TYPE property_status AS ENUM (
  'active', 'under_offer', 'cpcv', 'sold', 'withdrawn', 'rented', 'off_market'
);

CREATE TYPE property_type AS ENUM (
  'apartment', 'villa', 'townhouse', 'penthouse', 'land',
  'commercial', 'office', 'warehouse', 'hotel', 'development_plot'
);

CREATE TYPE contact_status AS ENUM (
  'lead', 'prospect', 'qualified', 'active', 'negotiating',
  'client', 'vip', 'dormant', 'lost', 'referrer'
);

CREATE TYPE contact_role AS ENUM (
  'buyer', 'seller', 'investor', 'tenant', 'landlord',
  'referrer', 'developer', 'solicitor', 'notary', 'other'
);

CREATE TYPE deal_stage AS ENUM (
  'lead', 'qualification', 'visit_scheduled', 'visit_done', 'proposal',
  'negotiation', 'cpcv', 'escritura', 'post_sale',
  'prospecting', 'valuation', 'mandate', 'active_listing',
  'offer_received', 'cpcv_sell', 'escritura_sell'
);

CREATE TYPE deal_type AS ENUM (
  'buy_side', 'sell_side', 'dual_agency', 'rental', 'investment'
);

CREATE TYPE activity_type AS ENUM (
  'call_outbound', 'call_inbound', 'email_sent', 'email_received',
  'whatsapp_sent', 'whatsapp_received', 'meeting', 'visit', 'note',
  'document_sent', 'offer_made', 'offer_received', 'task_completed', 'system_event'
);

CREATE TYPE signal_type AS ENUM (
  'inheritance', 'insolvency', 'divorce', 'relocation', 'multi_property',
  'price_reduction', 'stagnated_listing', 'new_below_avm',
  'listing_removed', 'hot_zone_new'
);

CREATE TYPE signal_status AS ENUM (
  'new', 'in_progress', 'contacted', 'converted', 'dismissed'
);

CREATE TYPE task_status AS ENUM (
  'pending', 'in_progress', 'completed', 'cancelled', 'deferred'
);

CREATE TYPE notification_channel AS ENUM (
  'email', 'whatsapp', 'push', 'sms', 'in_app'
);

CREATE TYPE referral_tier AS ENUM (
  'bronze', 'silver', 'gold', 'platinum'
);

CREATE TYPE lead_tier AS ENUM ('A', 'B', 'C');
```

---

### Tabela `deals` (SQL completo)

```sql
CREATE SEQUENCE IF NOT EXISTS deal_reference_seq START WITH 1;

CREATE TABLE IF NOT EXISTS deals (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title                 TEXT,
  reference             TEXT UNIQUE,
  contact_id            UUID REFERENCES contacts(id) ON DELETE RESTRICT,
  property_id           UUID REFERENCES properties(id) ON DELETE SET NULL,
  assigned_consultant   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  type                  deal_type NOT NULL DEFAULT 'buy_side',
  stage                 deal_stage NOT NULL DEFAULT 'lead',
  probability           SMALLINT DEFAULT 5 CHECK (probability BETWEEN 0 AND 100),
  deal_value            DECIMAL(12, 2),
  commission_rate       DECIMAL(5, 4) DEFAULT 0.05,
  gci_net               DECIMAL(10, 2),
  cpcv_date             DATE,
  escritura_date        DATE,
  expected_close_date   DATE,
  actual_close_date     DATE,
  cpcv_deposit          DECIMAL(12, 2),
  cpcv_deposit_pct      DECIMAL(5, 2),
  notario_id            UUID REFERENCES contacts(id) ON DELETE SET NULL,
  advogado_id           UUID REFERENCES contacts(id) ON DELETE SET NULL,
  initial_offer         DECIMAL(12, 2),
  accepted_offer        DECIMAL(12, 2),
  negotiation_notes     TEXT,
  lost_at               TIMESTAMPTZ,
  lost_reason           TEXT,
  lost_to_agency        TEXT,
  nps_score             SMALLINT CHECK (nps_score BETWEEN 0 AND 10),
  nps_comment           TEXT,
  google_review_requested BOOLEAN DEFAULT FALSE,
  google_review_at      TIMESTAMPTZ,
  ai_deal_memo          TEXT,
  ai_risk_factors       JSONB,
  source                TEXT,
  tags                  TEXT[],
  notes                 TEXT,
  -- Campos de compatibilidade portal (003)
  imovel                TEXT,
  valor                 TEXT,
  fase                  TEXT,
  comprador             TEXT,
  ref                   TEXT,
  notas                 TEXT,
  cpcv_date_text        TEXT,
  escritura_date_text   TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_deals_reference
BEFORE INSERT ON deals
FOR EACH ROW EXECUTE FUNCTION generate_deal_reference();

CREATE TRIGGER trg_deals_updated_at
BEFORE UPDATE ON deals
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

### Tabela `contacts` (SQL completo)

```sql
CREATE TABLE IF NOT EXISTS contacts (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name             TEXT NOT NULL,
  email                 TEXT,
  phone                 TEXT,
  whatsapp              TEXT,
  nationality           CHAR(2),
  language              TEXT DEFAULT 'pt',
  role                  contact_role NOT NULL DEFAULT 'buyer',
  status                contact_status NOT NULL DEFAULT 'lead',
  lead_tier             lead_tier,
  lead_score            SMALLINT DEFAULT 0 CHECK (lead_score BETWEEN 0 AND 100),
  lead_score_breakdown  JSONB,
  source                TEXT,
  source_detail         TEXT,
  referrer_id           UUID REFERENCES contacts(id) ON DELETE SET NULL,
  assigned_to           UUID REFERENCES profiles(id) ON DELETE SET NULL,
  budget_min            DECIMAL(12, 2),
  budget_max            DECIMAL(12, 2),
  preferred_locations   TEXT[],
  typologies_wanted     TEXT[],
  bedrooms_min          SMALLINT,
  bedrooms_max          SMALLINT,
  features_required     TEXT[],
  use_type              TEXT,
  timeline              TEXT,
  financing_type        TEXT,
  property_to_sell_id   UUID,
  asking_price          DECIMAL(12, 2),
  motivation_score      SMALLINT CHECK (motivation_score BETWEEN 1 AND 5),
  last_contact_at       TIMESTAMPTZ,
  next_followup_at      TIMESTAMPTZ,
  total_interactions    INT DEFAULT 0,
  opt_out_marketing     BOOLEAN NOT NULL DEFAULT FALSE,
  opt_out_whatsapp      BOOLEAN NOT NULL DEFAULT FALSE,
  gdpr_consent          BOOLEAN NOT NULL DEFAULT FALSE,
  gdpr_consent_at       TIMESTAMPTZ,
  enriched_at           TIMESTAMPTZ,
  clearbit_data         JSONB,
  apollo_data           JSONB,
  linkedin_url          TEXT,
  company               TEXT,
  job_title             TEXT,
  qualified_at          TIMESTAMPTZ,
  qualification_notes   TEXT,
  ai_summary            TEXT,
  ai_suggested_action   TEXT,
  detected_intent       TEXT,
  tags                  TEXT[],
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
```

---

### Tabela `properties` (SQL completo)

```sql
CREATE TABLE IF NOT EXISTS properties (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title                 TEXT,
  description           TEXT,
  description_en        TEXT,
  description_fr        TEXT,
  status                property_status NOT NULL DEFAULT 'active',
  type                  property_type,
  price                 DECIMAL(12, 2),
  price_previous        DECIMAL(12, 2),
  price_reduced_at      TIMESTAMPTZ,
  price_per_sqm         DECIMAL(8, 2),
  address               TEXT,
  street                TEXT,
  city                  TEXT,
  concelho              TEXT,
  distrito              TEXT,
  parish                TEXT,
  postcode              TEXT,
  country               TEXT NOT NULL DEFAULT 'PT',
  latitude              DECIMAL(9, 6),
  longitude             DECIMAL(9, 6),
  zone                  TEXT,
  area_m2               DECIMAL(8, 2),
  area_plot_m2          DECIMAL(8, 2),
  area_terraco_m2       DECIMAL(8, 2),
  bedrooms              SMALLINT,
  bathrooms             SMALLINT,
  parking_spaces        SMALLINT DEFAULT 0,
  floor                 SMALLINT,
  total_floors          SMALLINT,
  year_built            SMALLINT,
  energy_certificate    TEXT,
  condition             TEXT,
  features              TEXT[],
  orientation           TEXT,
  furnished             BOOLEAN DEFAULT FALSE,
  is_exclusive          BOOLEAN NOT NULL DEFAULT FALSE,
  mandate_signed_at     TIMESTAMPTZ,
  mandate_expires_at    TIMESTAMPTZ,
  owner_contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  assigned_consultant   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  idealista_id          TEXT,
  imovirtual_id         TEXT,
  casasapo_id           TEXT,
  olx_id                TEXT,
  avm_estimate          DECIMAL(12, 2),
  avm_confidence        DECIMAL(4, 3),
  avm_updated_at        TIMESTAMPTZ,
  opportunity_score     SMALLINT DEFAULT 0 CHECK (opportunity_score BETWEEN 0 AND 100),
  investor_suitable     BOOLEAN NOT NULL DEFAULT FALSE,
  estimated_rental_yield DECIMAL(5, 2),
  estimated_cap_rate    DECIMAL(5, 2),
  estimated_irr         DECIMAL(5, 2),
  photos                TEXT[],
  virtual_tour_url      TEXT,
  floor_plan_url        TEXT,
  embedding             vector(1536),
  source                TEXT DEFAULT 'direct',
  is_off_market         BOOLEAN NOT NULL DEFAULT FALSE,
  portal_published      BOOLEAN NOT NULL DEFAULT FALSE,
  portal_published_at   TIMESTAMPTZ,
  views_total           INT DEFAULT 0,
  inquiries_total       INT DEFAULT 0,
  visits_total          INT DEFAULT 0,
  -- Campos portal (003)
  nome                  TEXT,
  zona                  TEXT,
  bairro                TEXT,
  tipo                  TEXT,
  preco                 DECIMAL(12, 2),
  area                  DECIMAL(8, 2),
  quartos               SMALLINT,
  casas_banho           SMALLINT,
  gradient              TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- Índice HNSW para pgvector (matching semântico)
CREATE INDEX IF NOT EXISTS idx_properties_embedding
  ON properties USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

---

### Tabela `activities` (SQL completo)

```sql
CREATE TABLE IF NOT EXISTS activities (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id      UUID REFERENCES contacts(id) ON DELETE CASCADE,
  deal_id         UUID REFERENCES deals(id) ON DELETE SET NULL,
  property_id     UUID REFERENCES properties(id) ON DELETE SET NULL,
  performed_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  type            activity_type NOT NULL,
  subject         TEXT,
  body            TEXT,
  duration_min    INT,
  outcome         TEXT,
  sentiment       TEXT,
  sentiment_score DECIMAL(4, 3),
  ai_summary      TEXT,
  is_automated    BOOLEAN NOT NULL DEFAULT FALSE,
  automation_id   TEXT,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_activity_update_contact
AFTER INSERT ON activities
FOR EACH ROW EXECUTE FUNCTION update_contact_last_activity();
```

---

### Tabela `signals` (SQL completo)

```sql
CREATE TABLE IF NOT EXISTS signals (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type                  signal_type NOT NULL,
  status                signal_status NOT NULL DEFAULT 'new',
  priority              SMALLINT NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  probability_score     SMALLINT DEFAULT 0 CHECK (probability_score BETWEEN 0 AND 100),
  property_id           UUID REFERENCES properties(id) ON DELETE SET NULL,
  property_address      TEXT,
  property_zone         TEXT,
  estimated_value       DECIMAL(12, 2),
  owner_name            TEXT,
  owner_contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  signal_date           DATE NOT NULL DEFAULT CURRENT_DATE,
  source                TEXT,
  source_url            TEXT,
  source_reference      TEXT,
  raw_data              JSONB,
  recommended_action    TEXT,
  action_deadline       DATE,
  assigned_to           UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notified_agents       UUID[],
  acted_on              BOOLEAN NOT NULL DEFAULT FALSE,
  acted_on_at           TIMESTAMPTZ,
  converted_deal_id     UUID REFERENCES deals(id) ON DELETE SET NULL,
  ai_analysis           TEXT,
  score_breakdown       JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
```

---

### Grants finais

```sql
-- Permissões após restauro completo
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role, authenticated;
```

---

*Documento gerado automaticamente a partir de:*
- `supabase/migrations/001_initial_check.sql`
- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/002_missing_tables.sql`
- `supabase/migrations/002_seed_properties.sql`
- `supabase/migrations/003_portal_compat.sql`
- `supabase/rls-policies.sql`
- `supabase/schema.sql`

*Agency Group | AMI 22506 | Portugal + Espanha + Madeira + Açores*
