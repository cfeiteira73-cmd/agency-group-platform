# 04 — DATABASE MAP
**Agency Group | Nano Detail Forensic Inventory | 2026-06-11**

---

## DATABASE INSTANCE

| Property | Value |
|----------|-------|
| Provider | Supabase |
| Project ID | isbfiofwpxqqpgxoftph |
| Region | eu-central-1 (Frankfurt, Germany) |
| Owner | cfeiteira73@gmail.com (personal account) |
| Plan | Unknown (PITR configured) |
| Backups | PITR enabled |
| Extensions | pgvector (embeddings), uuid-ossp |
| Connection | via service role key + anon key |

---

## CONFIRMED TABLES (REST API verified)

| Table | Row Count | Purpose | Owner System |
|-------|-----------|---------|-------------|
| capital_profiles | **7,342** | Institutional buyer network | Lead Engine |
| leads | **10,665** | Scraped lead queue | Lead Engine |
| outreach_queue | **3,120** | Pending outreach messages | Automation |
| contacts | **28** | Portal CRM contacts | Portal CRM |
| kpi_snapshots | **48** | Daily KPI tracking | Dashboard |
| properties | **55** | Property inventory | Inventory |
| matches | **17** | Buyer-property matches | Matching |
| offmarket_leads | **14** | Off-market pipeline | Off-market |
| learning_events | **14** | AI learning signals | ML |
| priority_items | **23** | Priority queue | Automation |
| activities | **8** | CRM activity log | CRM |
| deals | **8** | Deal pipeline | Revenue |
| used_magic_tokens | **38** | Magic link auth tokens | Auth |
| deal_packs | **2** | Generated deal packs | Revenue |
| notifications | **0** | Push notifications | Alerts |
| sofia_conversations | **0** | Sofia conversation sessions | Sofia AI |
| sofia_conversation_turns | **0** | Sofia message turns | Sofia AI |
| property_collections | **0** | Shared property collections | Portal |

---

## MISSING TABLES (referenced in code, do not exist)

| Table | Referenced By | Impact |
|-------|--------------|--------|
| partners | /api/partners/*, /api/agent-system | ~25 routes broken |
| campanhas | /api/campanhas, /api/campanhas/send | Campaign system dead |
| sellers | /api/contacts/sellers | Seller tracking missing |
| buyers | /api/buyers/[id]/* | Buyer portal broken |
| investment_portfolios | /api/portfolio, matching engine | Portfolio tracking missing |

---

## TABLE DETAILS (key tables)

### capital_profiles
```sql
-- Columns (inferred from data + migrations)
id              UUID PRIMARY KEY
name            TEXT
email           TEXT (67 rows with value)
phone           TEXT
company         TEXT
country_iso     TEXT (ISO-2 codes)
profile_type    TEXT (FAMILY_OFFICE, WEALTH_MANAGER, etc.)
lead_score      INTEGER (0-100)
linkedin_url    TEXT
investment_min  BIGINT
investment_max  BIGINT
preferred_zones TEXT[]
source          TEXT
created_at      TIMESTAMP
updated_at      TIMESTAMP
-- embedding VECTOR(1536) -- pgvector
```

### properties
```sql
-- Actual columns (CONFIRMED via REST API 2026-06-11)
id              UUID PRIMARY KEY
nome            TEXT        -- property name (NOT title)
zona            TEXT        -- zone (NOT zone)
bairro          TEXT        -- neighbourhood
tipo            TEXT        -- type (NOT type column)
preco           BIGINT      -- price in EUR (NOT price)
area            NUMERIC     -- area m² (NOT area_m2)
quartos         INTEGER     -- bedrooms (NOT bedrooms)
casas_banho     INTEGER     -- bathrooms (NOT bathrooms)
energia         TEXT        -- energy certificate (NOT energy_certificate)
status          TEXT        -- active/sold/pending
descricao       TEXT        -- description
features        JSONB       -- feature array
lifestyle_tags  TEXT[]
badge           TEXT
gradient        TEXT        -- Tailwind gradient class
images          JSONB       -- image array
lat             NUMERIC
lng             NUMERIC
matterport_url  TEXT
youtube_url     TEXT
agent_id        UUID
embedding       VECTOR(1536)
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

### kpi_snapshots
```sql
id              UUID PRIMARY KEY
total_leads     INTEGER     -- 28 (current)
total_deals     INTEGER     -- 8 (demo)
total_properties INTEGER    -- 55 (seeded)
pipeline_value  BIGINT      -- 9,440,000
created_at      TIMESTAMP
```

**Evidence — last 5 snapshots:**
```
2026-06-10 23:55 | leads:28 | deals:8 | properties:55 | pipeline:€9.44M
2026-06-09 23:55 | leads:28 | deals:8 | properties:55 | pipeline:€9.44M
2026-06-08 23:55 | leads:28 | deals:8 | properties:55 | pipeline:€9.44M
2026-06-07 23:55 | leads:28 | deals:8 | properties:55 | pipeline:€9.44M
2026-06-06 23:55 | leads:28 | deals:8 | properties:55 | pipeline:€9.44M
```

---

## MIGRATIONS INVENTORY

| Range | Count | Topic |
|-------|-------|-------|
| 000036–000066 | 31 | Security, compliance, operations, ML |
| 000067–000100 | ~34 | Capital, marketplace, growth |
| 20260522000001–000035 | 35 | Enterprise systems (2026-05-22 batch) |
| Special files | 4 | COMBINED, RUN_NOW scripts |
| **Total** | **278** | |

### Key Migration Topics
```
000036: KMS + SIEM + incidents
000037: Zero trust session recording
000038: Compliance sovereign
000040: Test suite results
000047: Control plane
000048: Observability
000049: Automation
000050: Data trust
000051: Financial grade
000053: Marketplace
000055: Compliance
000056: ML economic
000058: Growth graph
000059: Attribution
000060: Campaigns        ← Table created but may not be applied
000067: Capital accounts
000068: Marketplace
000071: Expansion markets
20260522000001: ML training pipeline
20260522000013: Market capital network
20260522000015: Kafka enterprise
20260522000024: Chaos resilience
20260522000030: Disaster recovery
20260522000031: Security RBAC
20260522000035: Sovereign backup secrets
```

---

## DATABASE POLICIES (RLS)

| Table | RLS | Policy Type |
|-------|-----|------------|
| contacts | Enabled | Row-level by user_id |
| deals | Enabled | Row-level by tenant |
| properties | Enabled | Public read, auth write |
| capital_profiles | Enabled | Service role only |
| used_magic_tokens | Enabled | Auth service only |

---

## STORAGE BUCKETS

| Bucket | Purpose |
|--------|---------|
| property-images | Property photos |
| documents | Deal documents |
| avatars | User avatars |

---

## VECTOR EMBEDDINGS

| Table | Embedding Column | Dimension | Purpose |
|-------|----------------|-----------|---------|
| properties | embedding | 1536 | Semantic property search |
| capital_profiles | embedding | 1536 (likely) | Semantic contact search |

---

*Evidence: Supabase REST API queries 2026-06-11, supabase/migrations/ file scan*
