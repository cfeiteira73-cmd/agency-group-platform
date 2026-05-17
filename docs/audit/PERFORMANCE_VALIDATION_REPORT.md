# Performance Validation Report
**AGENCY GROUP SH-ROS · Audit Date: 2026-05-17**
*Static analysis — no live traffic data available at audit time*

---

## Infrastructure Baseline

| Layer | Technology | Hosting |
|---|---|---|
| Frontend + API | Next.js 14 App Router | Vercel (Serverless + Edge) |
| Database | Supabase (PostgreSQL) | Supabase Cloud |
| File Storage | Supabase Storage | Supabase Cloud |
| AI Models | Anthropic Claude API | Anthropic Cloud |
| Cron Jobs | Vercel Cron | Vercel |
| In-Memory State | Process memory | Ephemeral (serverless) |
| CDN | Vercel Edge Network | Global |

---

## API Route Performance Profile

### Critical Path Routes

#### `/api/property-ai/upload` — File Upload
- `maxDuration: 30s` ✅
- Max file size: 50MB per file ✅
- Sequential file processing (one `arrayBuffer()` per file)
- **Bottleneck**: processing 10×50MB files would approach timeout
- **Recommendation**: add `MAX_FILES_PER_BATCH = 10` guard

#### `/api/property-ai/analyze` — AI Ingestion Orchestrator
- Runs 5 parallel AI operations: vision + OCR + voice + geospatial + URL scrape
- Each Claude call: ~2–8s depending on image count
- `N` photos = `N` sequential Claude vision calls (serial loop in `visionAnalyzer.ts`)
- **Estimated p95**: 15–25s for 5 photos + 1 PDF + 1 URL
- **Bottleneck**: vision analyzer runs photos serially, not parallel
- **Fix**: `Promise.all(imageUrls.map(...))` in VisionAnalyzer — estimated 60% speedup

#### `/api/pricing-intelligence` — Pricing Computation
- Pure computation, no DB, no AI calls
- **Estimated p50**: <50ms ✅
- **Estimated p99**: <200ms ✅
- No bottlenecks identified

#### `/api/executive/dashboard` — Executive Dashboard
- 5 parallel Supabase queries + opportunityRadar.scan()
- `opportunityRadar.scan()` calls Supabase internally
- **Estimated p50**: 300–600ms (DB round trips)
- **Estimated p95**: 1–2s under normal load
- `maxDuration: 15s` sufficient ✅

#### `/api/agent/actions` — Action Queue
- Sequential DB queries (not parallelized)
- Calls `opportunityRadar.scan()` which is async Supabase
- **Bottleneck**: not using `Promise.all` for independent queries
- **Fix**: parallelize the 4 DB fetches

#### `/api/property-ai/homepage-feed` — Homepage Feed
- `Cache-Control: s-maxage=900, stale-while-revalidate=60` ✅ — CDN cached
- First request: 1–3s (DB + sort)
- Subsequent requests: <50ms (CDN hit) ✅
- **Status**: correctly architected for scale

---

## In-Memory State — Critical Scale Risk

### Buyer Intent Profiler (`lib/buyer-intelligence/buyerIntentProfiler.ts`)
- Uses `Map<string, BuyerIntentProfile>` in process memory
- **Risk**: Vercel serverless functions are stateless — memory wiped on cold start
- **Risk**: Multiple concurrent instances = split memory = stale profiles
- **Impact at scale**: Medium — profiles are rebuilding each session anyway
- **Fix for scale**: Redis or Supabase table for profile persistence
- **Current status**: Acceptable for < 100 concurrent sessions

### Rate Limiter (`app/api/buyer-intelligence/track/route.ts`)
- Uses `Map<string, RateLimitBucket>` in process memory
- **Risk**: Not distributed — each Vercel instance has its own limiter
- **Impact**: 60 req/min per IP *per instance* (could be 60×N across N instances)
- **Fix for scale**: Upstash Redis rate limiting (already used elsewhere in codebase)
- **Current status**: Acceptable for Phase 1, fix before scale

---

## Vision Analysis Throughput

```
Current serial implementation:
  5 photos × 4s avg = 20s sequential processing
  10 photos × 4s avg = 40s → EXCEEDS maxDuration

Parallelized (fix):
  5 photos parallel = ~6s (limited by Claude concurrency)
  10 photos parallel = ~8s ✅
```

**Fix** (1-line change in `lib/property-ai/ingestion/visionAnalyzer.ts`):
```ts
// CURRENT (serial):
for (const url of imageUrls) { ... }

// FIX (parallel):
const results = await Promise.all(imageUrls.map(url => analyzeOne(url)))
```

---

## CDN and Caching Audit

| Route | Cache Strategy | Status |
|---|---|---|
| `/api/property-ai/homepage-feed` | s-maxage=900, SWR=60 | ✅ Optimal |
| `/api/pricing-intelligence` | private, no-store | ✅ Correct (personalized) |
| `/api/executive/dashboard` | private, no-store | ✅ Correct |
| `/api/daily-brief` | private, no-store | ✅ Correct |
| All static assets | Vercel CDN (auto) | ✅ |
| Homepage (RSC) | Edge runtime, no-store | ✅ Correct |

---

## Database Query Risk Analysis

### N+1 Query Risks
- `app/api/agent/actions/route.ts`: Queries submissions, then joins intelligence — acceptable (bounded set)
- `app/api/executive/dashboard/route.ts`: Multiple queries for listings + intelligence + listings — potential N+1 if not using IN clauses
- `app/api/property-ai/homepage-feed/route.ts`: Parallel queries with `Promise.all` ✅

### Missing Indices (Estimated)
- `property_ai_submissions(status)` — filtered on status='live' frequently
- `property_ai_intelligence(submission_id)` — joined frequently
- `contacts(score, last_contacted_at)` — filtered for hot leads
- `deals(org_id, status)` — filtered frequently

### Supabase Connection Limits
- Vercel serverless + Supabase = connection pooling via PgBouncer ✅
- Current usage: well within limits for < 50 concurrent users

---

## Vercel Cold Start Analysis

- Edge runtime routes (homepage): ~10–50ms cold start ✅
- Node.js runtime routes: ~300–800ms cold start
- Routes with heavy imports (Claude, Supabase): ~500ms–1.2s cold start
- `maxDuration` settings range from 10s–30s — all appropriate ✅

---

## Scale Ceilings (Estimated)

| Metric | Current Ceiling | Notes |
|---|---|---|
| Concurrent listing submissions | ~20/hour | Limited by Claude vision serial processing |
| Homepage requests | Unlimited (CDN cached) | ✅ |
| Dashboard concurrent users | ~200 | Vercel auto-scales |
| In-memory buyer profiles | ~500 sessions | Before memory pressure on single instance |
| Supabase read throughput | ~5,000 req/s | Well above current needs |

---

## Priority Performance Fixes

### 🚨 CRITICAL — Before high-volume launch:
1. **Parallelize vision analysis** — `Promise.all` in visionAnalyzer.ts — 60% speedup, prevents timeout
2. **Add `MAX_FILES_PER_BATCH` guard in upload route** — prevent timeout on large batches

### ⚠️ HIGH — Before scaling to 50+ agents:
3. **Replace in-memory rate limiter with Upstash Redis** — distributed rate limiting
4. **Persist buyer profiles to Supabase** — survive serverless cold starts
5. **Add database indices** on `property_ai_submissions(status)`, `contacts(score, last_contacted_at)`

### 📋 MEDIUM — Before 100+ agents:
6. **Parallelize agent/actions DB queries** — use `Promise.all` instead of sequential
7. **Add query result caching** on executive dashboard (5-min TTL, per-org)
8. **Connection pooling review** as Supabase concurrent connections increase

---

## What Performs Well ✅

- Homepage feed: correctly CDN-cached, excellent at scale
- All pure computation routes (pricing, simulations): sub-50ms, no DB
- File upload: robust validation, correct size limits
- Auth: HMAC-based portal auth is fast (no DB lookup)
- Cron jobs: properly isolated with CRON_SECRET

---

*This report is based on static code analysis. Live traffic profiling should be performed once the system reaches >50 concurrent users.*
