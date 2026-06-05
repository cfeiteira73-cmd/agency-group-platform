# AUTOMATION TRUTH REPORT
Agency Group | 2026-06-05

## 41 CRON JOBS — ALL VERIFIED (0 orphans)

### Always-on (every 5 min)
- worker-processor, detect-incidents, self-heal, anomaly-monitor, sre/self-heal

### Business Intelligence (daily, weekdays)
- offmarket-leads/score (07:00), buyers/score (06:15)
- investor-alerts (08:30), revenue-loop (3x/day)
- followups (09:00), contact-enrichment/run (07:00)
- avm-compute (07:00), revenue-leakage (07:30)

### Data Maintenance (daily)
- ingest-listings, sync-listings, data-quality-score
- kpi-snapshot, purge-conversations, vault-integrity
- health-check (hourly), capture-drift-snapshot (hourly)

### Weekly
- ml-training-sync (Sunday), weekly-calibration (Monday)
- market-data/refresh (Monday)

## AUTOMATION GAPS
| Gap | Root cause | Impact |
|-----|-----------|--------|
| Email enrichment not running | No Apollo/Hunter API key | 7,275 leads without email |
| Investor alerts = empty | capital_profiles empty | Cron runs but returns nothing |
| Contact enrichment = empty | No enrichment API | Daily compute wasted |
| Newsletter not sending | No dispatch system | 7,342 never emailed |
| Asset ingestion manual | No automation built | Sourcing requires human |

## DUPLICATE/OVERLAP
- /api/sofia/ and /api/sofia-agent/ — DUPLICATE (deprecate agent)
- Contact enrichment runs daily — API not configured

## AUTOMATION SCORE: 80/100
What gives 85: Fix legacy routes, configure enrichment API
What gives 90: Newsletter platform + asset auto-ingestion
