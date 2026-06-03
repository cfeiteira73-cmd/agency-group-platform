# DATABASE CERTIFICATION
Agency Group | Wave 59 | Evidence: Migration files + schema analysis

---

## METRICS
| Metric | Value | Status |
|--------|-------|--------|
| Total migrations | 277 | ✅ |
| Tables defined | 627 | ✅ |
| Foreign key refs | 202 | ⚠️ PARTIAL |
| RLS enabled (W47-58 tables) | 100% of new tables | ✅ |
| Sequential migration gaps | 0 | ✅ |
| Indexes on new tables | All W47-58 tables indexed | ✅ |

---

## CERTIFICATION: RLS
**Evidence**: Every migration from Wave 47-58 contains:
```sql
ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (...) THEN CREATE POLICY service_role_all ... END IF; END $$;
```
**Status**: ✅ ALL new tables (W47-58) have RLS enabled with service_role policies.

**Gap**: Pre-Wave-47 tables — RLS status depends on initial migration. An admin RLS check route exists at `/api/admin/rls-check` for verification.

---

## CERTIFICATION: INDEXES
**Status**: All Wave 47-58 tables have indexes on `tenant_id`, `created_at DESC`, and domain-specific columns.

**Gap**: Pre-Wave-47 tables — index coverage not audited in this pass.

---

## CERTIFICATION: FOREIGN KEYS
**Evidence**: 202 `REFERENCES` in migrations — applied inconsistently.

**Risk**: Tables reference IDs (tenant_id, contact_id, deal_id) without formal FK constraints. Supabase/Postgres does not enforce referential integrity without FK. Orphan records possible.

**Status**: ⚠️ PARTIAL — Application-level integrity exists (code checks), but no DB-level FK enforcement on most tables.

**Recommendation**: Add FKs on settlement_transitions → settlements, finality_records → settlements for capital integrity.

---

## CRITICAL TABLES — Capital Path
| Table | RLS | Index | FK | Notes |
|-------|-----|-------|----|-------|
| settlement_transitions | ✅ | ✅ | ⚠️ | SHA-256 chain hash |
| finality_records | ✅ | ✅ | ⚠️ | bank_confirmed flag |
| liquidity_locks | ✅ | ✅ | ⚠️ | escrow tracking |
| audit_log | ✅ | ✅ | N/A | Append-only |
| forensic_audit_log | ✅ | ✅ | N/A | Chain hash |
| immutable_incident_log | ✅ | ✅ | N/A | Chain hash |

---

## DATA INTEGRITY RISKS
1. **No transaction isolation level specified** — default READ COMMITTED. For capital operations, SERIALIZABLE is required to prevent phantom reads.
2. **No explicit DB-level UNIQUE constraints** on idempotency_key across all capital tables — relies on application-level checks.
3. **627 tables** — some from experimental waves may be unused in production. No table deletion audit done.

---

## VERDICT: CERTIFIED WITH CONDITIONS
Capital tables are structurally sound. Pre-W47 tables need FK audit. Idempotency should be enforced at DB level for settlement and finality tables.
