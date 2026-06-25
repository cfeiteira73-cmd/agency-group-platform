# 05 — DATABASE FORENSIC REALITY
**Agency Group | Absolute Master Forensic Audit | 2026-06-25**

---

## Database Identity

| Item | Value |
|------|-------|
| Provider | Supabase |
| Project ID | isbfiofwpxqqpgxoftph |
| Region | eu-central-1 (Frankfurt) |
| Auth method | Row Level Security (RLS) on all tables |
| DB engine | PostgreSQL |
| Extensions | pgvector (embeddings), uuid-ossp |

---

## IMPORTANT: Verification Method

**Supabase MCP blocked** in this session (403 permission error).
**Local service role key corrupt** (41 chars, should be 256+ JWT).

**Source**: Last verified DB snapshot from `revenue-activation/02_DATABASE_REALITY_CHECK.md` (2026-06-24). This is the most recent confirmed live data.

---

## Table Row Counts (Last Verified: 2026-06-24)

| Table | Row Count | Data Type | Operational? |
|-------|-----------|-----------|-------------|
| `leads` | **18,042** | Real imported | ✅ Core asset |
| `capital_profiles` | **7,342** | Real institutional | ✅ Core asset |
| `outreach_queue` | **3,164** | Derived from leads | ✅ Ready |
| `contacts` | **28** | Mostly demo | ⚠️ Near-empty |
| `deals` | **8** | Demo/seed | ⚠️ Demo |
| `matches` | **17** | Demo | ⚠️ Demo |
| `activities` | **8** | Demo | ⚠️ Demo |
| `properties` | **~55** | Seeded | ⚠️ Demo |
| `kpi_snapshots` | **47+** | Real cron output | ✅ Real |
| `used_magic_tokens` | **38** | Real logins | ✅ Real (38 logins) |
| `sofia_conversations` | **0** | Empty | ❌ Never used |
| `sofia_conversation_turns` | **0** | Empty | ❌ Never used |
| `profiles` | **0** | Empty | ❌ Empty |
| `push_subscriptions` | Unknown | Real | ✅ |
| `investidores` | Unknown | Real | ✅ |
| `analytics_events` | Unknown | Real | ✅ |
| `alerts` | Unknown | Exists | ✅ |
| `partners` | Unknown | May not exist | ❓ |
| `campanhas` | Unknown | May not exist | ❓ |

---

## The Two Core Assets: leads vs capital_profiles

### leads table (18,042 rows)

This is the Lead Engine dataset, separate from the CRM.

| Attribute | Value |
|-----------|-------|
| Source | Apify scraping (32 markets, 7 personas) |
| Total | 18,042 |
| With email | 117 |
| A+ tier (score≥80) | 154 (or 95 by tier column — discrepancy documented) |
| A tier (60-79) | 3,434 |
| B tier (40-59) | 7,128 |
| C tier (<40) | 7,326 |
| Column name | `company_name` (NOT `company`) |
| Country column | `country` (NOT `country_iso`) |
| Primary purpose | Outreach targeting |

### capital_profiles table (7,342 rows)

Legacy institutional buyer database.

| Attribute | Value |
|-----------|-------|
| Source | Historical institutional data import |
| Total | 7,342 |
| With email | 67 |
| A+ score (≥80) | 116 |
| Top countries | US(3,010), UK(882), FR(748), UAE(504) |
| Column names | Standard (company, email, score, country_iso) |
| Primary purpose | Direct capital network outreach |

**Key distinction**: `leads` and `capital_profiles` are SEPARATE tables, not the same data. Earlier audits confused them. Together: 25,384 total records.

---

## CRM Tables (Operational Reality)

| Table | Rows | Real Data? | Usage |
|-------|------|-----------|-------|
| `contacts` | 28 | Mostly demo, 1 real external (ISABELGRILO) | ⚠️ CRM barely used |
| `deals` | 8 | Demo | ⚠️ Not real deals |
| `activities` | 8 | Demo | ⚠️ |
| `matches` | 17 | Demo | ⚠️ |
| `profiles` | 0 | Empty | ❌ No agent profiles |

---

## Sofia Tables

| Table | Rows | Status |
|-------|------|--------|
| `sofia_conversations` | 0 | Sofia never used by buyers |
| `sofia_conversation_turns` | 0 | Never used |
| `sofia_memory` | Unknown | Exists via migration |

---

## Infrastructure Tables (Likely Exist via Migrations)

These tables exist from the migration files but have no known row counts:

| Table | Migration | Purpose |
|-------|-----------|---------|
| `outreach_queue` | ~20260509 | Lead outreach tracking (3,164 rows confirmed) |
| `kpi_snapshots` | 20260424_002 | KPI data (47 rows) |
| `used_magic_tokens` | 20260408_001 | One-time token tracking (38 rows) |
| `investidores` | 20260407_001 | Investor leads |
| `deal_packs` | 20260424_001 | Deal packages |
| `priority_items` | 20260426_001 | Priority action items |
| `analytics_events` | 20260519000001 | Event tracking |
| `push_subscriptions` | 20260415_021 | PWA push subscriptions |
| `property_collections` | 20260407_004 | Saved property sets |

---

## Tables That May NOT Exist (5 Reported Missing)

From previous audits (reverse-engineering phase 20):

| Table | Status | Impact |
|-------|--------|--------|
| `partners` | POSSIBLY MISSING | Partner system broken |
| `campanhas` (CRM version) | POSSIBLY MISSING | Campaign tracking broken |
| `sellers` | POSSIBLY MISSING | Seller journey broken |
| `buyers` | POSSIBLY MISSING | Buyer journey tracking broken |
| `investment_portfolios` | POSSIBLY MISSING | Portfolio tracking broken |

**Note**: The migration `20260407_002_campanhas.sql` exists and creates a `campanhas` table. But the "CRM campanhas" table referenced in some routes may be different. Needs live verification.

---

## Migration Application Status

### Likely Applied (timestamped 20260406–20260509)
These migrations use standard Supabase format and are likely in the DB:
- 20260406 through 20260509: ~85 migrations
- Creates: capital_profiles, contacts, deals, properties, offmarket_leads, kpi_snapshots, push_subscriptions, investidores, campanhas, sofia tables, deal_packs, outreach_queue, etc.

### Questionable Application Status (000036–000155)
These use non-standard numbering and appear to be infrastructure SQL generated during audit waves (wave 36-60):
- 000036_kms_siem_incidents.sql through 000155_capital_profiles_crm_extension.sql
- 120 files
- Content: Kafka, ML training, financial ledger, chaos engineering tables
- **HIGH PROBABILITY these are NOT applied** — they represent aspirational infrastructure

### Combined SQL Files (Manual)
- `COMBINED_OFFMARKET_MIGRATIONS.sql`
- `COMBINED_RUN_IN_SUPABASE_DASHBOARD.sql`
- `RUN_NOW_038_039_040.sql`
- `RUN_NOW_SELLER_FIELDS.sql`
- These require manual execution in Supabase dashboard

---

## Database Health Assessment

| Dimension | Score | Notes |
|-----------|-------|-------|
| Core data tables | 90/100 | leads, capital_profiles, properties work |
| CRM data population | 15/100 | 28 contacts, 8 deals — near-empty |
| Sofia data | 0/100 | 0 conversations ever |
| Infrastructure tables | 60/100 | Many exist, few with real data |
| Missing tables | 70/100 | 5 tables possibly missing |
| RLS implementation | 90/100 | All major tables have RLS |
| Migration hygiene | 55/100 | 120 questionable migrations |

---

*Evidence: revenue-activation/02_DATABASE_REALITY_CHECK.md (2026-06-24) | reverse-engineering/05_DATABASE_GENOME.md | migration file scan 2026-06-25*
