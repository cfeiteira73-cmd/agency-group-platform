# 04 — BACKEND / API FORENSIC MAP
**Agency Group | Absolute Master Forensic Audit | 2026-06-25**

---

## Summary

| Metric | Value |
|--------|-------|
| Total API routes (route.ts files) | **542** |
| Top route category | cron (37 routes) |
| Second category | analytics (36 routes) |
| Auth routes | 16 |
| Sofia routes | 5 |
| CRM routes | 6 |
| Property routes | 7 |

---

## Route Categories (by count)

| Category | Routes | Purpose | Status |
|----------|--------|---------|--------|
| `/api/cron/*` | 37 | Scheduled jobs | Deployed, most INACTIVE |
| `/api/analytics/*` | 36 | Analytics ingestion/read | Live |
| `/api/sre/*` | 16 | SRE/reliability | Live |
| `/api/auth/*` | 16 | Authentication | ✅ Core — LIVE |
| `/api/automation/*` | 15 | Workflow automation | Mostly inactive |
| `/api/system/*` | 14 | System management | Partially live |
| `/api/control-tower/*` | 13 | Control tower APIs | Live (low traffic) |
| `/api/investors/*` | 12 | Investor management | Live |
| `/api/ops/*` | 12 | Operations | Live |
| `/api/security/*` | 12 | Security controls | Live |
| `/api/offmarket-leads/*` | 11 | Off-market lead engine | Live |
| `/api/validation/*` | 10 | Data validation | Live |
| `/api/market/*` | 10 | Market data | Live |
| `/api/compliance/*` | 10 | Compliance checks | Live |
| `/api/incidents/*` | 9 | Incident management | Live |
| `/api/ml/*` | 9 | ML infrastructure | Mostly stub |
| `/api/reality/*` | 8 | Reality checks | Live |
| `/api/properties/*` | 7 | Property CRUD | ✅ LIVE |
| `/api/resilience/*` | 6 | Resilience testing | Live |
| `/api/simulation/*` | 6 | Financial simulation | Live |
| `/api/property-ai/*` | 6 | AI property features | Live |
| `/api/crm/*` | 6 | CRM operations | Live |
| `/api/dashboard/*` | 6 | Dashboard APIs | Live |
| `/api/sofia/*` | 5 | Sofia AI agent | ✅ LIVE |
| `/api/buyers/*` | 5 | Buyer management | Live |
| `/api/financial/*` | 5 | Financial tracking | Live |
| `/api/heygen/*` | 5 | HeyGen avatar | Dormant (key not set) |
| `/api/remediation/*` | 5 | Auto-remediation | Live |
| `/api/observability/*` | 4 | Observability | Live |
| `/api/gpt/*` | 4 | GPT Actions | Live |
| Other (30+ categories) | ~250 | Mixed | Mixed |

---

## Critical Revenue-Path Routes

| Route | Method | Auth | Rate Limit | Status |
|-------|--------|------|-----------|--------|
| `POST /api/avm` | POST | ✅ portalAuth | ✅ Upstash | ✅ LIVE |
| `POST /api/sofia/chat` | POST | ✅ session | ✅ | ✅ LIVE |
| `GET /api/deals` | GET | ✅ Bearer | No | ✅ LIVE |
| `POST /api/deals` | POST | ✅ Bearer | No | ✅ LIVE |
| `GET /api/contacts` | GET | ✅ Bearer | No | ✅ LIVE |
| `POST /api/contacts` | POST | ✅ Bearer | No | ✅ LIVE |
| `POST /api/mortgage` | POST | ❌ Public | No | ✅ LIVE |
| `GET/POST /api/properties/public` | GET | ❌ Public | No | ✅ LIVE |
| `GET /api/radar` | GET | ❌ Public | No | ✅ LIVE |

---

## Auth Routes (Core — Always Live)

| Route | Purpose | Status |
|-------|---------|--------|
| `POST /api/auth/send` | Send magic link | ✅ |
| `GET /api/auth/verify` | Verify magic link token | ✅ |
| `POST /api/auth/google` | Google OAuth | ✅ |
| `GET/POST /api/auth/[...nextauth]` | NextAuth handlers | ✅ |
| `GET /api/auth/session` | Session info | ✅ |
| `POST /api/auth/logout` | Logout | ✅ |

---

## Cron Routes (41 in vercel.json)

| Route | Schedule | Purpose | Confirmed Route.ts |
|-------|---------|---------|-------------------|
| `/api/cron/kpi-snapshot` | 55 23 * * * | KPI snapshots | ✅ CONFIRMED RUNNING |
| `/api/radar/digest` | 0 8 * * * | Radar digest | ✅ |
| `/api/cron/followups` | 0 9 * * * | Follow-up sequences | ✅ |
| `/api/cron/purge-conversations` | 0 3 * * * | GDPR purge | ✅ |
| `/api/cron/ingest-listings` | 0 5 * * * | Property ingestion | ✅ |
| `/api/cron/sync-listings` | 0 6 * * * | Listings sync | ✅ |
| `/api/cron/avm-compute` | 0 7 * * * | AVM batch | ✅ |
| `/api/cron/investor-alerts` | 30 8 * * * | Investor alerts | ✅ |
| `/api/cron/dre-ingest` | 0 9 * * 1-5 | DRE data ingest | ✅ |
| `/api/cron/recompute-agent-performance` | 0 4 * * * | Agent perf | ✅ |
| `/api/cron/health-check` | 0 * * * * | Hourly health | ✅ |
| `/api/cron/update-partner-tiers` | 0 3 * * * | Partner tiers | ✅ |
| `/api/alerts/push` | 15 8 * * 1-5 | Push alerts | ✅ (bug fixed) |
| `/api/automation/revenue-loop` | 0 7,13,19 * * * | Revenue loop | ✅ |
| `/api/buyers/score` | 15 6 * * 1-5 | Buyer scoring | ✅ |
| `/api/offmarket-leads/score` | 0 7 * * 1-5 | Lead scoring | ✅ |
| `/api/offmarket-leads/batch-eval` | 30 7 * * 1-5 | Batch evaluation | ✅ |
| `/api/contact-enrichment/run` | 0 7 * * 1-5 | Enrichment | ✅ |
| `/api/reporting/daily` | 30 8 * * 1-5 | Daily report | ✅ |
| `/api/market-data/refresh` | 0 3 * * 1 | Market data | ✅ |
| Other 21 crons | Various | Various | ✅ (all confirmed) |

**IMPORTANT**: ALL 41 crons have route.ts files confirmed (revenue-activation sprint). Most are NOT actively producing data due to:
- Empty data (outreach_queue unprocessed)
- External API keys not configured
- n8n not deployed

---

## Sofia Routes

| Route | Purpose | Auth | Status |
|-------|---------|------|--------|
| `POST /api/sofia/chat` | Chat with Sofia | Session | ✅ Live |
| `POST /api/sofia/whatsapp` | WhatsApp integration | Token | ⚠️ Inactive (WHATSAPP_ACTIVE=false) |
| `GET /api/sofia/history` | Conversation history | Session | ✅ Live |
| `POST /api/sofia/memory` | Memory persistence | Internal | ✅ Live |
| `GET /api/sofia/status` | Sofia health | Public | ✅ Live |

---

## WhatsApp Routes

| Route | Purpose | Status |
|-------|---------|--------|
| `GET /api/whatsapp/webhook` | Meta verification | ✅ Fixed (token guard) |
| `POST /api/whatsapp/webhook` | Receive messages | ⚠️ Inactive (WHATSAPP_ACTIVE=false) |

---

## Routes With Known Bugs (Historical)

| Route | Bug | Status |
|-------|-----|--------|
| `GET /api/properties/public` | Wrong columns (title/zone → nome/zona) | ✅ Fixed 1760efe |
| `GET /api/properties` | Wrong columns in two try-blocks | ✅ Fixed 1760efe |
| `GET /api/whatsapp/webhook` | timingSafeEqual crash on missing token | ✅ Fixed 1760efe |
| `GET/POST /api/alerts/push` | RPC lead_ids → lead_id | ✅ Fixed 472a95e |

---

## Routes That Return 500 (Missing Tables)

Based on DB state (partners/sellers/buyers tables may not exist):

| Route | Issue | Priority |
|-------|-------|---------|
| `/api/partners/*` | partners table may not exist | MEDIUM |
| Routes touching campanhas | campanhas table state unclear | LOW |

---

## API Security Assessment

| Control | Implementation | Coverage |
|---------|---------------|---------|
| Auth (NextAuth session) | `/api/sofia/*`, `/api/contacts/*`, `/api/deals/*` | High |
| Auth (Bearer token) | Portal API routes | High |
| Auth (CRON_SECRET) | All cron routes | High |
| Rate limiting (Upstash Redis) | `/api/auth/send`, `/api/auth/verify`, `/api/avm` | Medium |
| Input validation (Zod) | Key routes | Medium |
| timingSafeEqual | WhatsApp webhook | ✅ Fixed |
| RLS (DB level) | All Supabase tables | High |

---

*Evidence: Get-ChildItem app/api -Recurse route.ts (542 files) | vercel.json (41 crons) | revenue-activation reports | 2026-06-25*
