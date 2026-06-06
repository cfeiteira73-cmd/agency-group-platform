# MASTER SYSTEM STATE
Agency Group | Final Maximum Reality Program | 2026-06-06
Generated from: live database, file scan, API tests, code audit

---

## EVIDENCE SOURCES
- Live Supabase REST API queries (7 tables, full dataset)
- Filesystem scan: 1,996 TypeScript files
- API endpoint tests (agencygroup.pt)
- vercel.json config parse
- .env.local audit
- ts-errors.txt (447 errors, 52 files, dated 2026-05-09)
- CRM import log (2026-06-06)

---

## 1. WEBSITE

| Item | State | Evidence |
|------|-------|----------|
| agencygroup.pt | LIVE | HTTP 200, 310,678 bytes |
| Response time | ~400ms | Observed |
| Languages | 6 (PT/EN/FR/DE/ZH/AR) | app/[locale] dirs |
| Pages | 153 (TSX) | find app -name page.tsx |
| Blog | ~52 articles | Supabase + filesystem |
| SSL | Active | HTTPS 200 |

---

## 2. FRONTEND

| Item | State | Evidence |
|------|-------|----------|
| Framework | Next.js 16.2.1 | package.json |
| TypeScript | v5.x strict | package.json |
| TS files | 1,996 | find scan |
| TS errors (last build) | 447 in 52 files | ts-errors.txt 2026-05-09 |
| Public pages | Functional | Manual test |
| Portal | Protected (403 anon) | API tests |
| Blog | Live | Routes confirmed |
| Search | Functional | /api/search route exists |
| Maps | Leaflet configured | Component scan |
| PWA | Configured | manifest.json |

---

## 3. BACKEND

| Item | State | Evidence |
|------|-------|----------|
| API routes | 542 | find app/api -name route.ts |
| Auth | NextAuth + magic link | app/api/auth routes |
| Rate limiting | Upstash Redis | middleware.ts + .env.local |
| Bot protection | UA blacklist | middleware.ts lines 34-47 |
| CSRF protection | HMAC tokens | middleware.ts |
| Cron jobs | 41 | vercel.json |
| Workers | /api/workers route | code |
| Webhooks | Stripe, WhatsApp | routes exist |

**Cron frequency breakdown:**
- Every 5 min: 5 (self-heal, anomaly, worker, detect-incidents, sre)
- Every 10 min: 1 (runtime-recovery)
- Every 15 min: 2 (replay-dlq)
- Every 30 min: 2 (refresh-graph-views)
- Hourly: 3 (health-check, capture-drift, kpi-snapshot)
- Daily: 18
- Weekly: 3

---

## 4. DATABASE (Supabase — isbfiofwpxqqpgxoftph)

| Table | Count | Status |
|-------|-------|--------|
| capital_profiles | 7,342 | POPULATED |
| properties | 55 | POPULATED |
| contacts | 28 | MINIMAL (12 non-test) |
| deals | 8 | MINIMAL |
| matches | 17 | MINIMAL |
| priority_items | 23 | MINIMAL |
| learning_events | 14 | MINIMAL |
| deal_packs | 2 | MINIMAL |
| property_collections | 0 | EMPTY |
| sofia_conversations | 0 | EMPTY |
| investidores | 0 | EMPTY |
| reality_monitor_snapshots | 404 | TABLE MISSING |
| asel_defense_runs | 404 | TABLE MISSING |
| ios_runtime_audits | 404 | TABLE MISSING |
| campanhas | 404 | TABLE MISSING |
| blog_articles | 404 | TABLE MISSING |
| investors | 404 | TABLE MISSING |

Migrations applied: 278 files tracked  
Migrations NOT applied: W54-W58 tables (reality_monitor_snapshots, asel_defense_runs, etc.)

---

## 5. CRM (capital_profiles)

| Metric | Value | Evidence |
|--------|-------|----------|
| Total contacts | 7,342 | REST API count |
| Have LinkedIn | 7,342 (100%) | Full scan |
| Have email | 67 (0.9%) | Full scan |
| Have no contact at all | 0 (0%) | All have LinkedIn |
| total_score > 0 | 0 (0%) | CRITICAL — all scores = 0 |
| Tier A+ | 73 | REST query |
| Tier A | 1,571 | REST query |
| Tier B | 2,090 | REST query |
| Tier C | 3,089 | REST query |
| Tier D | 519 | REST query |
| Top country | US (2,981 = 40.6%) | REST query |
| country_iso truncated | YES — max 10 chars | "United Sta" observed |

**Top personas (sample 1,000):**
- FAMILY_OFFICE: 790
- REAL_ESTATE_FUND: 101
- INVESTOR: 59
- WEALTH_MANAGER: 44
- CONNECTOR: 6

**Pipelines (sample 1,000):**
- ULTRA_CAPITAL: 935
- BUYERS: 59
- CONNECTORS: 6

---

## 6. SOFIA AI

| Item | State | Evidence |
|------|-------|----------|
| Code exists | YES | app/api/sofia/ |
| Routes | 5 (chat, os, script, session, speak) | ls |
| Conversations in DB | 0 | sofia_conversations = 0 |
| WhatsApp channel | Configured, NOT active | .env.local WHATSAPP_ACTIVE=false |
| Web channel | Functional | Route exists |
| HeyGen video | Configured | HEYGEN_API_KEY set |

---

## 7. SECURITY

| Item | State | Evidence |
|------|-------|----------|
| Rate limiting | Upstash Redis | middleware.ts + env |
| Auth system | Magic link + NextAuth | Routes |
| Bot protection | UA blacklist | middleware.ts |
| HMAC verification | Edge-compatible | middleware.ts |
| Sentry | Configured | sentry.*.config.ts |
| HTTPS | Active | Website test |
| Portal protection | 403 for anon | API tests |
| SIEM | NOT configured | No Datadog/Sentinel |
| PagerDuty/SOC | NOT configured | No evidence |
| SOC2/ISO27001 | NOT certified | No evidence |
| Backup | PITR (Supabase) | Infrastructure |
| DR tested | NOT tested | CHAOS_TESTING=false |

---

## 8. AUTOMATION

| Item | State | Evidence |
|------|-------|----------|
| Vercel crons | 41 defined | vercel.json |
| Cron execution | UNKNOWN — no logs visible | Cannot verify without Vercel access |
| n8n workflows | 12 JSON files | n8n-workflows/ |
| n8n deployment | Docker/Railway (NOT production) | docker-compose.yml |
| n8n cloud | Trial expired | MEMORY.md |
| Resend (email) | Configured | .env.local |
| WhatsApp | Configured, INACTIVE | WHATSAPP_ACTIVE not true |

---

## 9. CAPITAL PROFILES

| Item | State | Evidence |
|------|-------|----------|
| Table created | YES | capital_profiles 200 OK |
| Data imported | 7,342 | REST count |
| Scores populated | NO — all zero | Full scan |
| Email contacts | 67 (0.9%) | Full scan |
| LinkedIn profiles | 7,342 (100%) | Full scan |

---

## 10. INTEGRATIONS

| Integration | Status | Evidence |
|-------------|--------|----------|
| Anthropic (Claude) | ACTIVE | ANTHROPIC_API_KEY set |
| Resend (email) | ACTIVE | RESEND_API_KEY set |
| Supabase | ACTIVE | Confirmed |
| Sentry | CONFIGURED | SENTRY_AUTH_TOKEN set |
| Stripe | CONFIGURED (TEST) | STRIPE_SECRET_KEY set |
| HeyGen | CONFIGURED | HEYGEN_API_KEY set |
| WhatsApp | CONFIGURED | Token set, INACTIVE |
| Upstash Redis | CONFIGURED | URL set |
| Google Maps | CONFIGURED | Key in env |
| Casafari | CONFIGURED | Key set, NOT PAID |
| Idealista | CONFIGURED | Key set, NOT PAID |
| n8n | LOCAL ONLY | Docker, not cloud |
| Vercel | ACTIVE | Deployed |
| GitHub | ACTIVE | Repo live |
| VAPID/Push | CONFIGURED | Keys set |

---

## 11. INVENTORY (Properties)

| Item | Value | Evidence |
|------|-------|----------|
| Properties in DB | 55 | REST API |
| Price range | €3,200 – €6,500,000 | Query |
| Zones | Lisboa, Cascais, Algarve, Comporta, Sintra | Query |
| Status | All "active" | Query |
| Verified real listings | UNKNOWN — no source URL | Cannot confirm vs seeded data |
| Off-market leads | 0 visible | offmarket_leads not tested |

---

## 12. OPERATIONS

| Item | State | Evidence |
|------|-------|----------|
| Active users | UNKNOWN | No analytics visible |
| Daily logins | UNKNOWN | No Vercel analytics access |
| SOC monitoring | Code only | No human operator confirmed |
| Daily brief cron | Configured | vercel.json |
| Revenue | €0 | Stripe TEST + 0 transactions |
