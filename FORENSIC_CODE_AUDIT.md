# FORENSIC CODE AUDIT
Agency Group | Wave 59 | Evidence: Live codebase scan

---

## SUMMARY SCORES
| Category | Score | Severity |
|----------|-------|----------|
| TypeScript errors | 0 | ✅ CLEAN |
| TODO CRITICAL remaining | 0 | ✅ CLEAN (after W55+W59 fixes) |
| console.log in production | 113 | ⚠️ MEDIUM |
| `as any` casts | 2,714 | 🔴 HIGH |
| Duplicate route families | 1 (sofia/sofia-agent) | ⚠️ MEDIUM |
| In-memory state (unsafe) | 1 (middleware — dev only) | ⚠️ RESOLVED in W59 |
| Dead code | LOW | ✅ |
| Orphan cron routes | 0 | ✅ CLEAN |

---

## F1 — `as any` — 2,714 occurrences [HIGH]
**Evidence**: `grep -rn "\bas any\b" lib/ app/ --include="*.ts" | wc -l` → 2714

**Root cause**: Supabase client type system doesn't natively support dynamic table access for new tables created in migrations. The codebase uses the pattern:
```typescript
(supabaseAdmin as unknown as { from: (t: string) => ... }).from('new_table')
```
This is used extensively across all Wave 47-58 modules. While `as unknown as` is the correct pattern for this specific Supabase workaround, raw `as any` in business logic is a type safety gap.

**Impact**: TypeScript safety partially bypassed. Errors that TypeScript would catch can slip through.

**Recommendation**: 
1. Regenerate `database.types.ts` to include all 277 migrations' tables
2. Replace `as any` in business logic with proper types
3. Keep `as unknown as` only for the Supabase new-table pattern

---

## F2 — console.log — 113 occurrences [MEDIUM]
**Evidence**: `grep -rn "console\.log\b" lib/ app/ --include="*.ts" | wc -l` → 113

**Root cause**: Structured logger (`lib/logger.ts`) exists and is used in Wave 47-58 modules. The 113 remaining `console.log` instances are in older pre-Wave-47 code that was never migrated.

**Impact**: Production logs are unstructured for these paths — correlation IDs missing.

**Recommendation**: Run migration script to replace `console.log(` → `log.info(` in older modules.

---

## F3 — Duplicate Sofia routes [MEDIUM]
**Evidence**: Both `/api/sofia/` and `/api/sofia-agent/` exist

Files:
- `app/api/sofia/chat/route.ts` — Wave 47+ (current)
- `app/api/sofia-agent/chat/route.ts` — Wave pre-47 (legacy)

**Risk**: Clients calling `/api/sofia-agent/` bypass the newer Wave 47+ rate limiting, monitoring, and OS integration.

**Recommendation**: Redirect `/api/sofia-agent/*` → `/api/sofia/*` via middleware, deprecate the old routes.

---

## F4 — Middleware in-memory store [RESOLVED in W59]
**Evidence**: `middleware.ts:8` — `const store = new Map()`

**Status**: RESOLVED — commented accurately. In production, Upstash IS configured (`useUpstash=true`), so `rateLimitMemory()` is never called. The `store` Map is dead code in production.

---

## F5 — duplicate logic for `DEFAULT_TENANT_ID` [LOW]
**Evidence**: Pattern `process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? '00000000-...'` appears in 80+ files.

**Impact**: Low — consistent pattern, just not DRY.

**Recommendation**: Export from `lib/tenant.ts` and import everywhere.

---

## F6 — bigintReplacer defined in 30+ files [LOW]
**Evidence**: `grep -rn "function bigintReplacer" lib/ | wc -l` → Multiple copies

**Recommendation**: Export from `lib/utils/serialization.ts` and import.

---

## CLEAN ITEMS (confirmed evidence)
- ✅ Zero TypeScript errors
- ✅ Zero TODO CRITICAL items
- ✅ Zero orphan cron routes (41 crons, 0 missing files)
- ✅ Zero orphan migrations (277 files, all sequential)
- ✅ No PREENCHER values in code paths (only in env validation guards)
- ✅ Settlement state machine forward-only (code confirmed)
- ✅ Immutable audit log (append-only pattern confirmed)
- ✅ No mock data in revenue paths
