# 04 — DATABASE AUDIT
Agency Group | Final Operating System Audit | 2026-06-11

---

## SUPABASE PROJECT

| Field | Value |
|-------|-------|
| Project ID | isbfiofwpxqqpgxoftph |
| Region | eu-central-1 (Frankfurt) |
| Owner | cfeiteira73@gmail.com (personal account) |
| Status | ACTIVE |
| Postgres version | 17+ |
| PITR | Configured (never tested) |

---

## TABLE INVENTORY (verified via REST API 2026-06-11)

### Active Tables with Data

| Table | Rows | Real/Demo | Last Activity |
|-------|------|-----------|---------------|
| capital_profiles | **7,342** | Real (imported) | 2026-06-06 |
| contacts | 28 | 1 real, 27 test | 2026-06-03 |
| deals | 8 | Demo data | 2026-04-05 |
| properties | 55 | Unverified seeded | 2026-04-05 |
| kpi_snapshots | 47 | Real (fixed) | 2026-06-09 |
| matches | 17 | Demo data | 2026-04-05 |
| activities | 8 | Demo data | 2026-04-05 |
| offmarket_leads | 14 | Test data | Unknown |
| learning_events | 14 | System events | Unknown |
| used_magic_tokens | 38 | Real (logins) | 2026-06-11 |
| sofia_conversation_turns | 0 | None | Never |
| sofia_escalations | 0 | None | Never |
| tasks | 0 | None | Never |

### Missing Tables (routes reference, tables don't exist)

| Table | Impact Level |
|-------|-------------|
| partners | HIGH — partner engine broken |
| campanhas | HIGH — campaign system broken |
| sellers | MEDIUM — seller pipeline broken |
| buyers | MEDIUM — buyer funnel broken |
| investment_portfolios | MEDIUM — portfolio widget broken |

---

## PROPERTIES TABLE SCHEMA

**Evidence**: Direct REST API query 2026-06-11

```
id, nome, zona, bairro, tipo, preco, area, quartos, casas_banho, 
energia, descricao, features, views, amenities, badge, status, 
lat, lng, images, matterport_url, youtube_url, lifestyle_tags, 
gradient, created_at, updated_at, agent_id, embedding
```

**Note**: English schema (`title, zone, type, price`) does NOT exist.
Two API routes were querying wrong column names — FIXED 2026-06-11.

---

## DEALS TABLE SCHEMA

**Evidence**: Direct REST API query 2026-06-11

```
id, ref, imovel, property_id, valor, fase, comprador, contact_id,
cpcv_date, escritura_date, notas, checklist, deal_room, created_at,
updated_at, agent_id, cpcv_date_text, escritura_date_text, lead_score,
scored_at, last_activity_at, expected_fee, realized_fee, fee_type,
partner_id, partner_fee_pct, zone
```

**Note**: Column is `valor` NOT `deal_value`. Fixed in kpi-snapshot 2026-06-06.

---

## KPI SNAPSHOTS — BEFORE AND AFTER FIX

| Date | total_leads | total_deals | total_properties | pipeline_value |
|------|-------------|-------------|-----------------|----------------|
| 2026-06-05 (pre-fix) | 0 | 0 | 0 | 0 |
| 2026-06-06 (fix day) | 28 | 8 | 55 | 9,440,000 |
| 2026-06-07 | 28 | 8 | 55 | 9,440,000 |
| 2026-06-08 | 28 | 8 | 55 | 9,440,000 |
| 2026-06-09 | 28 | 8 | 55 | 9,440,000 |

**CONFIRMED FIXED.** 4 consecutive correct snapshots.

---

## CAPITAL PROFILES SCHEMA KEY

Column names verified via REST API:
```
profile_id, full_name, email, linkedin, company, persona_type,
capital_score, total_score, contact_status, owner, country_iso,
investment_range_min, investment_range_max, currency, ...
```

---

## MIGRATIONS

| Total | 278 SQL files in supabase/migrations/ |
|-------|---------------------------------------|
| Latest | 20260522000035_sovereign_backup_secrets.sql |
| W54-W58 | Applied via Management API (session 2026-06-06) |

---

## RLS (Row Level Security)

| Table | RLS Status |
|-------|-----------|
| capital_profiles | ✅ Configured |
| contacts | ✅ Configured |
| deals | ✅ Configured |
| properties | ✅ Configured |
| kpi_snapshots | ✅ Configured |

Service role key bypasses RLS (correct for server-side operations).

---

## DATA QUALITY ISSUES

| Issue | Table | Count | Action |
|-------|-------|-------|--------|
| email coverage | capital_profiles | 67/7342 (0.9%) | Enrich via Apollo |
| empty linkedin | capital_profiles | 246 (cleared truncated) | Re-enrich |
| unverified properties | properties | 55/55 | Phone verification needed |
| demo deals | deals | 8/8 | Replace with real deals |
| test contacts | contacts | 27/28 | Clean when real leads come |
| zero sofia conversations | sofia_conversation_turns | 0 | Start using Sofia |

---

## MISSING INDEXES (RISK)

capital_profiles is 7,342 rows — queries by country_iso, persona_type, capital_score may be slow without indexes. Verify via EXPLAIN ANALYZE if queries slow.

---

## SCORE: 72/100

| Category | Score | Reason |
|----------|-------|--------|
| Schema integrity | 80/100 | Real tables correct; 5 missing |
| Data accuracy | 65/100 | 7342 CRM real; deals/props demo |
| Migrations | 90/100 | 278 applied |
| RLS | 85/100 | Configured, service key correct |
| Backup/PITR | 60/100 | Configured, never tested |
| Performance | 55/100 | No custom indexes verified |
