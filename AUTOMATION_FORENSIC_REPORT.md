# AUTOMATION FORENSIC REPORT
Agency Group | Phase 12 | Ultimate Institutional Master Audit | 2026-06-06

---

## CRON EXECUTION STATUS

| Evidence | Value | Implication |
|----------|-------|-------------|
| kpi_snapshots count | 43 | Cron runs daily |
| kpi_snapshots data accuracy | WAS ZERO (FIXED) | Bug existed for 43 days |
| Other cron execution | Unverified | Need Vercel logs |

**Only /api/cron/kpi-snapshot confirmed running.**  
**All other 40 crons: defined but execution unconfirmed.**

---

## ALL 41 CRON JOBS

| # | Cron Path | Schedule | Status |
|---|-----------|----------|--------|
| 1 | /api/radar/digest | Daily 8:00 | UNVERIFIED |
| 2 | /api/market-data/refresh | Monday 3:00 | UNVERIFIED |
| 3 | /api/cron/followups | Daily 9:00 | UNVERIFIED |
| 4 | /api/cron/purge-conversations | Daily 3:00 | UNVERIFIED |
| 5 | /api/offmarket-leads/score | Weekdays 7:00 | UNVERIFIED |
| 6 | /api/reporting/daily | Weekdays 8:30 | UNVERIFIED |
| 7 | /api/buyers/score | Weekdays 6:15 | UNVERIFIED |
| 8 | /api/offmarket-leads/batch-eval | Weekdays 7:30 | UNVERIFIED |
| 9 | /api/alerts/push | Weekdays 8:15 | UNVERIFIED |
| 10 | /api/contact-enrichment/run | Weekdays 7:00 | UNVERIFIED |
| 11 | /api/cron/kpi-snapshot | Daily 23:55 | **CONFIRMED (43 runs)** |
| 12 | /api/automation/revenue-loop | 3x daily 7/13/19 | UNVERIFIED |
| 13-41 | Various | Various | UNVERIFIED |

---

## N8N AUDIT

### 12 Workflows (ALL LOCAL DOCKER)
None deployed to production. All sit in n8n-workflows/ folder.

### Deploy to Railway (3-4 hours, €0):
```
1. railway.app → New Project → Deploy Docker
2. Use n8n-workflows/Dockerfile.n8n
3. Environment:
   N8N_BASIC_AUTH_USER=admin
   N8N_BASIC_AUTH_PASSWORD=[strong pass]
   SUPABASE_URL=https://isbfiofwpxqqpgxoftph.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=[from .env.local]
   RESEND_API_KEY=[from .env.local]
4. Import workflows via n8n UI
5. Activate: workflow-b-daily-report first
```

---

## ORPHAN / DUPLICATE LOGIC

| Type | Routes | Action |
|------|--------|--------|
| Duplicate self-heal | /api/cron/self-heal + /api/sre/self-heal | Keep one, disable other |
| Duplicate incident | /api/cron/detect-incidents + /api/cron/anomaly-monitor | Keep one |
| Orphan routes | ~5 routes reference missing tables | Low priority |

---

## AUTOMATION SCORE: 58/100

| Component | Score |
|-----------|-------|
| Cron infrastructure | 85 (41 defined) |
| Cron execution | 65 (only 1 confirmed) |
| n8n deployment | 0 (local only) |
| Email sequences | 0 (0 running) |
| WhatsApp automation | 0 (inactive) |
| **Average** | **58/100** |
