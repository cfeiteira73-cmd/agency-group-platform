# SCALABILITY LIMITS — SH-ROS Certification
**Agency Group | AMI 22506 | Audit Date: 2026-05-17**
**Stack: Next.js 14 · Vercel Serverless · Supabase (PostgreSQL) · Upstash Redis · n8n**

---

## 1. Current Architecture Limits (Hard Ceilings)

### 1.1 Vercel Serverless Limits (Pro Plan)

| Constraint | Limit | Current Usage |
|---|---|---|
| Concurrent executions | 1,000 per deployment | Unknown — no tracking in place |
| maxDuration per function | 300s (Pro) | 3 crons at 300s, majority at 60s |
| Function invocations/month | 1,000,000 (Pro) | 25 crons × ~30/month = 750 cron invocations + user traffic |
| Payload size (request body) | 4.5 MB (Node.js runtime) | Upload endpoint accepts up to 10 × 50 MB → **500 MB total — EXCEEDS NODE LIMIT** |
| Edge Function memory | 128 MB | N/A — all routes are `runtime = 'nodejs'` |
| Node.js Function memory | 1,024 MB (Pro) | Unknown per-invocation peak |
| Cron jobs | 100 max | 25 currently defined |

**Critical finding:** The upload route (`/api/property-ai/upload`) declares `MAX_FILES_PER_BATCH = 10` and `MAX_FILE_SIZE = 50 MB`. A single request can present 500 MB of file data. Vercel's Node.js runtime payload limit is 4.5 MB for the HTTP request body. Multipart form data with 10 × 50 MB files will be rejected at the edge (413) before the route handler executes — but the code path has no pre-flight content-length check, so error messages returned to clients will be cryptic.

### 1.2 Supabase Connection Pool

| Parameter | Value |
|---|---|
| Default pool size (pgBouncer) | 15 connections on Free; 25 on Pro |
| Max direct connections (PostgreSQL) | ~97 on Pro (db.small) |
| Connection mode | Transaction pooler (default Supabase JS client) |
| supabaseAdmin client | Singleton per serverless invocation — **no connection reuse across invocations** |

**Critical finding:** Each Vercel serverless invocation creates a new `supabaseAdmin` instance via `createClient()`. In transaction pooler mode this is safe but adds 5–15 ms overhead per cold connection. At 100 concurrent requests, 100 simultaneous connections are opened, consuming the entire Pro pool. Requests 101+ will queue in pgBouncer until a connection is released.

### 1.3 Upstash Redis (Rate Limiter)

| Parameter | Value |
|---|---|
| Upstash REST API calls per command | 2 round-trips per rate-limit check (INCR + EXPIRE) + 1 TTL on block |
| Fail-open policy | YES — Upstash errors silently allow all requests |
| In-memory fallback | YES — `store = new Map()` — **dies on cold start, resets per invocation** |

**Critical finding:** `UPSTASH_CONFIGURED` is evaluated once at module load time. In serverless, each cold start re-evaluates. If Upstash env vars are absent in any invocation, that invocation falls back to an in-memory Map that is invisible to other invocations. Rate limiting is effectively non-functional across horizontal scale unless Upstash is confirmed configured in every deployment slot.

### 1.4 In-Memory BuyerIntentProfiler

| Parameter | Value |
|---|---|
| Data structure | `Map<string, SessionEntry>` — module-level singleton |
| Session TTL | 4 hours |
| Max events per session | 50 |
| Persistence | None — RAM only |
| Cross-invocation sharing | None — each serverless instance has independent Map |

**Ceiling:** On Vercel, each concurrent request may land on a different warm function instance. A user's `sessionId` events written to instance A are invisible to instance B. Profile accuracy degrades proportionally to the number of warm instances. At 10+ concurrent users hitting buyer-intelligence routes, profile state is siloed per container. The `evictExpired()` is called on every `addEvent()` and `getProfile()` — at high throughput this is an O(n) walk of the entire Map on every request.

---

## 2. Traffic Simulation Results

### Scenario A: 10x Traffic (100 req/s sustained)

**What breaks first and at what threshold:**

| Component | Breaks At | Failure Mode |
|---|---|---|
| Supabase connection pool | ~25–97 concurrent DB-bound requests | pgBouncer queue → timeouts → 500 errors on DB routes |
| BuyerIntentProfiler | 2+ warm instances | Session state siloed — profiles incomplete — buyer scoring degrades silently |
| In-memory rate limiter fallback | 1st horizontal scale event | Rate limit bypassed entirely — DoS protection fails |
| Upstash Redis | 100 req/s × 2 calls = 200 RPS to Upstash | Within Upstash free tier (10K req/day) limit after ~50 seconds |
| `/api/executive/dashboard` | ~20 concurrent callers | 7 simultaneous Supabase queries × 20 = 140 connections — pool exhausted |
| `/api/revenue-command/summary` | ~15 concurrent callers | 4 sequential safeQuery calls × 15 = 60+ connections |

**Routes most vulnerable at 100 req/s:**
1. `/api/executive/dashboard` — 7 parallel Supabase queries per request (Promise.all), no pagination, full table scans on `property_ai_submissions`, `property_ai_intelligence`, `contacts`, `deals`
2. `/api/revenue-command/summary` — 4 sequential DB queries with `.limit(200)` cap; full row fetch of contacts table
3. `/api/buyer-intelligence/track` — writes to in-memory Map that fragments across instances
4. `/api/property-ai/submit` — 6 sequential pipeline steps, each potentially hitting Anthropic API + Supabase; maxDuration=60s means at 100 concurrent, 6,000 seconds of total compute running simultaneously

**Economic impact at Supabase pool exhaustion:**
- Portal users cannot load executive dashboard → zero deal visibility
- Revenue command center returns zeros → agents operate blind
- Estimated revenue exposure: any deal not tracked during outage period

### Scenario B: Cron Concurrency Analysis (25 crons)

**Full cron inventory by schedule:**

| Time (UTC) | Crons Running | Supabase Queries | Conflict Risk |
|---|---|---|---|
| 03:00 daily | purge-conversations, update-partner-tiers | ~6 | Low |
| 04:00 daily | recompute-agent-performance, refresh-engagement-decay, refresh-market-segments | ~15 | MEDIUM — all write to analytics tables |
| 04:30 daily | refresh-market-segments | +5 | Overlaps 04:00 window |
| 05:00 daily | ingest-listings (300s), refresh-distribution-outcomes | ~30+ | HIGH — ingest-listings runs 5 min |
| 05:30 daily | refresh-distribution-outcomes | ~10 | Overlaps ingest-listings |
| 06:00 daily | sync-listings (300s), data-quality-score | ~40 | HIGH — sync-listings fetches 100 properties + writes signals/priority_items |
| 06:30+ | data-quality-score | ~10 | May overlap sync-listings |
| 07:00 daily | avm-compute (300s), contact-enrichment, offmarket-leads/score, automation/revenue-loop | ~80 | **CRITICAL STORM** |
| 07:30 | offmarket-leads/batch-eval | +20 | Deep in 07:00 storm |
| 08:00 daily | radar/digest, alerts/push, cron/investor-alerts | ~30 | HIGH |
| 08:15 daily | alerts/push | +15 | Overlaps 08:00 |
| 08:30 daily | reporting/daily, investor-alerts | +20 | Overlaps 08:00 |
| 09:00 weekdays | dre-ingest (120s), followups | ~20 | Medium |
| 23:55 daily | kpi-snapshot | ~10 | Low |

**07:00 UTC Cron Storm — worst case:**
- `avm-compute` (300s, 50 properties × comps queries = ~200 DB reads)
- `contact-enrichment` (external API calls)
- `offmarket-leads/score` (limit=100 scoring queries)
- `automation/revenue-loop` (POST, 60s, 5 sequential Supabase steps with per-item `hasOpenItem` queries — up to 20+20+30+20=90 individual SELECT COUNT queries)

**Revenue-loop serial N+1 query problem:** Steps 1–4 call `hasOpenItem()` in a loop: up to 20 (stale matches) + 20 (stale packs) + 30 (stuck deals) + 20 (hot leads) = **90 individual SELECT COUNT queries** in a single invocation. At 07:00 UTC this runs simultaneously with avm-compute (300s) and offmarket scoring.

**Total estimated Supabase queries at 07:00 storm: 300–500 queries/minute**
This exceeds Supabase Pro's default query concurrency of 25 connections. pgBouncer will queue — median additional latency: 200–2,000ms per query. avm-compute and ingest-listings (both 300s maxDuration) risk hitting their time ceiling due to connection wait time, not computation time.

**Cron failure cascade:**
1. `ingest-listings` fails at 05:00 → `sync-listings` at 06:00 scores stale/missing properties → AVM at 07:00 computes on empty dataset → daily-brief at 08:30 shows 0 new listings → agent KPI reporting corrupted for the day
2. `avm-compute` fails at 07:00 → `investor-alerts` at 08:30 uses stale AVM values → investors receive alerts with incorrect price positioning → potential legal/compliance exposure

### Scenario C: Property AI Pipeline at Scale (100 simultaneous submissions)

**Pipeline step breakdown (submit route, maxDuration=60s):**

| Step | Operation | Estimated Duration | Bottleneck |
|---|---|---|---|
| 1. Media Ingestion | Vision + OCR + geo (Anthropic API) | 10–25s | Anthropic rate limit |
| 2. Listing Generation | Multilingual Claude call | 8–15s | Anthropic rate limit |
| 3. Media Scoring | Photo ranking, cover selection | 3–8s | Supabase Storage reads |
| 4. Intelligence | Demand/investor score compute | 2–5s | DB reads |
| 5. Copilot | Recommendations (Claude call) | 5–12s | Anthropic rate limit |
| 6. Distribution | Channel routing | 2–5s | N8N webhook + Supabase writes |
| **Total** | **Sequential pipeline** | **30–70s** | **Exceeds 60s at P90** |

**At 100 simultaneous submissions:**
- Anthropic claude-sonnet-4-6: default rate limit is 50 RPM (requests per minute) on Standard tier. 100 submissions × 3 Claude calls each = 300 Claude API calls/minute → **6x over the rate limit**. Requests queue or get 429 errors. Pipeline step 1 (ingestion) starts failing at ~50th concurrent submission.
- Supabase Storage: write contention on `property-media` bucket. No concurrency limit documented but S3-backed storage handles concurrent writes well; latency increases under load.
- maxDuration=60s: The sequential pipeline takes 30–70s end-to-end. At P90 with Anthropic congestion, submissions will reach the 60s wall and be killed mid-pipeline. Status in DB will be stuck at `analyzing`, `generating`, or `enriching` — no cleanup/rollback logic exists for timeout kills.
- **What fails at second 55:** If stuck at Step 2 (listing generation), the submission remains at status `analyzing` in `property_ai_submissions`. The listing never gets created. Media was already ingested and stored in Supabase Storage (orphaned files). No compensation transaction runs.

### Scenario D: Cold Start Analysis

**Cold start contributors:**

| Module | Bundle Impact | Cold Start Penalty |
|---|---|---|
| `@anthropic-ai/sdk` | Large — optimizePackageImports mitigates | ~80–150ms |
| `supabase-js` | Medium | ~30–50ms |
| `leaflet` | Client-only, not in API routes | N/A for API |
| `gsap` | Client-only | N/A for API |
| `zod` | Small | ~10ms |
| `next-auth` | Medium | ~40–60ms |

**Routes with >500ms estimated cold starts:**
1. `/api/property-ai/submit` — imports 6 orchestrators + Anthropic SDK + Supabase + zod + auth → estimated 600–900ms cold start
2. `/api/cron/sync-listings` — imports 3 scoring modules + signal detector + supabase → estimated 400–600ms cold start
3. `/api/automation/revenue-loop` — imports supabase + crypto + multiple lib modules → estimated 300–500ms cold start
4. `/api/executive/dashboard` — imports opportunityRadar + executive-revenue-v2 + supabase → estimated 400–600ms cold start

**All routes are `runtime = 'nodejs'`** — no Edge runtime is used anywhere. This means:
- No global CDN execution (all traffic routes to nearest Vercel region, typically eu-west-1 for PT)
- Cold start penalty applies after ~5 minutes of inactivity per function
- The `optimizePackageImports` for `@anthropic-ai/sdk` and `zustand` reduces tree-shake overhead but does not eliminate cold start time

**Edge vs Node.js tradeoff:** Routes like `/api/buyer-intelligence/track` (10s maxDuration, no Supabase) and `/api/voice-search` (15s maxDuration) could run on Edge runtime with <50ms cold start. Currently they run Node.js, adding 200–500ms cold start penalty on every idle period.

### Scenario E: Database Failure Scenarios

**Supabase 30s timeout — cascade analysis:**

| Route | Fallback Behavior | Returns |
|---|---|---|
| `/api/executive/dashboard` | try/catch → returns all-zeros payload | 200 with empty data |
| `/api/revenue-command/summary` | safeQuery returns [] → zeros | 200 with empty data |
| `/api/cron/ingest-listings` | runIngestionPipeline throws → 500 | 500 — cron marked failed |
| `/api/cron/sync-listings` | catches fatal → 207 partial | 207 — automations_log not written |
| `/api/cron/avm-compute` | throws → 500 | 500 — no automations_log entry |
| `/api/property-ai/submit` | Step 6 or any step throws → 500 | 500 — submission stuck in partial status |
| `/api/automation/revenue-loop` | Per-step try/catch → continues | 207 — items not created but cycle continues |
| `/api/cron/health-check` | Single try/catch → 500 | 500 — no alerts fire during DB outage |

**Routes that return 500 and have no fallback:**
- `ingest-listings` — cron marks failed; no retry logic in Vercel
- `avm-compute` — cron marks failed; downstream crons (investor-alerts) run with stale AVM
- `health-check` — **the monitoring system itself goes blind during DB outage**

**Revenue lost per minute of Supabase downtime:**
- Portal is non-functional (all portal routes require DB): agents cannot view pipeline, leads, or deals
- Agent average deal value: €1.5M × 5% commission = €75,000
- Average deal cycle: 210 days = ~€357/hour/deal in implicit pipeline throughput
- For 3 active agents with 5 deals each: 15 × €357 = **€5,357/hour** in pipeline throughput at risk
- Real-time buyer inquiries that hit DB-backed routes return 500 → lead lost permanently if not retried

---

## 3. Scalability Ceiling Summary

| Metric | Current Ceiling | Notes |
|---|---|---|
| **Requests/day** | ~86,400 (1 req/s sustained) | Beyond this, DB pool exhaustion begins |
| **Peak concurrent users (portal)** | ~20–25 | Each dashboard call = 7+ DB connections |
| **Concurrent Property AI submissions** | ~15–20 | Anthropic rate limit + 60s maxDuration |
| **Properties ingested/day** | 200 (hard-coded limit param) | ingest-listings default limit=200 |
| **Properties scored/day** | 100 (sync-listings default) | Configurable but cron-constrained |
| **AVM computations/day** | 50 (avm-compute default) | Sequential, 300s budget |
| **Buyer sessions tracked** | ~500 active (in-memory, 4h TTL) | Dies on horizontal scale |
| **Cron DB load at storm peak** | ~500 queries/min | Exceeds pool at 07:00 UTC daily |
| **Max upload per request** | 4.5 MB (Vercel HTTP limit) | Code allows 500 MB — mismatch |

---

## 4. Immediate Scaling Interventions (Priority Order)

1. **BuyerIntentProfiler → Upstash Redis** (Critical): Replace in-memory Map with Redis HASH per session. TTL via Redis EXPIRE. All instances share state.
2. **Executive Dashboard → Add DB indexes + pagination** (Critical): Full table scans on `property_ai_submissions`, `contacts`, `deals` will fail as data grows. Add `status` index, paginate with `.limit(100)`.
3. **Revenue-loop N+1 → Batch hasOpenItem** (High): Replace 90 individual SELECT COUNT queries with one `SELECT entity_id FROM priority_items WHERE status='open' AND entity_id IN (...)`.
4. **Upload endpoint → Stream to Supabase directly** (High): Bypass 4.5 MB Vercel payload limit by streaming multipart upload chunks directly to Supabase Storage using signed upload URLs.
5. **Property AI submit → Async queue** (High): Move 6-step pipeline to a background job (Supabase Edge Function or n8n workflow). Submit route returns `{submission_id, status: 'queued'}` immediately. 60s maxDuration becomes irrelevant.
6. **Cron storm at 07:00 → Stagger schedules** (Medium): Separate avm-compute (07:00) from revenue-loop (07:00 is one of 3 daily runs). Move revenue-loop to 07:30 or 08:00.
7. **Rate limiter fail-open → Fail-safe fallback** (Medium): When Upstash is unreachable, return 429 (deny) rather than allow. Fail-open is a DoS vulnerability.
