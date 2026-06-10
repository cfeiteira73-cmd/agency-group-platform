# 12 — AUTOMATION AUDIT
Agency Group | Final Operating System Audit | 2026-06-11

---

## CRON EXECUTION STATUS (verified 2026-06-11)

| Evidence | Value |
|----------|-------|
| kpi_snapshots count | **47** (was 43 on 2026-06-06) |
| Crons confirmed running | 1 (kpi-snapshot) |
| Last kpi run | 2026-06-09 (most recent in DB) |
| Data accuracy since fix | ✅ Correct |

**ONLY /api/cron/kpi-snapshot CONFIRMED RUNNING.**
41 other crons: defined, execution unverified.

---

## ALL 41 CRON JOBS (from vercel.json)

| # | Path | Schedule | Status |
|---|------|----------|--------|
| 1 | /api/cron/kpi-snapshot | 23:55 daily | **CONFIRMED ✅** |
| 2 | /api/cron/self-heal | */5 min | UNVERIFIED |
| 3 | /api/cron/anomaly-monitor | */5 min | UNVERIFIED |
| 4 | /api/cron/detect-incidents | */5 min | UNVERIFIED |
| 5 | /api/cron/worker-processor | */5 min | UNVERIFIED |
| 6 | /api/cron/replay-dlq | */15 min | UNVERIFIED |
| 7 | /api/cron/runtime-recovery | */10 min | UNVERIFIED |
| 8 | /api/cron/refresh-graph-views | */30 min | UNVERIFIED |
| 9 | /api/cron/capture-drift-snapshot | hourly | UNVERIFIED |
| 10 | /api/cron/health-check | hourly | UNVERIFIED |
| 11 | /api/radar/digest | daily 8:00 | UNVERIFIED |
| 12 | /api/market-data/refresh | Monday 3:00 | UNVERIFIED |
| 13 | /api/cron/followups | daily 9:00 | UNVERIFIED |
| 14 | /api/cron/purge-conversations | daily 3:00 | UNVERIFIED |
| 15 | /api/cron/avm-compute | daily 7:00 | UNVERIFIED |
| 16 | /api/cron/investor-alerts | daily 8:30 | UNVERIFIED |
| 17 | /api/automation/revenue-loop | 3x daily | UNVERIFIED |
| 18-41 | Various | Various | UNVERIFIED |

---

## N8N WORKFLOWS (12 total)

| Status | Value |
|--------|-------|
| Location | C:\Users\Carlos\agency-group\n8n-workflows\ |
| Deployment | **LOCAL DOCKER ONLY — NOT PRODUCTION** |
| Production active | **0 workflows** |
| SOFIA_QUEUE dependency | 30,901 messages depend on n8n |
| Revenue impact | High — all email sequences blocked |

### N8N Deployment to Railway (4 hours, €0)
```bash
# Steps:
1. railway.app → New Project → Deploy Docker
2. Use n8n-workflows/Dockerfile.n8n
3. Environment vars:
   N8N_BASIC_AUTH_USER=admin
   N8N_BASIC_AUTH_PASSWORD=[strong password]
   SUPABASE_URL=https://isbfiofwpxqqpgxoftph.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=[from .env.local]
   RESEND_API_KEY=[from .env.local]
4. Import workflows via n8n UI
5. Activate workflow-b-daily-report first
```

---

## DUPLICATE CRON PROBLEM

| Issue | Routes | Risk |
|-------|--------|------|
| Duplicate self-heal | /api/cron/self-heal + /api/sre/self-heal | Both run */5 min → double execution |
| Duplicate incident | /api/cron/detect-incidents + /api/cron/anomaly-monitor | Potential double alerts |

**Recommendation**: Remove one of each duplicate from vercel.json.

---

## AUTOMATION THAT WORKS (confirmed)

| Component | Evidence |
|-----------|---------|
| kpi-snapshot cron | 47 rows in kpi_snapshots |
| Rate limiting (Upstash) | Active on auth routes |
| Magic link auth | 38 used_magic_tokens |
| CSP headers | In middleware |
| GDPR purge cron | Defined (3:00 daily) — unverified |

---

## AUTOMATION THAT DOESN'T WORK

| Component | Status |
|-----------|--------|
| Email sequences | 0 running (n8n not deployed) |
| WhatsApp automation | 0 (inactive) |
| Sofia follow-ups | 0 (no conversations) |
| Revenue loop | 0 verified executions |
| Investor alerts | 0 verified executions |
| Lead scoring | 0 verified executions |

---

## SCORE: 35/100

| Category | Score | Reason |
|----------|-------|--------|
| Cron infrastructure | 90/100 | 41 defined in vercel.json |
| Cron execution | 25/100 | Only 1 confirmed |
| n8n deployment | 0/100 | Local only |
| Email sequences | 0/100 | Never sent |
| WhatsApp automation | 0/100 | Inactive |
| Alert system | 20/100 | Code exists, no evidence |
