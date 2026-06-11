# 11 — AUTOMATION MAP
**Agency Group | Nano Detail Forensic Inventory | 2026-06-11**

---

## AUTOMATION SUMMARY

| System | Configured | Running | % Active |
|--------|-----------|---------|---------|
| Vercel crons (41) | 41 | 1 | 2.4% |
| n8n workflows (11) | 11 | 0 | 0% |
| Email sequences | 6 templates | 0 | 0% |
| WhatsApp sequences | Configured | 0 | 0% |
| Workers (7) | 7 | 0 | 0% |

**Total automation activation: ~2%**

---

## VERCEL CRON JOBS (41)

### CONFIRMED RUNNING
| Cron | Schedule | Evidence |
|------|----------|---------|
| /api/cron/kpi-snapshot | 23:55 daily | 48 rows in kpi_snapshots ✅ |

### HIGH FREQUENCY (every 5-15 min)
| Cron | Schedule | Purpose | Status |
|------|----------|---------|--------|
| /api/cron/self-heal | */5 * * * * | Self-healing | Unknown |
| /api/cron/detect-incidents | */5 * * * * | Incident detection | Unknown |
| /api/cron/anomaly-monitor | */5 * * * * | Anomaly detection | Unknown |
| /api/cron/worker-processor | */5 * * * * | Worker jobs | Unknown |
| /api/sre/self-heal | */5 * * * * | SRE healing | Unknown |
| /api/cron/replay-dlq | */15 * * * * | DLQ replay | Unknown |
| /api/cron/runtime-recovery | */10 * * * * | Recovery | Unknown |
| /api/cron/refresh-graph-views | */30 * * * * | Graph views | Unknown |
| /api/cron/capture-drift-snapshot | 0 * * * * | Hourly drift | Unknown |
| /api/cron/health-check | 0 * * * * | Health check | Unknown |

### DAILY CRONS
| Cron | Schedule | Purpose |
|------|----------|---------|
| /api/cron/kpi-snapshot | 55 23 | KPI recording ✅ |
| /api/cron/ingest-listings | 0 5 | Idealista ingestion |
| /api/cron/sync-listings | 0 6 | Listing sync |
| /api/cron/avm-compute | 0 7 | AVM recalculation |
| /api/cron/purge-conversations | 0 3 | GDPR cleanup |
| /api/cron/update-partner-tiers | 0 3 | Partner tier update |
| /api/cron/recompute-agent-performance | 0 4 | Agent metrics |
| /api/cron/refresh-distribution-outcomes | 30 5 | Distribution |
| /api/cron/refresh-engagement-decay | 15 4 | Engagement decay |
| /api/cron/refresh-market-segments | 30 4 | Market segments |
| /api/cron/recalibrate-market | 0 1 | Market calibration |
| /api/cron/vault-integrity | 0 2 | Vault check |
| /api/cron/network-feedback | 0 3 | Network feedback |
| /api/cron/data-quality-score | 0 6 | Data quality |
| /api/cron/delta-ingestion | 0 6 | Delta ingest |
| /api/radar/digest | 0 8 | Daily radar |
| /api/automation/revenue-loop | 0 7,13,19 | Revenue (3x/day) |

### WEEKDAY CRONS (Mon-Fri)
| Cron | Schedule | Purpose |
|------|----------|---------|
| /api/contact-enrichment/run | 0 7 | Contact enrichment |
| /api/offmarket-leads/score | 0 7 | Lead scoring |
| /api/cron/followups | 0 9 | Follow-up triggers |
| /api/cron/dre-ingest | 0 9 | DRE data |
| /api/reporting/daily | 30 8 | Daily report |
| /api/alerts/push | 15 8 | Push alerts |
| /api/cron/investor-alerts | 30 8 | Investor alerts |
| /api/buyers/score | 15 6 | Buyer scoring |
| /api/offmarket-leads/batch-eval | 30 7 | Batch eval |
| /api/cron/revenue-leakage | 30 7 | Leakage check |

### WEEKLY CRONS
| Cron | Schedule | Purpose |
|------|----------|---------|
| /api/market-data/refresh | 0 3 Mon | Market refresh |
| /api/cron/weekly-calibration | 0 2 Sun | Weekly calibration |
| /api/cron/ml-training-sync | 0 1 Sun | ML training |
| /api/cron/ingestion-decay | 0 4 Mon | Decay model |

---

## N8N WORKFLOWS (11 files — ALL LOCAL, NONE IN PRODUCTION)

### Core Revenue Workflows
| Workflow | File | Trigger | Status |
|----------|------|---------|--------|
| Lead Inbound | workflow-a-lead-inbound.json | Webhook | Local |
| Lead Enrichment | workflow-a-lead-enrichment.json | Cron | Local |
| Lead Scoring | workflow-b-lead-scoring.json | Cron | Local |
| Dormant Lead | workflow-c-dormant-lead.json | Cron | Local |
| Investor Alert | workflow-d-investor-alert.json | Trigger | Local |
| High Score Alert | workflow-h-score-high-alert.json | Event | Local |
| Follow-up Auto | workflow-i-followup-auto.json | Sequence | Local |

### Reporting Workflows
| Workflow | File | Trigger | Status |
|----------|------|---------|--------|
| Daily Report | workflow-b-daily-report.json | Daily 08:00 | Local |
| Vendor Report | workflow-e-vendor-report.json | Weekly | Local |

### Partner & Operations
| Workflow | File | Purpose |
|----------|------|---------|
| Partner Onboarding | workflow-j-partner-onboarding.json | New partner |
| Meeting Notify | workflow-k-meeting-notify.json | Calendar event |
| Post-Close | post-close-automation.json | After CPCV |
| Property AI Notify | property-ai-live-notification.json | New submission |

### Deployment Requirements (4 hours total)
1. Install Railway.app (free tier available)
2. Deploy n8n via Railway Docker
3. Set N8N_BASE_URL + N8N_WEBHOOK_URL env vars
4. Import 11 workflow JSON files
5. Configure Resend + WhatsApp credentials in n8n

---

## CIRCUIT BREAKERS

| Component | File | Purpose |
|-----------|------|---------|
| Circuit Breaker | lib/automation/circuitBreaker.ts | Prevent cascade failures |
| Retry Engine | lib/automation/intelligentRetry.ts | Smart retry logic |
| Provider Fallback | lib/automation/providerFallback.ts | API failover |
| ML Healer | lib/automation/mlPipelineHealer.ts | ML recovery |

---

## EMAIL SEQUENCES (configured, 0 deployed)

| Template | Language | Target |
|----------|---------|--------|
| Cold outreach institutional | EN/PT/FR | A+ contacts |
| Property match alert | EN/PT/FR/DE | Qualified buyers |
| Market intelligence | EN | Fund managers |
| Follow-up #1 (3 days) | EN/PT | No-reply |
| Follow-up #2 (7 days) | EN/PT | No-reply |
| Dormant reactivation | EN/PT | 90-day inactive |

---

## WHATSAPP AUTOMATION

| Component | Status |
|-----------|--------|
| API credentials | Configured |
| WHATSAPP_ACTIVE | NOT SET |
| Webhook | /api/whatsapp/webhook (working) |
| Send route | /api/whatsapp/send |
| n8n integration | Configured in workflows |

**To activate: Set WHATSAPP_ACTIVE=true in Vercel → Deploy n8n → Configure Meta webhook**

---

## PUSH NOTIFICATIONS

| Component | Status |
|-----------|--------|
| VAPID keys | Configured |
| Subscribe route | /api/push/subscribe |
| Send route | /api/push/send |
| Web Push library | web-push ^3.6.7 |
| Usage | Unknown (notifications table: 0 rows) |

---

*Evidence: vercel.json analysis, n8n-workflows/ directory, lib/automation/ scan — 2026-06-11*
