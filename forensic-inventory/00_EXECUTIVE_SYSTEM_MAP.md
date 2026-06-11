# 00 — EXECUTIVE SYSTEM MAP
**Agency Group | Nano Detail Forensic Inventory | 2026-06-11**

---

## WHAT IS AGENCY GROUP?

Agency Group is a **technology-first luxury real estate agency** operating under AMI licence 22506 in Portugal, Spain, Madeira, and the Azores. It is not a software product. It is a real estate brokerage that has built institutional-grade technology infrastructure to acquire, match, and close high-value property transactions (€100K–€100M).

**Core value proposition**: Access to 7,342 pre-qualified institutional buyers (Family Offices, Wealth Managers, Funds, HNWIs) across 60+ countries, matched algorithmically to premium properties via AI and automated outreach.

---

## BUSINESS MODEL

| Dimension | Detail |
|-----------|--------|
| Revenue model | Commission-based: 5% of transaction value |
| Payment terms | 50% at CPCV + 50% at Escritura |
| Target segment | €100K–€100M (core: €500K–€3M) |
| Geographies | Portugal, Spain, Madeira, Azores |
| Primary buyers | North Americans 16% · French 13% · British 9% · Chinese 8% · Brazilians 6% · Germans 5% · Middle East |
| AMI licence | 22506 (Portugal) |
| Market context | €3,076/m² median 2026 · +17.6% YoY · 169,812 transactions · 210-day avg cycle |
| Revenue per deal | €25K (€500K deal) → €150K (€3M deal) → €500K+ (€10M deal) |

---

## OPERATING MODEL

```
SUPPLY SIDE                    TECHNOLOGY LAYER                DEMAND SIDE
──────────────                 ────────────────                ────────────
Developer mandates    ──→      Properties DB (55)    ──→      7,342 institutional
Co-agency agreements           AVM pricing engine              buyer contacts
Verified exclusives            Matching algorithm              (7 buyer types)
Off-market signals             Deal packs                      (60+ countries)
                               Sofia AI qualification
                                                    ──→      Commission earned
```

---

## TECHNOLOGY MODEL

| Layer | Technology | Status |
|-------|-----------|--------|
| Frontend | Next.js 16.2.1 + React 19.2.4 | Live |
| Backend | 542 API routes (TypeScript strict) | Live |
| Database | Supabase PostgreSQL (Frankfurt) | Live |
| AI | Anthropic Claude (@anthropic-ai/sdk ^0.80.0) | Live |
| Auth | NextAuth v5 + magic links + 2FA | Live |
| Email | Resend (configured) | Live (not deployed via n8n) |
| WhatsApp | Meta Business API | Configured, inactive |
| Video | HeyGen AI avatar | Configured |
| Payments | Stripe (checkout + webhooks) | Configured |
| Caching | Upstash Redis (rate limiting) | Live |
| Monitoring | Sentry + OpenTelemetry | Configured |
| CI/CD | Vercel (cdg1 Paris region) | Live |
| Automation | n8n (11 workflows) | Local only — not deployed |

---

## CRM MODEL

| Object | Count | Quality |
|--------|-------|---------|
| capital_profiles | 7,342 | Scored, country-tagged |
| contacts (portal CRM) | 28 | Mixed (demo + 1 real) |
| outreach_queue | 3,120 | Pending outreach |
| leads | 10,665 | Scraped, uncontacted |
| With email | 67 | Contactable today |
| A+ score (≥80) | 116 | Highest priority |
| deals | 8 | Demo data |
| activities | 8 | Demo data |

---

## LEAD MODEL

| Source | Count | Status |
|--------|-------|--------|
| capital_profiles (institutional) | 7,342 | Imported, scored |
| leads (scraped) | 10,665 | Unprocessed |
| outreach_queue | 3,120 | Queue pending n8n |
| offmarket_leads | 14 | Active pipeline |
| Top markets | US(~3,010), GB(~882), FR(~748), AE(~504) | From capital_profiles |

---

## INVENTORY MODEL

| Source | Count | Verification |
|--------|-------|-------------|
| DB properties | 55 | Unverified (seeded) |
| Verified mandates | 0 | None confirmed |
| Off-market leads | 14 | Under evaluation |
| Co-agency agreements | 0 | Not yet signed |

---

## CAPITAL MODEL

| Profile Type | Count | Description |
|-------------|-------|-------------|
| FAMILY_OFFICE | 1,701 | Primary HNW target |
| WEALTH_MANAGER | 1,470 | Intermediary/advisor |
| FUND | ~900 | Institutional buyer |
| PRIVATE_EQUITY | ~650 | Opportunistic |
| VENTURE | ~400 | Growth capital |
| INTRODUCER | ~800 | Distribution partner |
| Other | ~421 | Mixed |
| **Total** | **7,342** | |

---

## PARTNER MODEL

| Type | Status |
|------|--------|
| Co-agency developers | 0 signed |
| Broker partners | 0 signed |
| Referral introducers | 0 active |
| Partner system (DB table) | MISSING — table doesn't exist |

---

## AI MODEL

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Sofia chat agent | Claude claude-sonnet-4-6 | Buyer qualification |
| AVM engine | Claude + data | Property valuation |
| CRM agentic | Claude (8-tool loop) | Contact research |
| Matching engine | Algorithmic + ML | Buyer-property matching |
| Deal pack generator | Claude | Offer documents |
| Scoring pipeline | ML (TypeScript) | Lead/property scoring |

---

## AUTOMATION MODEL

| Layer | Components | Status |
|-------|-----------|--------|
| Vercel crons | 41 scheduled jobs | 1 confirmed running |
| n8n workflows | 11 workflows defined | Local only, not deployed |
| Email sequences | Resend configured | 0 sequences active |
| WhatsApp outreach | API configured | Inactive |
| Lead scoring | Cron every weekday 06:15 | Status unknown |
| Revenue loop | Cron 07:00/13:00/19:00 | Status unknown |

---

## REVENUE MODEL

| Scenario | Deals/Year | Avg Value | Commission (5%) | Revenue |
|----------|-----------|-----------|----------------|---------|
| Current | 0 | — | — | €0 |
| Conservative | 3 | €1M | €50K | €150K |
| Target | 6 | €1.5M | €75K | €450K |
| Scale | 15 | €2M | €100K | €1.5M |

---

## VISUAL ARCHITECTURE MAP

```
┌─────────────────────────────────────────────────────────────────┐
│                     AGENCY GROUP PLATFORM                        │
├───────────────────┬─────────────────────┬───────────────────────┤
│   PUBLIC SITE     │     PORTAL          │   CONTROL TOWER        │
│  (agencygroup.pt) │  (auth-gated)       │  (ops dashboard)       │
│                   │                     │                        │
│  ┌─────────────┐  │  ┌───────────────┐  │  ┌─────────────────┐  │
│  │ 55 blog     │  │  │ CRM Dashboard │  │  │ 29 sub-pages    │  │
│  │ articles    │  │  │ Deal Radar    │  │  │ Agents/Events   │  │
│  │ /imoveis    │  │  │ Analytics     │  │  │ Economics/SRE   │  │
│  │ /zonas      │  │  │ Sofia chat    │  │  │ Governance      │  │
│  │ /avm        │  │  │ Properties    │  │  │ Security        │  │
│  └─────────────┘  │  └───────────────┘  │  └─────────────────┘  │
├───────────────────┴─────────────────────┴───────────────────────┤
│                    API LAYER (542 routes)                         │
│                                                                   │
│  /api/properties  /api/contacts  /api/deals  /api/matches        │
│  /api/sofia-agent /api/avm       /api/analytics /api/crm         │
│  /api/automation  /api/cron/*    /api/sre/*  /api/security/*     │
├───────────────────────────────────────────────────────────────────┤
│                   SERVICES LAYER (lib/)                            │
│                                                                    │
│  AI Gateway │ Event Bus │ ML Pipeline │ Capital Engine            │
│  Compliance │ Observability │ Security │ Financial Rails          │
│  SRE/Chaos  │ Workers  │ Validation │ Growth Graph               │
├───────────────────────────────────────────────────────────────────┤
│               DATABASE (Supabase Frankfurt eu-central-1)          │
│                                                                    │
│  contacts(28) │ capital_profiles(7,342) │ properties(55)          │
│  deals(8) │ matches(17) │ kpi_snapshots(48) │ leads(10,665)       │
│  outreach_queue(3,120) │ offmarket_leads(14)                      │
└───────────────────────────────────────────────────────────────────┘
         │                    │                    │
    Vercel Crons         n8n Workflows        External APIs
    (41 defined)         (11 defined,         Anthropic/OpenAI
    (1 confirmed)        local only)          Resend/WhatsApp
                                              Stripe/HeyGen
```

---

*Generated: 2026-06-11 | Evidence: file system scan, Supabase REST API, package.json, vercel.json*
