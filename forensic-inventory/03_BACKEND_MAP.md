# 03 — BACKEND MAP
**Agency Group | Nano Detail Forensic Inventory | 2026-06-11**

---

## SUMMARY

| Metric | Count |
|--------|-------|
| Total API routes | 542 (route.ts files) |
| Cron jobs (vercel.json) | 41 |
| n8n workflows | 11 |
| Lib service files | ~400+ |
| Workers | 7 |
| Middleware files | 4 |
| External integrations | 15+ |

---

## API ROUTES BY DOMAIN

### ANALYTICS (24 routes)
```
GET  /api/analytics/adoption          — Adoption metrics
GET  /api/analytics/agent-performance — Agent KPIs
GET  /api/analytics/auto-learning     — ML auto-learning metrics
GET  /api/analytics/benchmarks        — Market benchmarks
GET  /api/analytics/business-simulation — What-if scenarios
GET  /api/analytics/calibration       — Scoring calibration
GET  /api/analytics/conversion-propensity — Conversion AI
GET  /api/analytics/data-moat         — Data advantage metrics
GET  /api/analytics/data-quality      — Data quality score
GET  /api/analytics/distribution-feedback — Distribution analytics
GET  /api/analytics/distribution-intelligence — Channel intel
GET  /api/analytics/distribution-route — Routing analytics
GET  /api/analytics/economic-truth    — Economic reality
GET  /api/analytics/engagement-decay  — Lead decay analysis
GET  /api/analytics/events/replay     — Event replay
GET  /api/analytics/executive         — Executive summary
GET  /api/analytics/financial         — Financial analytics
GET  /api/analytics/forecast          — Revenue forecast
GET  /api/analytics/funnel            — Conversion funnel
GET  /api/analytics/growth            — Growth metrics
GET  /api/analytics/inventory-forecast — Inventory projections
GET  /api/analytics/learning          — AI learning status
GET  /api/analytics/market-feedback   — Market signal feedback
GET  /api/analytics/revenue           — Revenue dashboard
```

### AUTH (15 routes)
```
POST /api/auth/send          — Send magic link (rate-limited)
GET  /api/auth/verify        — Verify magic link token
POST /api/auth/gen           — Generate token
POST /api/auth/send-reset    — Password reset email
POST /api/auth/confirm-reset — Confirm password reset
GET  /api/auth/me            — Current user info
POST /api/auth/logout        — Logout
POST /api/auth/setup-2fa     — Setup TOTP 2FA
POST /api/auth/verify-2fa    — Verify 2FA code
POST /api/auth/check-2fa     — Check 2FA status
POST /api/auth/approve       — Approve pending auth
POST /api/auth/reject        — Reject auth request
POST /api/auth/request       — Request access
POST /api/auth/offmarket     — Off-market access request
POST /api/auth/complete-onboarding — Finish onboarding
```

### AUTOMATION (17 routes)
```
POST /api/automation/agent          — Agentic automation trigger
POST /api/automation/alert-check-sent — Alert check
POST /api/automation/circuit-breakers — CB management
POST /api/automation/daily-brief    — Daily brief generation
POST /api/automation/dormant-leads  — Dormant lead activation
POST /api/automation/forgotten-leads — Forgotten lead recovery
POST /api/automation/investor-alert — Investor notifications
POST /api/automation/lead-score     — Lead scoring trigger
POST /api/automation/match-buyer    — Buyer matching
POST /api/automation/nurture-candidates — Nurture sequences
POST /api/automation/nurture-mark-sent — Mark nurture sent
POST /api/automation/pipeline-advance — Pipeline progression
POST /api/automation/revenue-loop   — Revenue loop (3x/day)
POST /api/automation/signals        — Signal processing
POST /api/automation/vendor-report  — Vendor reporting
```

### CONTACTS & CRM (10 routes)
```
GET  POST  /api/contacts      — List/create contacts
GET  PUT   DELETE /api/contacts/[id] — Contact CRUD
POST       /api/crm/email-draft — Draft email via AI
POST       /api/crm/extract-contact — Extract from text
POST       /api/crm/meeting-prep — Meeting preparation
POST       /api/crm/next-step — Next best action
POST       /api/crm/voice-note — Process voice note
POST       /api/contact-enrichment/run — Enrich contacts
POST       /api/notion/contacts — Sync to Notion
GET        /api/leads — Lead list
```

### PROPERTIES (12 routes)
```
GET  /api/properties              — Portal properties (auth)
GET  /api/properties/public       — Public properties (no auth)
POST /api/properties/analyze-photos — AI photo scoring
GET  /api/properties/cma          — Comparable market analysis
GET  /api/properties/db           — DB direct query
POST /api/properties/generate-description — AI description
GET  /api/properties/search-natural — Natural language search
POST /api/property-ai/submit      — Submit new property
GET  /api/property-ai/submissions — List submissions
GET/PUT /api/property-ai/submissions/[id] — Submission detail
GET  /api/property-ai/homepage-feed — Homepage feed
POST /api/property-ai/upload      — Upload photos
POST /api/property-ai/track       — Track property views
GET  /api/avm                     — AVM valuation
POST /api/avm/photos              — Photo valuation
```

### DEALS (8 routes)
```
GET  POST /api/deals           — List/create deals
GET  POST /api/deal-packs      — List/create deal packs
GET  /api/deal-packs/[id]      — Deal pack detail
POST /api/deal-packs/[id]/pdf  — Generate PDF
POST /api/deal-packs/generate  — Auto-generate pack
POST /api/deal/draft-offer     — AI offer draft
GET  /api/deal/risk            — Deal risk analysis
GET  /api/deal/commission-pl   — Commission P&L
```

### CRON JOBS (41 jobs)

| Job | Schedule | Purpose | Status |
|-----|----------|---------|--------|
| /api/cron/kpi-snapshot | 23:55 daily | KPI recording | ✅ CONFIRMED (48 runs) |
| /api/cron/followups | 09:00 daily | Follow-up triggers | Unknown |
| /api/cron/purge-conversations | 03:00 daily | GDPR cleanup | Unknown |
| /api/cron/health-check | Hourly | System health | Unknown |
| /api/cron/avm-compute | 07:00 daily | AVM refresh | Unknown |
| /api/cron/ingest-listings | 05:00 daily | Property ingestion | Unknown |
| /api/cron/sync-listings | 06:00 daily | Listing sync | Unknown |
| /api/cron/investor-alerts | 08:30 daily | Alert investors | Unknown |
| /api/cron/dre-ingest | 09:00 Mon-Fri | DRE data | Unknown |
| /api/automation/revenue-loop | 07/13/19 daily | Revenue loop | Unknown |
| /api/cron/self-heal | Every 5min | Self-healing | Unknown |
| /api/cron/detect-incidents | Every 5min | Incident detection | Unknown |
| /api/cron/anomaly-monitor | Every 5min | Anomaly detection | Unknown |
| /api/cron/runtime-recovery | Every 10min | Recovery | Unknown |
| /api/cron/replay-dlq | Every 15min | DLQ replay | Unknown |
| /api/cron/refresh-graph-views | Every 30min | Graph refresh | Unknown |
| /api/cron/capture-drift-snapshot | Hourly | Drift tracking | Unknown |
| /api/cron/data-quality-score | 06:00 daily | Data quality | Unknown |
| /api/cron/refresh-distribution-outcomes | 05:30 daily | Distribution | Unknown |
| /api/cron/refresh-engagement-decay | 04:15 daily | Engagement | Unknown |
| /api/cron/refresh-market-segments | 04:30 daily | Segments | Unknown |
| /api/cron/revenue-leakage | 07:30 Mon-Fri | Leakage check | Unknown |
| /api/cron/vault-integrity | 02:00 daily | Vault check | Unknown |
| /api/cron/worker-processor | Every 5min | Worker jobs | Unknown |
| /api/cron/recalibrate-market | 01:00 daily | Market recal | Unknown |
| /api/cron/weekly-calibration | 02:00 Sunday | Weekly cal | Unknown |
| /api/cron/network-feedback | 03:00 daily | Network | Unknown |
| /api/cron/ml-training-sync | 01:00 Sunday | ML training | Unknown |
| /api/cron/ingestion-decay | 04:00 Monday | Decay | Unknown |
| /api/cron/update-partner-tiers | 03:00 daily | Partner tiers | Unknown |
| /api/cron/recompute-agent-performance | 04:00 daily | Agents | Unknown |
| /api/radar/digest | 08:00 daily | Radar digest | Unknown |
| /api/market-data/refresh | 03:00 Monday | Market data | Unknown |
| /api/offmarket-leads/score | 07:00 Mon-Fri | Lead scoring | Unknown |
| /api/buyers/score | 06:15 Mon-Fri | Buyer scoring | Unknown |
| /api/reporting/daily | 08:30 Mon-Fri | Daily report | Unknown |
| /api/alerts/push | 08:15 Mon-Fri | Push alerts | Unknown |
| /api/contact-enrichment/run | 07:00 Mon-Fri | Enrichment | Unknown |
| /api/offmarket-leads/batch-eval | 07:30 Mon-Fri | Batch eval | Unknown |
| /api/sre/self-heal | Every 5min | SRE healing | Unknown |
| /api/cron/delta-ingestion | 06:00 daily | Delta ingest | Unknown |

**CONFIRMED RUNNING: 1 of 41 (kpi-snapshot)**

---

## N8N WORKFLOWS (11 files)

| File | Purpose | Status |
|------|---------|--------|
| workflow-a-lead-inbound.json | Lead inbound processing | Local only |
| workflow-a-lead-enrichment.json | Lead enrichment | Local only |
| workflow-b-lead-scoring.json | Lead scoring | Local only |
| workflow-b-daily-report.json | Daily reporting | Local only |
| workflow-c-dormant-lead.json | Dormant lead reactivation | Local only |
| workflow-d-investor-alert.json | Investor alerts | Local only |
| workflow-e-vendor-report.json | Vendor reporting | Local only |
| workflow-h-score-high-alert.json | High score alert | Local only |
| workflow-i-followup-auto.json | Automated follow-up | Local only |
| workflow-j-partner-onboarding.json | Partner onboarding | Local only |
| workflow-k-meeting-notify.json | Meeting notification | Local only |
| post-close-automation.json | Post-close automation | Local only |
| property-ai-live-notification.json | Property AI notification | Local only |
| wf_g_current.json | General workflow | Local only |

**ALL n8n workflows are local Docker only. ZERO deployed to production.**

---

## LIB SERVICES ARCHITECTURE

The `lib/` folder contains ~400 TypeScript service files organized into 60+ modules:

| Module | Files | Purpose |
|--------|-------|---------|
| ai/ | 15 | AI gateway, budget enforcer, decision engine |
| compliance/ | 30+ | GDPR, SOC2, KYC, AML, regulatory |
| events/ | 25 | Kafka adapter, event bus, replay, DLQ |
| ml/ | 20 | Training, inference, feature store, drift |
| security/ | 30 | Zero trust, SIEM, RBAC, encryption |
| sre/ | 20 | Chaos, DR, failover, SLO tracking |
| observability/ | 20 | Tracing, logging, metrics, telemetry |
| finance/ | 15 | Settlement, ledger, cash flow |
| workers/ | 10 | Job processing, orchestration |
| runtime/ | 30+ | Queue, workflows, recovery, learning |
| capital/ | 10 | Transaction pipeline, escrow |
| validation/ | 10 | Production readiness gate |
| other/ | 100+ | Growth, market, analytics, expansion |

---

## EXTERNAL INTEGRATIONS

| Integration | Purpose | Status |
|------------|---------|--------|
| Anthropic Claude | Sofia AI, deal packs, CRM | Live |
| OpenAI | Embeddings (pgvector) | Configured |
| Supabase | Database + auth | Live |
| Vercel | Hosting + crons | Live |
| Resend | Email delivery | Configured |
| WhatsApp Business API | Outreach | Inactive |
| HeyGen | AI video avatar | Configured |
| Stripe | Payments | Configured |
| Upstash Redis | Rate limiting | Live |
| Sentry | Error monitoring | Configured |
| Twilio | SMS/voice (fallback) | Configured |
| Notion | CRM sync | Configured |
| Idealista | Property listings | Configured |
| Apify | Web scraping | Configured |
| Stability AI | Image generation | Configured |

---

## WORKERS

| Worker | Purpose | Status |
|--------|---------|--------|
| ingestionWorker.ts | Property ingestion | Inactive |
| matchingWorker.ts | Buyer matching | Inactive |
| mlTrainingWorker.ts | ML training | Inactive |
| processor.ts | Job processor | Inactive |
| revenueWorker.ts | Revenue events | Inactive |
| scoringWorker.ts | Lead scoring | Inactive |
| workerOrchestrator.ts | Worker management | Inactive |

---

*Evidence: app/api directory scan + lib/ directory scan + vercel.json + n8n-workflows/ — 2026-06-11*
