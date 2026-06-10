# 01 — MASTER SYSTEM INVENTORY
Agency Group | Final Operating System Audit | 2026-06-11

---

## PLATFORM IDENTITY

| Field | Value |
|-------|-------|
| Domain | agencygroup.pt |
| Framework | Next.js 16.2.1 |
| Language | TypeScript strict |
| Runtime | Vercel Edge + Node.js |
| Database | Supabase (isbfiofwpxqqpgxoftph) — eu-central-1 Frankfurt |
| Auth | NextAuth v5 beta + magic links |
| AI | Anthropic Claude API (@anthropic-ai/sdk ^0.80.0) |
| Search | pgvector (Supabase) |
| Cache | Upstash Redis |
| Email | Resend |
| Payments | Stripe |
| Video | HeyGen |
| Maps | Leaflet |
| Animations | GSAP |
| Monitoring | Sentry |
| Messaging | WhatsApp Business API (configured, inactive) |

---

## FILE COUNTS (verified 2026-06-11)

| Type | Count | Method |
|------|-------|--------|
| Frontend pages (page.tsx) | 154 | glob |
| API routes (route.ts) | 542 | glob |
| SQL migrations | 278 | dir count |
| TypeScript errors | **0** | tsc --noEmit |
| Total TS files | ~1,997 | find count |

---

## FRONTEND PAGES (154 total)

### Public Pages
- Homepage (/)
- /imoveis, /imoveis/[id], /imoveis/premium/[id]
- /blog (60+ articles: EN/PT/FR/IT/ES/ZH)
- /avm (AVM tool)
- /contacto, /parceiros, /equipa, /imprensa
- /casos-de-sucesso, /vender, /vender-imovel-portugal, /vendidos
- /invest-in-portugal-real-estate, /investir
- /zonas/[zona] (redirect from /zonas — FIXED)
- /off-market, /off-market-portugal
- /buy-property-portugal, /relatorio-2026
- /faq, /privacy, /concierge-estrangeiros
- /ar, /de, /en, /fr, /zh (i18n routes)

### Portal (auth-gated)
- /portal (main dashboard)
- /portal/analytics/* (6 sub-pages)
- /dashboard (main)
- /dashboard/daily-brief, /dashboard/executive, /dashboard/properties/*
- /dashboard/simulations

### Control Tower (auth-gated, multi-section)
- /control-tower (main)
- 25+ sub-pages: agents, ai-timeline, ceo, compliance, distributed, economics, events, forensics, governance, graph, incidents, infra, learning, memory, observability, orchestration, queue, recovery, replay, revenue, security, self-healing, settings, tenants, workflows

### Experience Pages
- /experience (main)
- /experience/broker, /experience/digest, /experience/executive, /experience/operator

### Investor Pages
- /investor-intelligence, /investor-intelligence/success
- /onboarding, /white-label
- /collection/[token]

---

## API ROUTES (542 total — selected critical paths)

### Core Revenue Routes
- /api/deals (CRUD)
- /api/contacts (CRUD)
- /api/properties, /api/properties/public
- /api/matches (AI matching)
- /api/deal-packs/generate
- /api/capital/execute
- /api/investors/match

### Sofia AI
- /api/sofia/chat
- /api/sofia/os
- /api/sofia/session
- /api/sofia/speak
- /api/sofia/script
- /api/sofia-agent/chat

### CRM & Automation
- /api/crm/* (6 routes)
- /api/automation/* (9 routes)
- /api/cron/* (36 routes)

### Compliance & Security
- /api/compliance/* (8 routes)
- /api/security/* (8 routes)
- /api/audit/* (3 routes)

### Infrastructure
- /api/health, /api/health/deep, /api/health/smoke
- /api/system/* (10 routes)
- /api/sre/* (12 routes)

---

## DATABASE (Supabase — verified via REST API 2026-06-11)

### Core Tables

| Table | Row Count | Status |
|-------|-----------|--------|
| capital_profiles | **7,342** | ✅ Active |
| contacts | 28 | ✅ Active (1 real external) |
| deals | 8 | ✅ Active (demo data) |
| properties | 55 | ✅ Active (unverified) |
| kpi_snapshots | **47** | ✅ Fixed 2026-06-06 |
| matches | 17 | ✅ Active (demo) |
| activities | 8 | ✅ Active (demo) |
| offmarket_leads | 14 | ✅ Active (test data) |
| learning_events | 14 | ✅ Active |
| used_magic_tokens | 38 | ✅ Active (real logins) |
| sofia_conversation_turns | 0 | ⚠️ No conversations |
| sofia_escalations | 0 | ⚠️ No escalations |
| tasks | 0 | ⚠️ Empty |

### Missing Tables (routes exist, tables don't)

| Table | Impact |
|-------|--------|
| partners | Partner widgets broken |
| campanhas | Campaign routes broken |
| sellers | Seller pipeline broken |
| buyers | Buyer funnel broken |
| investment_portfolios | Portfolio widget broken |

---

## CRON JOBS (41 in vercel.json)

| # | Path | Schedule |
|---|------|----------|
| 1 | /api/cron/kpi-snapshot | 23:55 daily — **CONFIRMED RUNNING** |
| 2-4 | /api/cron/self-heal + anomaly-monitor + detect-incidents | */5 min |
| 5 | /api/cron/worker-processor | */5 min |
| 6 | /api/cron/refresh-graph-views | */30 min |
| 7 | /api/cron/runtime-recovery | */10 min |
| 8 | /api/cron/replay-dlq | */15 min |
| 9-41 | Various daily/weekly | Various |

Only kpi-snapshot confirmed running (evidence: 47 rows in DB).

---

## INTEGRATIONS

| Integration | Status | Evidence |
|-------------|--------|---------|
| Supabase | ✅ Connected | 7,342 records verified |
| Vercel | ✅ Deployed | kpi-snapshot running |
| Anthropic Claude | ✅ Configured | API key in env |
| Resend | ✅ Configured | Key in env |
| Stripe | ✅ Configured | Keys in env |
| Upstash Redis | ✅ Configured | Rate limiting active |
| HeyGen | ⚠️ Configured | No usage evidence |
| WhatsApp | ⚠️ Configured | WHATSAPP_ACTIVE not set |
| Sentry | ✅ Configured | Key in env |
| n8n | ❌ Not deployed | Local Docker only |

---

## MIGRATIONS

| Range | Count | Status |
|-------|-------|--------|
| 001-035 | 35 | Core schema |
| 036-100 | 65 | Features |
| 101-150 | 50 | Advanced |
| 151-278 | 128 | Latest (includes W54-W58) |
| Total | **278** | Verified in /supabase/migrations |

---

## SCRIPTS & EXPORTS

| File | Purpose |
|------|---------|
| scripts/import-crm-run.py | CRM import (7,342 contacts) |
| scripts/import-crm-final.ts | CRM import TS version |
| SOFIA_QUEUE.xlsx | 30,901 outreach messages (not sent) |
| n8n-workflows/ | 12 workflow files (local only) |

---

## SUMMARY TOTALS

| Metric | Value |
|--------|-------|
| Pages | 154 |
| API Routes | 542 |
| Migrations | 278 |
| Cron Jobs | 41 |
| DB Tables (active) | 13+ |
| CRM Contacts | 7,342 |
| TS Errors | **0** |
| Real Revenue | **€0** |
| Real External Leads | **1** |
