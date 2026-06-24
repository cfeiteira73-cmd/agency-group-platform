# Phase 04 — Vercel Crons Activation
**Date:** 2026-06-24  
**Status:** ✅ ANALYSIS COMPLETE

## Summary
- **41 crons defined** in `vercel.json`
- **All 41 have real route.ts files** (no ghost routes)
- **Critical env vars confirmed** in `.env.local` (and must be in Vercel dashboard too)

## Revenue-Critical Crons (Activate First)

| Cron | Schedule | Purpose | Priority |
|------|----------|---------|----------|
| `/api/cron/followups` | 9:00 UTC daily | Send follow-up emails via Resend | **#1** |
| `/api/alerts/push` | 8:15 UTC weekdays | Push buyer alerts to leads | **#2** |
| `/api/automation/revenue-loop` | 7:00/13:00/19:00 UTC | Revenue automation loop | **#3** |
| `/api/radar/digest` | 8:00 UTC daily | Deal radar digest | #4 |
| `/api/offmarket-leads/score` | 7:00 UTC weekdays | Score offmarket leads | #5 |
| `/api/reporting/daily` | 8:30 UTC weekdays | Daily KPI report | #6 |
| `/api/contact-enrichment/run` | 7:00 UTC weekdays | Contact enrichment | #7 |
| `/api/cron/kpi-snapshot` | 23:55 UTC daily | KPI snapshot | #8 |

## Notes on `/api/cron/followups`
- Reads contacts from **Notion CRM** (not Supabase contacts table)
- Uses Resend for email delivery
- Uses Redis for idempotency (prevents duplicate sends)
- **If Notion CRM has 0 contacts → 0 emails sent**
- Carlos must populate Notion CRM for this to fire real emails

## Required Vercel Environment Variables
> Add at: https://vercel.com/dashboard → Agency Group → Settings → Environment Variables

```
CRON_SECRET=<same as .env.local>
ADMIN_EMAIL=<same as .env.local>
RESEND_API_KEY=<same as .env.local>
ANTHROPIC_API_KEY=<same as .env.local>
SUPABASE_SERVICE_ROLE_KEY=<same as .env.local>
NOTION_TOKEN=<same as .env.local>
UPSTASH_REDIS_REST_URL=<same as .env.local>
UPSTASH_REDIS_REST_TOKEN=<same as .env.local>
```

## How to Test a Cron Manually
```bash
# From terminal:
curl -X GET https://agencygroup.pt/api/cron/followups \
  -H "Authorization: Bearer $CRON_SECRET"

# Or via Vercel dashboard:
# Vercel → Agency Group → Functions → Find route → Invoke
```

## Cron Auth Pattern (all crons use same pattern)
```typescript
const auth = request.headers.get('authorization');
if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
  return new Response('Unauthorized', { status: 401 });
}
```

## Verdict
Crons are code-ready. **Carlos action required:** Verify these env vars are set in Vercel dashboard (not just .env.local). Vercel crons don't read local .env files.
