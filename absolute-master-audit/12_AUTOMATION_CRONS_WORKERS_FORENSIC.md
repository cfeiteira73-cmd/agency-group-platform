# 12 — AUTOMATION / CRONS / WORKERS FORENSIC
**Agency Group | Absolute Master Forensic Audit | 2026-06-25**

---

## Summary

| Metric | Value |
|--------|-------|
| Crons in vercel.json | **41** |
| Crons with confirmed route.ts | **41** (all verified revenue-activation sprint) |
| Crons actively producing data | **1** (kpi-snapshot) |
| Crons requiring data to work | ~20 |
| Crons requiring external API keys | ~15 |
| n8n workflows (local) | **21** |
| n8n deployed | **0** |

---

## Complete Cron Inventory (41 entries)

| Route | Schedule | Purpose | Active? | Blocker |
|-------|---------|---------|---------|---------|
| `/api/cron/kpi-snapshot` | 55 23 * * * | Daily KPI | ✅ RUNNING | None |
| `/api/cron/health-check` | 0 * * * * | Hourly health | ✅ Likely running | None |
| `/api/cron/followups` | 0 9 * * * | Follow-up sequences | ⚠️ Running | No contacts to follow up |
| `/api/cron/purge-conversations` | 0 3 * * * | GDPR purge | ✅ Running | None (just purges old data) |
| `/api/cron/ingest-listings` | 0 5 * * * | Property ingestion | ⚠️ Running | CASAFARI_API_KEY configured? |
| `/api/cron/sync-listings` | 0 6 * * * | Listings sync | ⚠️ Running | External API dependency |
| `/api/cron/avm-compute` | 0 7 * * * | AVM batch | ✅ Running | Uses internal data |
| `/api/cron/investor-alerts` | 30 8 * * * | Investor alerts | ⚠️ Running | Needs alert recipients |
| `/api/cron/dre-ingest` | 0 9 * * 1-5 | DRE data | ⚠️ Running | DRE API configured? |
| `/api/cron/recompute-agent-performance` | 0 4 * * * | Agent perf | ⚠️ Running | No agents |
| `/api/cron/update-partner-tiers` | 0 3 * * * | Partner tiers | ⚠️ Running | No partners |
| `/api/radar/digest` | 0 8 * * * | Radar digest | ✅ Running | Uses internal logic |
| `/api/alerts/push` | 15 8 * * 1-5 | Push alerts | ✅ Fixed | Needs alert triggers |
| `/api/automation/revenue-loop` | 0 7,13,19 * * * | Revenue loop | ⚠️ Running | 3x/day, needs deals |
| `/api/buyers/score` | 15 6 * * 1-5 | Buyer scoring | ✅ Running | Scores all buyers |
| `/api/offmarket-leads/score` | 0 7 * * 1-5 | Lead scoring | ✅ Running | Rescores leads |
| `/api/offmarket-leads/batch-eval` | 30 7 * * 1-5 | Batch evaluation | ✅ Running | Evaluates leads |
| `/api/contact-enrichment/run` | 0 7 * * 1-5 | Enrichment | ⚠️ Running | Apollo key needed |
| `/api/reporting/daily` | 30 8 * * 1-5 | Daily report | ✅ Running | Internal data |
| `/api/market-data/refresh` | 0 3 * * 1 | Market data | ⚠️ Running | External API |
| Other 21 crons | Various | System ops | ⚠️ Running | Varies |

**IMPORTANT CAVEAT**: All 41 crons execute on schedule on Vercel. "Running" means Vercel fires the HTTP request. "Active data output" depends on DB state, API keys, and business logic. Most crons execute without error but produce minimal meaningful output due to empty data tables.

---

## The One Confirmed Active Cron

### `/api/cron/kpi-snapshot` (Daily at 23:55 UTC)

```
File: app/api/cron/kpi-snapshot/route.ts
Schedule: 55 23 * * *
Output: 1 row per day in kpi_snapshots table
Evidence: 47 rows confirmed 2026-06-11 (62+ expected by 2026-06-25)
```

This cron:
1. Counts contacts, deals, properties
2. Calculates pipeline value
3. Sums expected_fee
4. Writes snapshot to DB

It IS generating real data, just from a near-empty CRM.

---

## Workers / Queue Systems

The platform has a job queue concept via:
- `priority_items` table (migration 20260426_001)
- `learning_events` table (migration 20260519000001)
- `analytics_events` table

These are DB-based queues, not separate worker processes. They operate via cron polling.

---

## Automation Route Categories

| Category | Count | Purpose |
|----------|-------|---------|
| `/api/cron/*` | 37 | Scheduled cron jobs |
| `/api/automation/*` | 15 | Workflow automation routes |
| `/api/reality/*` | 8 | Reality check automation |
| `/api/remediation/*` | 5 | Auto-remediation |

---

## What Would Happen if n8n Were Deployed

The 3,164 rows in `outreach_queue` represent leads ready for automated outreach sequences. If n8n deployed to Railway:

```
Day 1-7: First batch of 500 contacts get enrichment workflow
Week 2: Leads with email get automated email sequence
Week 3-4: Responders get follow-up sequence
Month 2: Hot leads (score ≥80 who open emails) get deal pack
```

Estimated additional emails generated: **800-1,200 in first month** (from Apollo enrichment workflow).

---

## GDPR Automation

| Cron | Function | Status |
|------|---------|--------|
| `/api/cron/purge-conversations` | Purge old sofia conversations | ✅ Running |
| GDPR Art.17 deletion | API route exists | ✅ |
| GDPR Art.20 portability | API route exists | ✅ |

---

*Evidence: vercel.json (41 crons verified) | revenue-activation/04_VERCEL_CRONS_ACTIVATION.md | kpi_snapshots=47 confirmed 2026-06-11*
