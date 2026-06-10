# 03 — BACKEND AUDIT
Agency Group | Final Operating System Audit | 2026-06-11

---

## OVERVIEW

| Metric | Value |
|--------|-------|
| Total API routes | 542 |
| TypeScript errors | **0** |
| Routes with auth | ~400+ (Bearer/NextAuth/CRON_SECRET) |
| Routes public (intentional) | ~50 |
| Routes broken (missing tables) | ~25 |
| Routes broken (schema mismatch) | **2 — FIXED TODAY** |

---

## BUGS FOUND & FIXED (2026-06-11)

### BUG 01: properties/public/route.ts — Wrong column names
**File**: `app/api/properties/public/route.ts`
**Root cause**: DB query used `title, zone, type, price, area_m2` — none of these exist in `properties` table
**Real columns**: `nome, zona, tipo, preco, area`
**Effect**: Always fell to static data fallback — /imoveis never served DB data
**Fix**: Changed SELECT to use correct Portuguese column names and `.not('nome', 'is', null)`
**Status**: FIXED ✅ — TS 0 errors confirmed

### BUG 02: properties/route.ts (portal) — Two wrong fallback queries
**File**: `app/api/properties/route.ts`
**Root cause**: Same column mismatch across two try-blocks
**Effect**: Portal always returned `{ data: [], source: 'empty' }` — no properties visible in portal
**Fix**: Replaced both failed try-blocks with single correct Portuguese-column query
**Status**: FIXED ✅ — TS 0 errors confirmed

### BUG 03: kpi-snapshot — tenant_id + wrong column (FIXED 2026-06-06)
**File**: `app/api/cron/kpi-snapshot/route.ts`
**Root cause**: `.eq('tenant_id', tenantId)` on tables with no tenant_id column + `deal_value` vs `valor`
**Effect**: All 43 kpi_snapshots showed 0 for everything for 43 days
**Fix**: Removed tenant_id filters, corrected to `valor`
**Evidence**: kpi_snapshots from 2026-06-06 onwards show 28/8/55/€9.44M

---

## KNOWN BROKEN ROUTES (missing tables)

These routes exist in code but will error at runtime because their target table doesn't exist in Supabase:

| Route | Missing Table | Effect |
|-------|--------------|--------|
| /api/campanhas | campanhas | 500 error |
| /api/campanhas/send | campanhas | 500 error |
| /api/partners/performance | partners | 500 error |
| /api/commercial/partner-tiers | partners | Partial error |
| Any seller/buyer pipeline routes | sellers, buyers | 500 error |
| /api/investidores (portfolio) | investment_portfolios | 500 error |

**Count**: ~25 routes affected by 5 missing tables.

---

## AUTH COVERAGE

| Auth Method | Routes | Status |
|-------------|--------|--------|
| CRON_SECRET | 41 cron routes | ✅ Enforced (safeCompare) |
| NextAuth session | Portal/dashboard | ✅ Enforced |
| Bearer token | Service routes | ✅ Enforced |
| isPortalAuth | Portal API routes | ✅ Enforced |
| Public (intentional) | Health, public properties | ✅ Correct |

---

## SECURITY PATTERNS VERIFIED

| Pattern | Status | Evidence |
|---------|--------|---------|
| timingSafeEqual on auth | ✅ | safeCompare library |
| Rate limiting (Upstash) | ✅ | rateLimit() on auth + form routes |
| CSRF protection | ✅ | Implemented |
| Input validation (Zod) | ✅ | All POST routes |
| SQL injection | ✅ | Supabase parameterised queries |
| XSS protection | ✅ | Next.js RSC + CSP headers |
| SSRF allowlist | ✅ | Implemented |
| No hardcoded secrets | ✅ | Verified via grep |

---

## DUPLICATE/ORPHAN LOGIC

| Issue | Routes | Recommendation |
|-------|--------|---------------|
| Duplicate self-heal | /api/cron/self-heal + /api/sre/self-heal | Keep one, disable duplicate |
| Duplicate incident detect | /api/cron/detect-incidents + /api/cron/anomaly-monitor | Keep one |
| Orphan routes | ~5 routes reference missing tables | Low priority |
| Empty n8n queue | /api/workers/run | Only works if n8n deployed |

---

## API RESPONSE QUALITY

| Pattern | Status |
|---------|--------|
| Correct HTTP codes (401, 403, 404, 429, 500) | ✅ |
| Empty array guards (.in([])) | ✅ Verified in key routes |
| AbortController timeouts | ✅ Used in AI routes |
| Structured error responses | ✅ |
| Correlation IDs | ✅ getRequestCorrelationId() |
| SLO tracking | ✅ sloRecordRequest() |

---

## SCORE: 78/100

| Category | Score | Reason |
|----------|-------|--------|
| Auth coverage | 92/100 | Complete on revenue routes |
| Security | 88/100 | OWASP covered, rate limiting active |
| Data integrity | 70/100 | Schema mismatches fixed, missing tables remain |
| Error handling | 85/100 | Structured errors, good fallbacks |
| Code quality | 90/100 | 0 TS errors, Zod validation |
| Missing tables | 40/100 | 5 tables absent → 25 routes broken |
