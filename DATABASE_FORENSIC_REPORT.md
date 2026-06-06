# DATABASE FORENSIC REPORT
Agency Group | Phase 04 | Ultimate Institutional Master Audit | 2026-06-06
Fresh query. All counts from live Supabase REST API.

---

## COMPLETE TABLE INVENTORY

### TABLES WITH DATA

| Table | Count | Data Quality |
|-------|-------|-------------|
| capital_profiles | 7,342 | LinkedIn 100%, email 0.9%, scores populated |
| used_magic_tokens | 37 | Real login evidence |
| kpi_snapshots | 43 | Real cron execution, data now fixed |
| properties | 55 | Origin unverified |
| contacts | 28 | 12 real-looking, 16 test |
| priority_items | 23 | Unknown type |
| learning_events | 14 | System events |
| offmarket_leads | 14 | ALL test data |
| market_data | 10 | Unknown format |
| matches | 17 | Linked to demo deals |
| activities | 8 | Minimal |
| deals | 8 | Demo/seeded |
| deal_packs | 2 | Linked to demo |
| signals | 6 | Minimal |

### TABLES EMPTY (created, 0 data)

W54-W58 tables (applied 2026-06-06):
- reality_monitor_snapshots, system_health_dashboards (M149)
- acquisition_sources, acquisition_opportunities (M150)
- sofia_conversation_turns, sofia_escalations (M151)
- asset_opportunities, capital_matches (M151)
- ios_runtime_audits, ios_self_tests (M152)
- soc_incidents, immutable_incident_log, telemetry_events (M152)
- forensic_audit_log, security_defense_runs (M153)
- asel_defense_runs, system_isolation_flags (M154)

Other empty:
- property_collections, sofia_conversations, investidores
- profiles, tasks, notifications, visits, audit_log

### MISSING TABLES (404)

| Table | Referenced By |
|-------|--------------|
| campanhas | /api/campanhas |
| sellers | /api/sellers |
| buyers | /api/buyers |
| partners | /api/partners |
| investment_portfolios | analytics routes |
| match_reports | analytics routes |
| property_valuations | valuation routes |
| user_roles | admin routes |

---

## CRITICAL DATA ISSUES

### Issue 1: kpi_snapshots all zeros (FIXED)
**Root cause:** Queries filtered by tenant_id on tables without that column
**Fix:** Removed tenant_id filters from contacts/properties/deals queries
**Status:** ✅ Fixed in code, pending deployment

### Issue 2: 246 truncated LinkedIn URLs (FIXED)
**Root cause:** Special characters in names (é, ê, ç) caused URL truncation during scraping
**Evidence:** URLs like "https://www.linkedin.com/in/s" = 30 chars (invalid)
**Fix:** Cleared to empty string (246 records patched)
**Impact:** These contacts now require manual enrichment from name+company

### Issue 3: Properties have no tenant_id column
**Impact:** kpi-snapshot was counting 0 properties (now fixed)
**Secondary:** Multi-tenant architecture incomplete for properties table

### Issue 4: Deals reference column 'deal_value' but actual column is 'valor'
**Root cause:** Schema mismatch between code and DB
**Fix:** kpi-snapshot corrected to use 'valor'
**Other routes:** May have same issue — needs audit of all deal routes

### Issue 5: 9 missing tables (404)
**Impact:** ~20 routes return 500 errors when called
**Fix needed:** Apply remaining migrations

---

## MISSING INDEXES AUDIT

| Table | Indexes |
|-------|---------|
| capital_profiles | tier, pipeline, owner, persona, score, lead_id(UNIQUE) ✅ |
| contacts | Unknown — no index check possible via REST |
| properties | Unknown |
| deals | Unknown |
| matches | Unknown |

---

## RLS (Row Level Security)

| Table | RLS | Policy |
|-------|-----|--------|
| capital_profiles | ENABLED | service_role_all ✅ |
| All W54-W58 tables | ENABLED | service_role_all ✅ |
| contacts | Unknown |
| properties | Unknown |

---

## MIGRATIONS

| Metric | Value |
|--------|-------|
| Total migration files | 278 |
| W54-W58 applied | YES (confirmed by table existence) |
| Missing tables | 9 (need migrations) |

---

## PITR BACKUP

- Provider: Supabase Frankfurt
- PITR: Active
- Last verified: Never tested (restore never run)
- Risk: Backup exists but untested = potential single point of failure
