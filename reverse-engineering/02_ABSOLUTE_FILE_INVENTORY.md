# 02 — ABSOLUTE FILE INVENTORY
**Agency Group | Ultimate Reverse Engineering Audit | 2026-06-14**

---

## TOTALS

| Category | Count |
|----------|-------|
| Total files (including node_modules) | 90,695 |
| Source files (excl. node_modules/.next/.git) | 2,837 |
| TypeScript (.ts) | 1,613 |
| TypeScript React (.tsx) | 390 |
| SQL migrations | 293 |
| Markdown (.md) | 301 |
| JSON configs | 104 |
| Python scripts | 22 |
| HTML files | 20 |
| Image assets | 19 |
| Total lines of code (TS/TSX) | 461,190 |

---

## DIRECTORY MAP WITH BUSINESS IMPACT

### /app — Next.js Pages + API Routes

#### /app/api — 542 routes (BUSINESS CRITICAL LAYER)

| Route Group | Count | Business Impact | Status |
|-------------|-------|-----------------|--------|
| /api/auth/* | ~8 | CRITICAL — Auth gate | Active (38 logins) |
| /api/properties/* | ~12 | HIGH — Inventory display | Fixed, active |
| /api/contacts/* | ~8 | HIGH — CRM operations | Active, 28 rows |
| /api/deals/* | ~10 | HIGH — Deal management | Active, 8 demo rows |
| /api/sofia-agent/* | ~6 | HIGH — AI conversations | Built, 0 uses |
| /api/capital-profiles/* | ~6 | HIGH — Buyer network | Active, 7,342 rows |
| /api/cron/* | ~41 | MEDIUM — Automation | 1/41 confirmed |
| /api/analytics/* | ~24 | MEDIUM — Metrics | Active, 0 real data |
| /api/automation/* | ~17 | HIGH — Revenue engine | Built, 0 real runs |
| /api/matches/* | ~8 | HIGH — Buyer matching | Active, 17 demo rows |
| /api/deal-packs/* | ~6 | HIGH — Deal generation | Active, 2 demo |
| /api/whatsapp/* | ~5 | HIGH — WhatsApp channel | Configured, INACTIVE |
| /api/heygen/* | ~4 | MEDIUM — Video AI | Configured, unused |
| /api/partners/* | ~4 | HIGH — Partner network | BROKEN (table missing) |
| /api/leads/* | ~8 | HIGH — Lead management | Active, 10,665 rows |
| /api/security/* | ~6 | CRITICAL — Security ops | Active |
| /api/compliance/* | ~8 | HIGH — Regulatory | Active |
| /api/sre/* | ~6 | MEDIUM — SRE/monitoring | Active |
| /api/control-tower/* | ~30 | MEDIUM — Ops UI data | Active, 0 real users |
| /api/notifications/* | ~5 | MEDIUM — Push notifs | Configured, 0 sent |
| Other | ~30 | Various | Various |

#### /app/pages — 142 pages

| Section | Count | Purpose | Traffic |
|---------|-------|---------|---------|
| / (homepage) | 1 | Public site root | Unknown |
| /blog/[slug] | 55 | SEO content | Google indexed |
| /imoveis | ~5 | Property listings | Unknown |
| /portal/* | ~10 | Auth-gated portal | 38 logins (Carlos) |
| /dashboard/* | ~10 | Main dashboards | 38 sessions (Carlos) |
| /control-tower/* | ~30 | Ops center | 38 sessions (Carlos) |
| /avm | ~3 | Property valuation | 0 real valuations |
| /agente/[slug] | 2 | Agent profiles | 0 real agents |
| /auth/* | ~4 | Login pages | 38 logins |
| /faq | 1 | FAQ | Unknown |
| /juridico | ~3 | Legal AI | Unknown |
| Other | ~18 | Various | Unknown |

---

### /lib — 910 Service Files (FULL BREAKDOWN)

| Module | Files | Business Relevance | Production Use |
|--------|-------|-------------------|----------------|
| runtime/ | 75 | Infrastructure | Theoretical |
| security/ | 46 | OWASP compliance | Active (auth/rate limit) |
| property-ai/ | 44 | AVM + scoring | 0 real valuations |
| compliance/ | 32 | GDPR/SOC2/AML | Active (compliance checks) |
| observability/ | 31 | Monitoring | Active (Sentry configured) |
| events/ | 30 | Event streaming | Configured, not streaming |
| ml/ | 27 | Machine learning | 0 real training data |
| sre/ | 26 | Site reliability | Active (health checks) |
| agents/ | ~20 | AI agents | 0 invocations |
| ai/ | ~18 | AI gateway | Active (Sofia API calls) |
| capital/ | ~15 | Capital network | Active (7,342 contacts) |
| economics/ | ~15 | Financial models | 0 real calculations |
| growth/ | ~15 | Growth analytics | 0 real growth data |
| market/ | ~15 | Market intelligence | Configured |
| investors/ | ~18 | Investor relations | Configured |
| commercial/ | ~12 | Partner/commercial | BROKEN (partners table missing) |
| legal/ | ~12 | Legal AI | Configured |
| scoring/ | ~15 | Lead/property scoring | Active (7,342 scored) |
| valuation/ | ~10 | AVM engine | Configured, 0 real runs |
| matching/ | ~10 | Buyer matching | 0 real matches |
| reporting/ | ~10 | Reports generation | 0 real reports |
| notifications/ | ~8 | Push/email notifs | 0 real notifications |
| auth/ | ~8 | Auth layer | Active (magic links) |
| db/ | ~6 | DB layer | Active |
| Other | ~100 | Various | Various |

---

### /supabase/migrations — 278 SQL files

| Migration Range | Count | Applied | Key Content |
|----------------|-------|---------|-------------|
| 001–050 | 50 | Yes | Initial schema |
| 051–100 | 50 | Yes | Properties, contacts, deals |
| 101–150 | 50 | Yes | Capital profiles, leads |
| 151–200 | 50 | Yes | Security, compliance tables |
| 201–250 | 50 | Yes | ML, analytics, events |
| 251–278 | 28 | Yes | Latest: W54-W58 (5 table fixes) |

---

### /n8n-workflows — 11 workflow files (ALL LOCAL ONLY)

| File | Purpose | Revenue Impact | Status |
|------|---------|---------------|--------|
| lead-inbound.json | New lead intake | HIGH | Local only |
| dormant-reactivation.json | Dormant contacts | HIGH | Local only |
| visit-coordination.json | Property visits | HIGH | Local only |
| cpcv-followup.json | Post-CPCV | CRITICAL | Local only |
| vendor-report.json | Vendor updates | MEDIUM | Local only |
| investor-alert.json | Investor alerts | HIGH | Local only |
| capital-outreach.json | Capital campaigns | HIGH | Local only |
| developer-pipeline.json | Developer CRM | HIGH | Local only |
| kyc-verification.json | KYC process | HIGH | Local only |
| analytics-digest.json | Weekly KPI email | LOW | Local only |
| whatsapp-handoff.json | Sofia → human | MEDIUM | Local only |

**STATUS: 0 of 11 deployed. All workflows exist locally only.**

---

### /__tests__ — 91 test files (2,222 tests)

| Category | Files | Tests | Pass Rate |
|----------|-------|-------|-----------|
| Unit tests | ~60 | ~1,500 | 99.5% |
| Integration tests | ~20 | ~500 | 99.5% |
| Security tests | ~11 | ~222 | 100% |

**Last run: 2026-06-14 — 2,222/2,222 passing**

---

### Config Files

| File | Purpose | Status |
|------|---------|--------|
| package.json | 27 prod + 13 dev deps | Current |
| vercel.json | 41 crons + deployment | Active |
| tsconfig.json | TypeScript strict | 0 errors |
| next.config.ts | Framework config | Active |
| tailwind.config.ts | Design system | Active |
| middleware.ts | Route auth guard | Active |
| .env.local | 76 env vars | Configured |
| vitest.config.ts | Test config | 2,222/2,222 |
| playwright.config.ts | E2E config | 0 E2E runs |

---

## CRITICALITY MATRIX

```
TIER 1 — CRITICAL (system dies without):
  lib/supabase.ts         — DB connection
  lib/auth/serviceAuth.ts — Service auth
  middleware.ts           — Route guard
  app/api/auth/send+verify — Magic links

TIER 2 — HIGH (revenue depends on):
  app/api/sofia-agent/*   — AI sales agent
  app/api/capital-profiles/* — Buyer network
  lib/scoring/*           — Contact scoring
  app/api/properties/*    — Property display

TIER 3 — MEDIUM (operations):
  app/api/analytics/*     — Metrics
  app/api/automation/*    — Revenue loops
  lib/compliance/*        — Regulatory
  app/api/cron/*          — Scheduled jobs

TIER 4 — LOW (nice to have):
  lib/events/kafkaClient  — Event streaming
  lib/sre/chaosEngineering — Chaos tests
  lib/economics/macro*    — Macro models
  control-tower (30 pages) — Ops dashboards

TIER 5 — ORPHANED (never used):
  lib/runtime/ (75 files) — Framework infra
  lib/ml/training/*       — No training data
  lib/expansion/*         — Premature
  lib/financial-rails/*   — No transactions
```

---

*Evidence: PowerShell dir scan, forensic-inventory/01_COMPLETE_FILE_INVENTORY.md, Supabase REST API*
