# MASTER SYSTEM INVENTORY
Agency Group | Section 1 | 2026-06-06
Complete inventory of every component. Evidence-based only.

---

## WEBSITE (PRODUCTION)

| Component | Status | Evidence |
|-----------|--------|----------|
| Domain | agencygroup.pt | HTTPS 200 |
| Response time | 1,000-2,000ms | Live test 2026-06-06 |
| Pages public | ALL 200 OK | 11 pages tested |
| Portal (auth-only) | 403 for anon | Correct behavior |
| Sitemap | HTTP 200 | /sitemap.xml |
| Languages | 6 (PT/EN/FR/DE/ZH/AR) | app/[locale] dirs |
| Blog | Live | HTTP 200 |

---

## FRONTEND

| Metric | Value | Evidence |
|--------|-------|----------|
| Next.js version | 16.2.1 | package.json |
| TypeScript version | 5.x strict | package.json |
| TypeScript errors | 0 | tsc --noEmit 2026-06-06 |
| Total TS files | 1,996 | file scan |
| Public pages | 153 | find app -name page.tsx |
| Component library | AG Design System | components/ |
| PWA | Configured | manifest.json |

---

## BACKEND

| Metric | Value | Evidence |
|--------|-------|----------|
| Total API routes | 542 | find app/api -name route.ts |
| Routes using DB | 213 (39%) | code scan |
| Routes using AI | 40 (7%) | code scan |
| Routes using lib functions | 259 (48%) | code scan |
| Routes unknown/other | 30 (6%) | code scan |
| Auth middleware | Active | middleware.ts |
| Rate limiting | Upstash Redis | .env.local |
| Bot protection | 14 UA patterns | middleware.ts |
| HMAC verification | Edge-compatible | middleware.ts |

---

## DATABASE (Supabase isbfiofwpxqqpgxoftph)

### Tables with Data
| Table | Count | Data Type |
|-------|-------|-----------|
| capital_profiles | 7,342 | CRM contacts (real LinkedIn profiles) |
| properties | 55 | Property listings (origin unconfirmed) |
| contacts | 28 | Operational CRM (12 real, 16 test) |
| matches | 17 | Buyer-property matches |
| priority_items | 23 | Priority queue items |
| kpi_snapshots | 43 | Daily cron snapshots (running!) |
| learning_events | 14 | System events |
| offmarket_leads | 14 | ALL TEST DATA |
| activities | 8 | Activity log |
| deals | 8 | Demo/seeded deals |
| signals | 6 | Market signals |
| deal_packs | 2 | Generated deal packs |
| market_data | 10 | Market data entries |
| used_magic_tokens | 37 | Login tokens (real usage!) |

### Tables Existing but Empty (0 records)
| Table | Purpose |
|-------|---------|
| reality_monitor_snapshots | Reality monitoring (M149) |
| system_health_dashboards | System health (M149) |
| acquisition_sources | Off-market sources (M150) |
| acquisition_opportunities | Off-market opportunities (M150) |
| sofia_conversation_turns | Sofia conversations (M151) |
| sofia_escalations | Escalations (M151) |
| asset_opportunities | Capital matching assets (M151) |
| capital_matches | Capital matches (M151) |
| capital_matching_reports | Match reports (M151) |
| all W52-W58 security tables | 18 empty security tables |
| property_collections | User collections |
| sofia_conversations | (pre-M151 table) |
| profiles | User profiles |
| tasks | Task queue |
| notifications | Push notifications |
| audit_log | Audit trail |
| investidores | Investor table |
| visits | Visit tracking |

### Tables Missing (404)
| Table | Status |
|-------|--------|
| campanhas | 404 — route references but table missing |
| partners | 404 |
| blog_posts | 404 |
| sellers | 404 |
| buyers | 404 |
| match_reports | 404 |
| investment_portfolios | 404 |
| property_valuations | 404 |
| user_roles | 404 |

### Infrastructure
| Component | Value |
|-----------|-------|
| Host | Frankfurt (eu-central-1) |
| PITR | Active |
| Migrations | 278 files |
| Org | rruseifivqnzrgbqardm (cfeiteira73@gmail.com) |

---

## CRM

| Metric | Value |
|--------|-------|
| Total contacts | 7,342 |
| Has email | 67 (0.9%) |
| LinkedIn only | 7,275 (99.1%) |
| A+ tier | 73 |
| A tier | 1,571 |
| B tier | 2,090 |
| C tier | 3,089 |
| D tier | 519 |
| Score >80 | 111 |
| Score >50 | 3,493 |
| Top persona | FAMILY_OFFICE (1,701) |
| Top country | US (3,010 = 41%) |
| Pipeline ULTRA_CAPITAL | 4,414 |
| Owner SOFIA | 5,179 |
| Owner CARLOS | 1,619 (+ 25 'Carlos' = case bug) |

---

## SOFIA AI

| Component | Status |
|-----------|--------|
| Code exists | 5 routes (chat/os/script/session/speak) |
| Conversations | 0 (sofia_conversation_turns = 0) |
| WhatsApp | Configured, INACTIVE |
| HeyGen | Configured |
| Claude integration | Active (ANTHROPIC_API_KEY) |
| Email sequences | 0 running |

---

## SECURITY

| Component | Status |
|-----------|--------|
| Rate limiting | Upstash Redis (active) |
| Auth | Magic link one-time use |
| HMAC | Web Crypto API |
| Bot protection | 14 patterns |
| Sentry | Configured |
| PITR | Active |
| W54-W58 tables | Created (0 data yet) |
| External SIEM | None |
| DR tested | Never |

---

## AUTOMATION

| Component | Status |
|-----------|--------|
| Vercel crons defined | 41 |
| Crons executing | CONFIRMED (kpi_snapshots = 43 daily entries) |
| n8n workflows | 12 (LOCAL ONLY) |
| n8n cloud | Not deployed |
| Email sequences | 0 running |

---

## INTEGRATIONS

| Integration | Status |
|-------------|--------|
| Anthropic (Claude) | ACTIVE |
| Resend | CONFIGURED |
| Supabase | ACTIVE |
| Sentry | CONFIGURED |
| Stripe | CONFIGURED (TEST) |
| HeyGen | CONFIGURED |
| WhatsApp | CONFIGURED, INACTIVE |
| Upstash Redis | ACTIVE |
| Google Maps | CONFIGURED |
| Casafari | CONFIGURED, NOT PAID |
| Idealista | CONFIGURED, NOT PAID |
| n8n | LOCAL DOCKER ONLY |
| Vercel | ACTIVE (production) |
| GitHub | ACTIVE (commit d4ca188) |

---

## CAPITAL NETWORK

| Segment | Count |
|---------|-------|
| FAMILY_OFFICE | 1,701 |
| WEALTH_MANAGER | 1,470 |
| REAL_ESTATE_FUND | 1,025 |
| INVESTOR | 997 |
| CONNECTOR | 816 |
| BROKER | 452 |
| ARCHITECT | 295 |
| PRIVATE_CLIENT_ADVISOR | 218 |

---

## REVENUE ENGINE

| Stage | Count | Notes |
|-------|-------|-------|
| Deals in DB | 8 | Demo/seeded data |
| Confirmed real deals | 0 | None verified as real |
| Revenue | €0 | Stripe TEST mode |
| CPCV | 0 real | 1 demo ("Khalid CPCV") |

---

## EVIDENCE OF ACTUAL USAGE

| Evidence | Value | Implication |
|----------|-------|-------------|
| used_magic_tokens | 37 | System has been logged into 37 times |
| kpi_snapshots | 43 (daily from June 3) | Crons ARE running in production |
| offmarket_leads | 14 (ALL test) | No real off-market leads |
| activities | 8 | Some activity tracked |
| signals | 6 | Some market signals |
