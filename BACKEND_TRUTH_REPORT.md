# BACKEND TRUTH REPORT
Agency Group | Section 3 | 2026-06-06

---

## ROUTE INVENTORY (542 total)

### By Category
| Category | Count | % | Status |
|----------|-------|---|--------|
| DB-connected (Supabase) | 213 | 39% | Functional when called |
| AI-powered (Claude/LLM) | 40 | 7% | Functional when called |
| Lib-function (computed) | 259 | 48% | Return data from lib functions |
| Unknown/other | 30 | 6% | Mix |

### By Domain
| Domain | Approx Routes |
|--------|--------------|
| /api/analytics/* | ~45 |
| /api/cron/* | ~25 |
| /api/sre/* | ~15 |
| /api/validation/* | ~12 |
| /api/system/* | ~12 |
| /api/auth/* | ~10 |
| /api/agent/* | ~8 |
| /api/crm/* | ~8 |
| /api/sofia/* | ~5 |
| /api/portal/* | ~10 |
| /api/properties/* | ~8 |
| /api/deals/* | ~5 |
| Other | ~379 |

---

## DEAD CODE AUDIT

### Routes that exist but reference missing DB tables (404 tables)
- `/api/campanhas` → campanhas table = 404
- `/api/partners` → partners table = 404
- `/api/blog` → blog_posts table = 404 (blog uses filesystem/static)
- `/api/sellers` → sellers table = 404
- `/api/buyers` → buyers table = 404
- Any route referencing match_reports, investment_portfolios = 404

**Count: ~15-20 routes referencing missing tables**

### Routes with TODO/placeholder content
- /api/analytics/summary → contains placeholder logic
- /api/automation/dormant-leads → mock logic
- /api/content → content generation placeholder
- ~20 other routes with FIXME/TODO detected

### Duplicate/overlapping routes
- `/api/cron/self-heal` AND `/api/sre/self-heal` → same purpose, both active
- `/api/cron/detect-incidents` AND `/api/cron/anomaly-monitor` → overlapping
- Multiple "certification" endpoints (/api/system/go-live, /api/system/final-gate, /api/system/absolute-gate, etc.) → all do similar validation

---

## CRON JOB EXECUTION STATUS

**Evidence of execution:** `kpi_snapshots = 43` records with daily entries from June 3-5.  
This proves `/api/cron/kpi-snapshot` is executing daily in production.

**Cannot verify individual cron success without Vercel logs access.**

| Cron | Frequency | Evidence |
|------|-----------|----------|
| kpi-snapshot | Daily 23:55 | CONFIRMED (43 snapshots) |
| health-check | Hourly | Unknown |
| self-heal | Every 5 min | Unknown |
| worker-processor | Every 5 min | Unknown |
| Others (38) | Various | Unknown |

---

## WORKERS

| Worker | Status |
|--------|--------|
| /api/workers | Route exists |
| /api/workers/run | Route exists |
| execution confirmed | Unknown — no worker_logs table |

---

## SECURITY MIDDLEWARE

| Layer | Status | Evidence |
|-------|--------|----------|
| Rate limiting | ACTIVE | Upstash configured |
| Bot blacklist | ACTIVE | 14 UA patterns |
| HMAC token verify | ACTIVE | middleware.ts |
| CSRF | ACTIVE | middleware.ts |
| Auth check | ACTIVE | auth() calls in routes |
| CRON_SECRET | ACTIVE | Cron endpoints protected |

---

## ROUTES ASSESSMENT

### Healthy core routes (confirmed functional)
- `/api/properties` — returns 55 properties ✅
- `/api/contacts` — returns 28 contacts ✅
- `/api/deals` — returns 8 deals ✅
- `/api/matches` — returns 17 matches ✅
- `/api/auth/*` — magic link functional (37 tokens) ✅
- `/api/system/health` — auth-protected (403 anon) ✅
- `/api/kpi/snapshot` — running daily ✅

### Routes needing attention
- 20+ routes referencing missing tables → return errors when called
- ~15 routes with TODO/placeholder logic
- Duplicate monitoring routes (2 sets of self-heal/anomaly)
