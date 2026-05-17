# Global Scale Truth Report
AGENCY GROUP SH-ROS · 2026-05-17

---

## Current Infrastructure

Based on codebase analysis:
- **Frontend/API:** Next.js 14 on Vercel (serverless functions)
- **Database:** Supabase (PostgreSQL + Supabase Auth)
- **AI:** Anthropic Claude API (raw REST calls, no SDK)
- **Rate limiting:** Upstash Redis (distributed) when `UPSTASH_REDIS_REST_URL` is configured, in-memory Map fallback
- **File storage:** Supabase Storage / S3 (inferred from image URL patterns)
- **Event bus:** In-process (`lib/events/bus.ts`) — no Kafka, no SQS
- **Caching:** s-maxage HTTP headers on some API routes; no application-level Redis cache beyond rate limiting
- **Queues:** `lib/ops/jobQueue.ts` exists but appears to be in-memory

---

## Scaling Constraints Identified from Code

### In-Memory State

**`lib/buyer-intelligence/buyerIntentProfiler.ts`**
```
private readonly sessions = new Map<string, SessionEntry>()
```
The buyer intent profiler is a singleton in-memory store. On Vercel, each serverless function invocation may run in a separate process. A buyer's session events arriving across two different function instances will build two separate, incomplete profiles. The 4-hour TTL eviction is meaningless because the Map is destroyed when the function instance is recycled (typically every 15–30 minutes of inactivity, or immediately on cold start).

**Risk:** MEDIUM at current scale (one active agent, few concurrent visitors). HIGH at scale (100 agents, 500 concurrent sessions). The buyer intelligence layer is effectively non-functional in a distributed serverless deployment.

**`lib/rateLimit.ts` (in-memory fallback)**
```
const store = new Map<string, RateLimitEntry>()
```
When Upstash is not configured, rate limiting is per-process, not per-IP globally. Two Vercel function instances could each allow 60 requests/minute from the same IP, resulting in 120 effective requests. In production with Upstash configured this is resolved. Confirm Upstash env vars are set.

### AI Pipeline Bottlenecks

**Vision analysis is serial, not parallel (`lib/property-ai/ingestion/visionAnalyzer.ts`):**
```
for (const url of imageUrls) {
  const raw = await callClaudeVision(url, VISION_PROMPT)
  ...
}
```
10 images = 10 sequential Claude API calls. At 3–5 seconds per call, processing takes 30–50 seconds. Vercel serverless functions have a default timeout of 10 seconds (configurable to 30s on Pro, 60s on Enterprise). A 10-photo submission likely exceeds the default timeout unless `maxDuration` is explicitly set in the route config.

**`app/dashboard/properties/new/page.tsx` uses `signal: AbortSignal.timeout(90_000)` for uploads**, suggesting the upload route is configured for extended duration. This is good practice but requires verification that the Vercel route config matches.

**Listing generation pipeline (`lib/property-ai/listing-generator/`):**
- descriptionGenerator: 4,000 output tokens = ~6–8 seconds
- titleGenerator: 2,000 output tokens = ~3–5 seconds
- seoGenerator: 2,000 output tokens = ~3–5 seconds
- multilingualAdapter × 3 languages: ~4,500 output tokens = ~8–12 seconds

Total listing generation: ~20–30 seconds for a full 3-language listing. This is within Vercel's 30s extended limit but has no margin for API latency spikes.

### Database Query Patterns

**`lib/intelligence/conversionPropensity.ts`** performs 3 sequential Supabase queries:
1. `recipient_performance_profiles` (up to 100 rows)
2. `investor_intelligence` (unbounded — no `limit()` clause)
3. `partner_tiers` (unbounded — no `limit()` clause)

The investor_intelligence and partner_tiers queries fetch all rows and build in-memory Maps. At small scale (100 investors, 50 partners) this is fine. At scale (10,000 investors), these unbounded queries become slow and memory-intensive.

**No N+1 protections observed.** The properties list page fetches submissions then renders intelligence scores that are stored inline in the submission record — no secondary joins in the client. This is acceptable.

### Vercel Serverless Constraints

**Cold start impact:** Each `import` chain touching `lib/property-ai/` pulls in multiple modules and their dependencies. Cold start for AI-heavy routes may be 1–3 seconds, which adds to perceived latency on first use after a period of inactivity.

**No persistent WebSocket connections:** The daily brief, properties page, and conversion command all use polling patterns (user manually refreshes). There is no real-time push to agents when a new signal fires or a hot lead arrives. The `lib/push/notifications.ts` module and VAPID push notifications exist, but the dashboard pages do not consume them — agents must manually refresh to see new data.

**Function timeout risk for full AI pipeline:** The complete ingestion pipeline (vision × N + OCR + voice + geospatial + scoring + listing generation) likely exceeds 60 seconds for a large submission. This would need to be broken into an async job queue pattern with a status-polling UI — which is partially implemented (the `ingesting → analyzing → enriching → generating → reviewing → live` status pipeline in the properties page).

### Caching Coverage

**What is cached:**
- Homepage feed API: `s-maxage=900` (15 minutes) — handles public traffic well
- Static Next.js assets: Vercel CDN cache

**What should be cached but is not:**
- Zone market data (`lib/market/zones.ts`) is a 80+ zone static constant that never changes at runtime. It is re-imported on every function invocation. This is fine (no DB hit), but it should be documented as a static asset, not a dynamic one.
- Daily brief API response: regenerated on every request. If 15 agents open their brief simultaneously at 9 AM, 15 separate AI queries run in parallel. A 5-minute server-side cache on the brief API (per-agent) would be appropriate.
- Conversion funnel predictions: computed fresh on every request. Should be cached for 5–10 minutes per `(property_value, intent)` pair.

---

## Scale Ceilings (Estimated)

Based on code analysis, not live metrics:

**Concurrent listing submissions:**
- Serial vision analysis + listing generation = ~60–90 seconds per submission
- Vercel concurrent function limit: depends on plan (typically 100–1000 concurrent)
- Practical ceiling: ~20–30 concurrent submissions before queue pressure builds
- **Effective throughput: ~40–60 submissions/hour** before latency degrades significantly

**Homepage requests:**
- Handled by Vercel CDN + 15-minute cache. Scales to millions of requests/hour without issue. Not a bottleneck.

**Vision analysis throughput:**
- Claude API rate limits: varies by tier. At 4,000 RPM (common production tier), vision calls are not a bottleneck for Agency Group's current scale.
- Serial processing bottleneck: 10 photos/submission × 4s = 40s. Parallelizing to groups of 5 would reduce to ~8s.
- **Effective throughput at current serial model: ~90 images/hour per Vercel instance.** Parallelized: ~450 images/hour.

**In-memory buyer profiles:**
- Each `SessionEntry` holds up to 50 events (approximately 5–10KB per session)
- At 1,000 concurrent sessions: ~5–10MB memory — fine for a Node.js process
- At 10,000 concurrent sessions: ~50–100MB — approaching Node.js serverless memory limits
- **Functional ceiling: effectively zero in distributed Vercel deployment** (state lost between invocations)

**Agent scale:**
- 1–10 agents: all current architecture works as-is
- 10–50 agents: buyer intent profiler needs Redis, daily brief needs per-agent caching
- 50–100 agents: job queue needs to become persistent (not in-memory), rate limiter must have Upstash configured

---

## Critical Scale Fixes

**Priority 1 — Migrate buyer intent profiler to Redis (HIGH)**
`lib/buyer-intelligence/buyerIntentProfiler.ts` must use Redis (Upstash already configured for rate limiting) instead of `new Map<>()`. Without this, buyer behavioral intelligence is silently non-functional in production. Replace the Map with Upstash GET/SET with TTL. Estimated effort: 1 day.

**Priority 2 — Parallelize vision analysis (HIGH)**
Replace serial `for...of` loop in `visionAnalyzer.ts` with batched `Promise.all()` (groups of 3–5). Would reduce submission processing time by 3–5× and prevent Vercel function timeouts on large photo sets. Estimated effort: 2 hours.

**Priority 3 — Add bounds to investor_intelligence and partner_tiers queries (MEDIUM)**
In `conversionPropensity.ts`, add `.limit(500)` to unbounded queries. These grow with the platform and could cause slow queries at scale. Estimated effort: 30 minutes.

**Priority 4 — Implement per-agent daily brief caching (MEDIUM)**
Cache the daily brief API response for 5 minutes per agent email. 15 agents opening their brief at 9 AM should not trigger 15 parallel AI calls. Estimated effort: 2 hours.

**Priority 5 — Convert in-memory job queue to persistent queue (MEDIUM)**
`lib/ops/jobQueue.ts` (inferred from file existence) needs to be backed by Supabase or Upstash for multi-instance deployments. Critical for the ingestion pipeline which runs long AI chains. Estimated effort: 1 day.

**Priority 6 — Document and verify Vercel maxDuration config (LOW)**
Confirm that all AI-heavy routes (`/api/property-ai/submissions`, `/api/property-ai/analyze`, etc.) have `export const maxDuration = 60` (or higher on Enterprise plan). A missing config defaults to 10 seconds and silently kills long AI calls. Estimated effort: 30 minutes.

---

## What Scales Naturally

**Signal detector:** Pure functions, zero DB calls, zero AI calls. Returns results in microseconds. Scales to any volume.

**Zone market data:** Static in-memory constant. Zero I/O. Scales infinitely.

**Homepage and public listing pages:** Next.js static generation + Vercel CDN cache. Scales to global traffic without backend load.

**Supabase reads with proper indexing:** PostgreSQL on Supabase handles standard real estate portfolio scales (up to ~100K listings) without tuning.

**Claude API calls (stateless per call):** Each AI call is independent. Claude API itself scales horizontally — SH-ROS does not need to manage AI infrastructure.

**Auth (HMAC cookie verification):** Pure crypto in the layout component, no DB call. Zero scalability concern.

**Rate limiter with Upstash configured:** Distributed Redis-backed rate limiting scales across all Vercel instances correctly.
