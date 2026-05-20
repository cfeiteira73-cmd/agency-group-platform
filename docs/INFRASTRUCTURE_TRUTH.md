# Infrastructure Truth

Agency Group SH-ROS — Live deployment topology, SPOFs, env vars, and break scenarios.  
Last updated: 2026-05-20 | Project: isbfiofwpxqqpgxoftph | Region: cdg1 (Paris)

---

## Deployment Topology

```
[Vercel Edge CDG1]
  ├── Next.js App (Node.js runtime, maxDuration 60s)
  ├── 36 Cron Jobs (vercel.json, authenticated via CRON_SECRET)
  └── RSC Pages (Control Tower, Portal, Public)

[Supabase — isbfiofwpxqqpgxoftph]
  ├── PostgreSQL (primary data store — all CRM, events, traces, metrics)
  ├── Auth (magic link via used_magic_tokens table)
  ├── Storage (property photos, documents)
  └── Edge Functions (exec-sql, if deployed)

[Upstash Redis]
  ├── Cron distributed locks (cron:lock:{name})
  ├── Alert deduplication (alert_dedup:{alertId}, TTL 1h)
  └── Rate limiting

[Anthropic API]
  └── Sofia AI (claude-sonnet-4-5 primary, claude-haiku-3 fallback)

[External APIs]
  ├── Resend (transactional email)
  ├── Twilio / Meta WhatsApp Cloud API (Sofia WhatsApp)
  ├── HeyGen (Sofia video avatar)
  ├── OpenAI (embeddings text-embedding-3-small, Whisper voice)
  ├── Stability AI (home staging / virtual staging)
  ├── Apify (official actors only — scrapers removed 2026-04-13)
  └── Sentry (error monitoring)
```

---

## Required Environment Variables

Variables marked **CRITICAL** will cause visible feature failure if missing.  
Variables marked WARNING degrade silently or affect non-core features.

| Variable | Severity | Impact if Missing |
|---|---|---|
| `ANTHROPIC_API_KEY` | CRITICAL | Sofia AI disabled entirely |
| `NEXT_PUBLIC_SUPABASE_URL` | CRITICAL | Database unavailable — all CRM, portal, events disabled |
| `SUPABASE_SERVICE_ROLE_KEY` | CRITICAL | Server-side DB writes disabled |
| `AUTH_SECRET` | CRITICAL | Portal magic-link auth disabled |
| `PORTAL_API_SECRET` | CRITICAL | Lead scoring disabled |
| `INTERNAL_API_BASE` | CRITICAL | All Control Tower panels show empty/skeleton state |
| `CRON_SECRET` | WARNING | Cron jobs unauthenticated |
| `RESEND_API_KEY` | WARNING | Email alerts disabled |
| `UPSTASH_REDIS_REST_URL` | WARNING | No distributed cron locks, no rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | WARNING | No distributed cron locks, no rate limiting |
| `OPENAI_API_KEY` | WARNING | Semantic vector search disabled, Whisper voice disabled |
| `WHATSAPP_ACCESS_TOKEN` | WARNING | WhatsApp inbound/outbound disabled |
| `WHATSAPP_VERIFY_TOKEN` | WARNING | WhatsApp webhook verification fails |
| `TWILIO_AUTH_TOKEN` | WARNING | Twilio SMS fallback disabled |
| `HEYGEN_API_KEY` | WARNING | Sofia video avatar disabled |
| `N8N_WEBHOOK_URL` | WARNING | n8n automation disabled |
| `NEXT_PUBLIC_GTM_ID` | WARNING | Analytics tracking disabled |
| `SENTRY_DSN` | WARNING | Error monitoring disabled |
| `NEXT_PUBLIC_SENTRY_DSN` | WARNING | Client-side error monitoring disabled |
| `VAPID_PUBLIC_KEY` | WARNING | Push notifications disabled |
| `VAPID_PRIVATE_KEY` | WARNING | Push notifications disabled |
| `STABILITY_API_KEY` | WARNING | Virtual staging disabled |

### Critical: INTERNAL_API_BASE

This variable must be set to the **full production URL** (e.g. `https://www.agencygroup.pt`).

All Control Tower RSC pages (15 pages) do server-side `fetch()` calls via this base URL.  
If it is missing or set to `localhost`, every Control Tower panel returns empty data with no visible error.  
The startup validator in `instrumentation.ts` will log a CRITICAL error and write to the `incidents` table.

### Critical: CRON_SECRET

Must be a random string matching the `Authorization: Bearer {CRON_SECRET}` header that Vercel sends.  
All 36 cron routes check this header. Without it, crons are unauthenticated.

---

## Single Points of Failure (SPOFs)

### SPOF-1: Supabase (PostgreSQL)

**What breaks:** Everything. All CRM data, lead scoring, property listings, agent workflows, events, traces.  
**Detection:** `/api/cron/health-check` (runs hourly) — checks Supabase connectivity.  
**Recovery:** Automatic on Supabase restoration. No data loss — all writes are persisted.  
**Mitigation:** Supabase Pro has 99.9% uptime SLA. No secondary database configured.

### SPOF-2: Upstash Redis

**What breaks:** Cron distributed locks, alert deduplication, rate limiting.  
**Impact:** Without locks, overlapping cron invocations may run concurrently (double-execution risk).  
**Detection:** `withCronLock.ts` logs to `incidents` table after 3 failed retries.  
**Recovery:** Fail-open — crons run without lock when Redis is unreachable (prevents silent skips).  
**Mitigation:** Exponential backoff (200ms, 400ms, 800ms) on 429 rate limits.

### SPOF-3: Anthropic API

**What breaks:** Sofia AI chat, lead scoring AI, deal analysis.  
**Detection:** Circuit breaker in `lib/ops/circuitBreaker.ts` opens after 5 consecutive failures.  
**Recovery:** Half-open probe after 60 seconds.  
**Mitigation:** `claude-haiku-3` fallback for non-critical paths. Sofia returns graceful error message.

### SPOF-4: Vercel Region (CDG1 Paris)

**What breaks:** Entire application.  
**Detection:** External uptime monitoring (not yet configured — recommend Betterstack or UptimeRobot).  
**Recovery:** Vercel handles regional failover automatically for CDG1.

### SPOF-5: INTERNAL_API_BASE misconfiguration

**What breaks:** All 15 Control Tower pages return skeleton/empty state with no visible error.  
**Detection:** Startup validator in `instrumentation.ts` logs CRITICAL error and writes incident.  
**Recovery:** Set correct value in Vercel project environment variables → redeploy.

---

## Cron Job Schedule

All crons are authenticated via `Authorization: Bearer {CRON_SECRET}` header.  
All crons use atomic Redis lock via `lib/ops/withCronLock.ts` (SET NX EX).

| Cron Path | Schedule | Lock TTL | Purpose |
|---|---|---|---|
| `/api/cron/health-check` | Every hour | 2 min | Platform health check |
| `/api/cron/anomaly-monitor` | Every 5 min | — | Anomaly detection |
| `/api/cron/detect-incidents` | Every 5 min | — | Incident detection |
| `/api/cron/self-heal` | Every 5 min | — | Autonomous remediation |
| `/api/cron/worker-processor` | Every 5 min | — | Event queue worker |
| `/api/cron/replay-dlq` | Every 15 min | 2 min | DLQ replay |
| `/api/cron/runtime-recovery` | Every 10 min | — | Runtime recovery |
| `/api/cron/refresh-graph-views` | Every 30 min | — | Materialized view refresh |
| `/api/cron/kpi-snapshot` | 23:55 daily | — | Daily KPI snapshot |
| `/api/cron/purge-conversations` | 03:00 daily | — | GDPR conversation purge |
| `/api/cron/update-partner-tiers` | 03:00 daily | — | Partner tier updates |
| `/api/cron/recalibrate-market` | 01:00 daily | — | Market recalibration |
| `/api/cron/recompute-agent-performance` | 04:00 daily | — | Agent performance metrics |
| `/api/cron/refresh-engagement-decay` | 04:15 daily | 30 min | Engagement decay scoring |
| `/api/cron/refresh-market-segments` | 04:30 daily | 45 min | Market segment refresh |
| `/api/cron/ingest-listings` | 05:00 daily | — | Listing ingestion |
| `/api/cron/refresh-distribution-outcomes` | 05:30 daily | — | Distribution outcomes |
| `/api/cron/sync-listings` | 06:00 daily | — | Listing sync |
| `/api/cron/data-quality-score` | 06:00 daily | — | Data quality scoring |
| `/api/cron/avm-compute` | 07:00 daily | — | AVM computation |
| `/api/cron/revenue-leakage` | 07:30 weekdays | 2 min | Revenue leakage detection |
| `/api/cron/investor-alerts` | 08:30 daily | — | Investor alerts |
| `/api/cron/dre-ingest` | 09:00 weekdays | 3 min | DRE data ingestion |
| `/api/cron/followups` | 09:00 daily | — | Lead follow-up automation |
| `/api/cron/weekly-calibration` | 02:00 Sunday | 55 min | Weekly ML calibration |

---

## Observability Stack

| Component | Persistence | Cold Start Recovery |
|---|---|---|
| Causal traces | `causal_trace` table (Supabase) | Loaded on demand by correlation_id |
| Anomaly baselines | `anomaly_baselines` table (Supabase) | Loaded on first `checkMetrics()` call |
| DLQ window | `runtime_events` (type=dlq_event) | Last 5 minutes loaded on cold start |
| Metric snapshots | `runtime_events` (type=metric_snapshot) | Written every 60s; last snapshot queryable |
| Distributed traces | `causal_trace` (step_type=distributed_trace) | Persisted fire-and-forget on span end |
| Alert dedup | Upstash Redis (alert_dedup:{id}, TTL 1h) | Lost on Redis restart — acceptable (duplicate alerts safer than missed) |
| Active alerts | `system_alerts` table (Supabase) | Queried fresh on each request |

### Causal Trace — Default On

`CAUSAL_TRACE_ENABLED` defaults to **on** (opt-out via `=false`).  
Set `CAUSAL_TRACE_ENABLED=false` to disable all causal trace writes (e.g. dev environment with no Supabase).

---

## Database Tables (Key)

| Table | Purpose |
|---|---|
| `causal_trace` | Causal event chains, AI decisions, revenue attribution |
| `runtime_events` | SH-ROS event bus, DLQ events, metric snapshots |
| `incidents` | Platform incidents (auto-created by anomaly monitor, startup validator) |
| `system_alerts` | Active alerts (created by alert router) |
| `anomaly_baselines` | EMA baselines for anomaly detection (persists cold starts) |
| `mv_agent_revenue` | Materialized: per-agent revenue aggregates |
| `mv_deal_flow_paths` | Materialized: correlation_id → step sequence |
| `mv_tenant_graph_stats` | Materialized: per-tenant KPIs |
| `cron_lock` | DEPRECATED — replaced by Redis SET NX EX in `withCronLock.ts` |

---

## Break Scenarios

### Scenario A: Control Tower Shows All Empty

**Cause:** `INTERNAL_API_BASE` is not set or points to localhost in production.  
**Debug:** Check Vercel env vars for `INTERNAL_API_BASE`. Check `incidents` table for `misconfiguration` type.  
**Fix:** Set `INTERNAL_API_BASE=https://www.agencygroup.pt` in Vercel → redeploy.

### Scenario B: Crons Running Twice (Double Execution)

**Cause:** Upstash Redis is down — `withCronLock.ts` fails-open (runs without lock).  
**Debug:** Check `incidents` table for `dependency_unavailable` type with `cron_lock` in title.  
**Fix:** Restore Upstash connectivity. Crons are idempotent by design — double runs are safe but wasteful.

### Scenario C: Control Tower Graph / Revenue Data Stale

**Cause:** `refresh_graph_views()` RPC failing — materialized views not refreshed.  
**Debug:** Check `/api/cron/refresh-graph-views` logs. Check if `causal_trace` table is empty.  
**Fix:** Run `SELECT refresh_graph_views();` manually in Supabase SQL editor.  
If `causal_trace` is empty, `CAUSAL_TRACE_ENABLED` may be set to `false`.

### Scenario D: Sofia AI Returns Errors

**Cause:** Anthropic API unavailable or rate-limited. Circuit breaker opens after 5 failures.  
**Debug:** Check `system_alerts` table for `ai_circuit_open` type.  
**Fix:** Circuit auto-recovers after 60 seconds. If persistent, check ANTHROPIC_API_KEY validity.

### Scenario E: Anomaly Baselines Reset on Deploy

**Cause (pre-fix):** Baselines were in-memory Map — reset on every cold start.  
**Status (post-fix):** Baselines persist in `anomaly_baselines` table. Cold starts load from DB.  
**Verify:** Query `SELECT COUNT(*) FROM anomaly_baselines;` — should grow over time.

### Scenario F: WhatsApp Messages Not Processed

**Cause:** `WHATSAPP_ACTIVE=false` (default) — Sofia does NOT reply on WhatsApp.  
**Fix:** Set `WHATSAPP_ACTIVE=true` in Vercel env vars to enable Sofia replies.  
Note: messages are always saved to CRM regardless of WHATSAPP_ACTIVE.

---

## Migration: Running DDL in Production

Supabase Management API requires a Personal Access Token (PAT) from https://supabase.com/dashboard/account/tokens.  
The service role key only allows CRUD and RPC — NOT DDL.

**To apply a new migration:**
1. Open https://supabase.com/dashboard/project/isbfiofwpxqqpgxoftph/sql/new
2. Paste the SQL from `supabase/migrations/{migration_name}.sql`
3. Run it

**Or use the Management API with PAT:**
```
SUPABASE_ACCESS_TOKEN=<pat> node scripts/run-migrations-v4.mjs
```

Latest migration: `20260521000003_create_materialized_views.sql`

---

## Security Notes

- All cron routes require `Authorization: Bearer {CRON_SECRET}` — validated via `safeCompare()` (timing-safe)
- Internal API routes require `INTERNAL_API_TOKEN` or `INTERNAL_API_SECRET`
- WhatsApp webhook requires `WHATSAPP_APP_SECRET` for HMAC signature validation
- Magic links are single-use (SHA-256 hash stored in `used_magic_tokens`)
- Rate limiting via Upstash Redis — falls back to in-memory (single-instance only) if Redis unavailable
- OFFMARKET_CODES are comma-separated in env var — not in database
