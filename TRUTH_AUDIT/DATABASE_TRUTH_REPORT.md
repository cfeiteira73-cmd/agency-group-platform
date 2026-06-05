# DATABASE TRUTH REPORT
Agency Group | 2026-06-05 | Evidence: Migration files + Supabase project

---

## DIMENSIONS
| Metric | Value | Source |
|--------|-------|--------|
| Total migrations | 277 | `ls supabase/migrations/*.sql` |
| Tables in code | 703 | `grep -rh ".from" lib/ app/` |
| Foreign key refs | 202 | `grep -rn "REFERENCES"` |
| Supabase project | isbfiofwpxqqpgxoftph | .env.local |
| Region | eu-central-1 (Frankfurt) | Supabase dashboard |
| RLS (W47-60 tables) | 100% | Every migration confirmed |

---

## MIGRATION STATUS
| Wave | Migrations | Applied to Production |
|------|-----------|----------------------|
| W47 (000104-000109) | 6 | ✅ Applied |
| W48 (000110-000115) | 6 | ✅ Applied |
| W49 (000116-000122) | 7 | ✅ Applied |
| W50 (000123-000129) | 7 | ✅ Applied |
| W51 (000130-000139) | 10 | ✅ Applied |
| W52 (000140-000148) | 9 | ✅ Applied (via browser SQL) |
| W53 (no migration) | 0 | N/A |
| W54 (000149-000151) | 3 | ❌ NOT APPLIED |
| W55 (no migration) | 0 | N/A |
| W56 (000152) | 1 | ❌ NOT APPLIED |
| W57 (000153) | 1 | ❌ NOT APPLIED |
| W58 (000154) | 1 | ❌ NOT APPLIED |

**5 migrations (000149-000154) not applied.** These create 18 new tables.
Missing tables: reality_monitor_snapshots, system_health_dashboards, acquisition tables, Sofia conversation turns, capital matching tables, IOS audit tables, ASEL tables, security OS tables.

---

## CRITICAL TABLES
| Table | Status | Purpose |
|-------|--------|---------|
| settlements | ✅ EXISTS | Settlement lifecycle |
| settlement_transitions | ✅ EXISTS | 8-state machine + SHA-256 chain |
| audit_log | ✅ EXISTS | Immutable append-only |
| contacts | ✅ EXISTS | Primary CRM |
| deals | ✅ EXISTS | Deal pipeline |
| capital_profiles | ✅ CREATED (W54) | **EMPTY — no data** |
| asset_opportunities | ✅ CREATED (W54) | **EMPTY — no data** |
| capital_matches | ✅ CREATED (W54) | **EMPTY — no data** |
| ios_runtime_audits | ❌ MISSING | W56 migration not applied |
| asel_defense_runs | ❌ MISSING | W58 migration not applied |

---

## INTEGRITY RISKS
1. No DB-level UNIQUE constraint on `idempotency_key` — application-level only
2. Most FKs are app-enforced, not DB-enforced
3. capital_profiles, asset_opportunities: EMPTY — matching engine has nothing to match
4. W54-W58 tables not in production — monitoring/ASEL layers partially non-functional

---

## VERDICT
Core CRM tables: ✅ operational
Capital tables: ✅ schema exists, ❌ empty
New monitoring tables (W54-58): ❌ not applied to production
Financial integrity: ✅ settlement chain exists, ❌ no real transactions ever processed
