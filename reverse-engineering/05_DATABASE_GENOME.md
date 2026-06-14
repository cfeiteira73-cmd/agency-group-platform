# 05 — DATABASE GENOME
**Agency Group | Ultimate Reverse Engineering Audit | 2026-06-14**

---

## DATABASE OVERVIEW

```
Provider:    Supabase PostgreSQL 15
Region:      Frankfurt (eu-central-1)
Project ID:  isbfiofwpxqqpgxoftph
Extensions:  pgvector (embeddings), uuid-ossp, pg_cron
Migrations:  278 applied
Tables:      18 confirmed + 5 missing (broken)
RLS:         Enabled on all tables
Backups:     Supabase automatic (daily)
```

---

## ALL 18 CONFIRMED TABLES

### 1. capital_profiles (7,342 rows — REAL DATA)
```sql
id              UUID PK
name            TEXT
organization    TEXT
profile_type    TEXT    -- Family Office, Wealth Manager, Fund, PE, VC, etc.
country_iso     CHAR(2) -- 60+ countries
score           INTEGER -- 0-100 (scored by ML)
email           TEXT    -- 67/7,342 have email (0.9%)
phone           TEXT
linkedin_url    TEXT
notes           TEXT
enriched_at     TIMESTAMPTZ
created_at      TIMESTAMPTZ
```
**Indexes**: country_iso, profile_type, score
**RLS**: Enabled (authenticated read)

### 2. leads (10,665 rows — REAL DATA, scraped)
```sql
id              UUID PK
source          TEXT    -- Apify scraper source
name            TEXT
organization    TEXT
email           TEXT
phone           TEXT
country         TEXT
score           INTEGER
status          TEXT    -- new/contacted/replied/qualified/dead
created_at      TIMESTAMPTZ
```

### 3. outreach_queue (3,120 rows)
```sql
id              UUID PK
contact_id      UUID FK→capital_profiles
template_id     TEXT
status          TEXT    -- pending/sent/replied/failed
scheduled_at    TIMESTAMPTZ
sent_at         TIMESTAMPTZ
created_at      TIMESTAMPTZ
```
**Status: All 3,120 PENDING — 0 sent**

### 4. contacts (28 rows — mostly demo)
```sql
id              UUID PK
name            TEXT
email           TEXT
phone           TEXT
company         TEXT
role            TEXT
country         TEXT
status          TEXT
lead_score      INTEGER
pipeline_stage  TEXT
source          TEXT
notes           TEXT
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```
**Real data: 1 row (ISABELGRILO@GMAIL.COM, 2026-06-03)**
**Demo: ~27 rows**

### 5. deals (8 rows — ALL DEMO)
```sql
id              UUID PK
title           TEXT
contact_id      UUID FK→contacts
property_id     UUID FK→properties
valor           NUMERIC  -- Deal value
stage           TEXT     -- pipeline stage
probability     INTEGER  -- %
commission      NUMERIC  -- 5%
notes           TEXT
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

### 6. properties (55 rows — seeded/demo)
```sql
id              UUID PK
nome            TEXT    -- Property name (Portuguese columns — FIXED)
zona            TEXT    -- Zone
bairro          TEXT    -- Neighborhood
tipo            TEXT    -- Type (apartamento, moradia, etc.)
preco           NUMERIC -- Price in EUR
area            NUMERIC -- Area in m²
quartos         INTEGER -- Bedrooms
casas_banho     INTEGER -- Bathrooms
energia         TEXT    -- Energy rating (A, B, C...)
descricao       TEXT    -- Description
features        JSONB   -- Features array
images          JSONB   -- Image URLs array
lat             FLOAT   -- Latitude
lng             FLOAT   -- Longitude
matterport_url  TEXT    -- 3D tour URL
embedding       VECTOR(1536) -- OpenAI embedding for semantic search
score           INTEGER -- Property score
is_offmarket    BOOLEAN -- Off-market flag
mandate_type    TEXT    -- Exclusive/Co-agency
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```
**Note: FIXED in commit 1760efe — all API routes now use Portuguese column names**

### 7. matches (17 rows — ALL DEMO)
```sql
id              UUID PK
property_id     UUID FK→properties
contact_id      UUID FK→contacts
match_score     INTEGER -- 0-100
priority_level  TEXT    -- HIGH/MEDIUM/LOW
status          TEXT    -- pending/contacted/viewed/offered/closed
notes           TEXT
created_at      TIMESTAMPTZ
```

### 8. activities (8 rows — ALL DEMO)
```sql
id              UUID PK
contact_id      UUID FK→contacts
deal_id         UUID FK→deals
type            TEXT    -- call/email/meeting/note
description     TEXT
outcome         TEXT
created_at      TIMESTAMPTZ
```

### 9. kpi_snapshots (50 rows — REAL, RUNNING)
```sql
id              UUID PK
snapshot_date   DATE
total_contacts  INTEGER -- 28 (stable)
total_deals     INTEGER -- 8 (stable)
total_properties INTEGER -- 55 (stable since 2026-04-26)
total_leads     INTEGER -- 28 (was 27, +1 on 2026-06-06)
pipeline_value  NUMERIC -- Demo value
created_at      TIMESTAMPTZ
```
**Running since 2026-04-24, 1 run/day**

### 10. sofia_conversations (0 rows — NEVER USED)
```sql
id              UUID PK
session_id      TEXT
user_identifier TEXT
messages        JSONB   -- Chat message array
channel         TEXT    -- web/whatsapp/voice
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

### 11. used_magic_tokens (38 rows — REAL)
```sql
id              UUID PK
token_hash      TEXT    -- SHA-256 of token
email           TEXT    -- geral@agencygroup.pt (ALL 38)
used_at         TIMESTAMPTZ
expires_at      TIMESTAMPTZ
```

### 12. offmarket_leads (14 rows)
```sql
id              UUID PK
address         TEXT
zone            TEXT
estimated_value NUMERIC
source          TEXT
status          TEXT
notes           TEXT
created_at      TIMESTAMPTZ
```

### 13. deal_packs (2 rows — demo)
```sql
id              UUID PK
match_id        UUID FK→matches
property_id     UUID FK→properties
contact_id      UUID FK→contacts
content         JSONB
status          TEXT
sent_at         TIMESTAMPTZ
created_at      TIMESTAMPTZ
```

### 14. property_collections (0 rows)
```sql
id              UUID PK
name            TEXT
user_id         UUID
property_ids    UUID[]
description     TEXT
created_at      TIMESTAMPTZ
```

### 15. notifications (0 rows)
```sql
id              UUID PK
user_id         UUID
type            TEXT
title           TEXT
body            TEXT
read            BOOLEAN
push_sent       BOOLEAN
created_at      TIMESTAMPTZ
```

### 16. push_subscriptions (0 rows)
```sql
id              UUID PK
user_id         UUID
endpoint        TEXT
keys            JSONB   -- VAPID keys
created_at      TIMESTAMPTZ
```

### 17. learning_events (14 rows)
```sql
id              UUID PK
event_type      TEXT
payload         JSONB
processed       BOOLEAN
created_at      TIMESTAMPTZ
```
**14 events — system-generated, not user-triggered**

### 18. compliance_logs (0 rows)
```sql
id              UUID PK
action          TEXT
user_id         UUID
resource        TEXT
timestamp       TIMESTAMPTZ
metadata        JSONB
```

---

## MISSING TABLES (5 — BROKEN FUNCTIONALITY)

| Table | Code References | Fix Time |
|-------|----------------|---------|
| partners | lib/commercial/partnerTiering.ts, /api/partners/* | 5 min |
| campanhas | /api/automation/campanhas, lib/marketing/* | 5 min |
| sellers | lib/crm/sellers.ts | 5 min |
| buyers | lib/crm/buyers.ts | 5 min |
| investment_portfolios | lib/capital/portfolios.ts | 5 min |

**Total fix time: 25 minutes of SQL**

---

## MIGRATION HISTORY

```
Total migrations: 278
Applied: All 278 (confirmed)
Latest batch (W54-W58): Applied 2026-06-06
  W54: capital_profiles country_iso fix
  W55: used_magic_tokens email+expires_at NOT NULL fix
  W56: kpi_snapshots valor column
  W57: properties Portuguese columns
  W58: Contact dedup improvements
```

---

## VECTOR SEARCH (pgvector)

```
Extension: pgvector
Dimension: 1536 (OpenAI text-embedding-3-small)
Tables with embeddings: properties (column: embedding)
Index type: IVFFlat
Semantic search: /api/properties/search → works
Real semantic searches: Unknown (0 real users)
```

---

## ROW LEVEL SECURITY

```
All 18 tables: RLS enabled
Auth method: Supabase JWT (from next-auth session)
Service role: Bypasses RLS (used in API routes)
Anonymous: Read-only on public tables (properties, blog)
Authenticated: Full CRUD on own data
Admin (geral@agencygroup.pt): Full access
```

---

## DATA QUALITY ASSESSMENT

| Table | Data Quality | Actionable? |
|-------|-------------|------------|
| capital_profiles | HIGH — scored, tagged, real | YES — contact 67 with email |
| leads | MEDIUM — scraped, need enrichment | PARTIAL — need email enrichment |
| outreach_queue | MEDIUM — contacts identified | NEEDS n8n to run |
| contacts | LOW — mostly demo | Replace with real contacts |
| deals | ZERO — all demo | Need real deals |
| properties | LOW — seeded, unverified | Need real mandates |
| kpi_snapshots | REAL — accurate since 2026-04-24 | For monitoring |
| sofia_conversations | EMPTY — never used | Start using Sofia |
| used_magic_tokens | REAL — 38 logins | Evidence of sole user |

---

*Evidence: Supabase REST API (2026-06-14), migration files, forensic-inventory/04_DATABASE_MAP.md*
