# DATABASE TRUTH REPORT
Agency Group | Section 4 | 2026-06-06

---

## COMPLETE TABLE INVENTORY

### POPULATED TABLES (with real data)

| Table | Rows | Data Quality | Notes |
|-------|------|-------------|-------|
| capital_profiles | 7,342 | GOOD | LinkedIn 100%, email 0.9%, scores fixed |
| used_magic_tokens | 37 | GOOD | Real logins |
| kpi_snapshots | 43 | GOOD | Daily cron running |
| properties | 55 | UNVERIFIED | Origin unknown, may be seeded |
| contacts | 28 | MIXED | 12 real-looking, 16 test |
| matches | 17 | MIXED | Linked to demo deals |
| priority_items | 23 | UNKNOWN | Type unknown |
| learning_events | 14 | UNKNOWN | System events |
| offmarket_leads | 14 | TEST DATA | All test/apify leads |
| deals | 8 | DEMO | Demo data (James Mitchell, Khalid Al-Rashid) |
| activities | 8 | UNKNOWN | Minimal |
| deal_packs | 2 | UNKNOWN | Linked to demo deals |
| market_data | 10 | UNKNOWN | 10 market entries |
| signals | 6 | UNKNOWN | Minimal |

### EMPTY TABLES (created, 0 data)

**W54-W58 tables (applied 2026-06-06):**
- reality_monitor_snapshots, system_health_dashboards
- acquisition_sources, acquisition_opportunities, acquisition_pipeline_snapshots
- sofia_conversation_turns, sofia_escalations
- asset_opportunities, capital_matches, capital_matching_reports
- ios_runtime_audits, ios_self_tests
- capital_finalization_log, capital_freeze_log
- soc_incidents, immutable_incident_log, telemetry_events
- forensic_audit_log, security_defense_runs
- asel_defense_runs, system_isolation_flags, asel_healing_log
- asel_certifications, dr_activations

**Other empty tables:**
- property_collections, sofia_conversations, investidores
- profiles, tasks, notifications, visits, audit_log

### MISSING TABLES (404 from REST API)
campanhas, partners, blog_posts, sellers, buyers,
match_reports, investment_portfolios, property_valuations, user_roles

---

## MIGRATIONS

| Metric | Value |
|--------|-------|
| Total migration files | 278 |
| Applied to production | ~252 (estimate — can't query supabase_migrations without management API) |
| W54-W58 applied | YES (2026-06-06, confirmed by table existence) |
| Missing (404 tables) | 9 tables not yet created |

---

## CRITICAL DATA ISSUES

### Issue 1: Properties origin unknown
55 properties exist. No source_url, no mandate_date, no external reference.
IDs are sequential integers (1001-1055) — suggests seeded data.
None confirmed as real available mandates.

### Issue 2: Deals = demo data
8 deals with realistic names (James Mitchell, Khalid Al-Rashid).
Contact IDs link to seeded contacts table.
No real transaction evidence (no payment, no notarial reference).

### Issue 3: offmarket_leads = ALL test
14 records: "Direct POST Test", "Direct Supabase Test", "E2E_V4_", "Lead Apify 2026-04-12"
Zero real off-market leads from any source.

### Issue 4: owner field case inconsistency
- 'CARLOS': 1,619 records (uppercase)
- 'Carlos': 25 records (title case)
These should be the same owner. Case bug.

### Issue 5: 9 missing tables
Routes reference campanhas, partners, blog_posts, sellers, buyers, match_reports,
investment_portfolios, property_valuations, user_roles — all return 404.

---

## DATA INTEGRITY RISKS

| Risk | Severity | Fix |
|------|----------|-----|
| Properties not verified | HIGH | Call each source |
| Deals not real | HIGH | Accept as demo, add real |
| offmarket_leads all test | MEDIUM | Clear and add real |
| owner case bug | LOW | SQL: UPDATE SET owner='CARLOS' WHERE owner='Carlos' |
| Missing tables (9) | MEDIUM | Apply remaining migrations |

---

## FIX: Owner case normalization
```sql
UPDATE capital_profiles SET owner = 'CARLOS' WHERE owner = 'Carlos';
-- Verify
SELECT owner, COUNT(*) FROM capital_profiles GROUP BY owner ORDER BY 2 DESC;
```

---

## INDEXES STATUS
- idx_cp_tier ON capital_profiles ✅ (applied in PART1 schema)
- idx_cp_pipeline ON capital_profiles ✅
- idx_cp_lead_id UNIQUE ON capital_profiles ✅
- All W54-W58 tables have indexes ✅
- W52 tables: not confirmed
