# 01 — COMPLETE SYSTEM REVERSE ENGINEERING
**Agency Group | Ultimate Reverse Engineering Audit | 2026-06-14**

---

## WHAT IS AGENCY GROUP — EXACT DEFINITION

Agency Group is **a one-person luxury real estate brokerage in Portugal** (AMI 22506) that has built and deployed a complete institutional-grade operating system, including:
- 461,190 lines of TypeScript code
- 910 library service files across 115 modules
- 542 API routes
- 142 web pages
- 7,342 institutional buyer contacts

It has generated **€0 in revenue** since inception.

---

## BUSINESS ARCHITECTURE

```
BUSINESS MODEL
══════════════
Commission brokerage: 5% of transaction value
Payment: 50% CPCV + 50% Escritura
Segments: €100K–€100M | Core €500K–€3M
AMI: 22506 | Portugal + Spain + Madeira + Azores

SUPPLY → MATCH → CLOSE
  ↓         ↓       ↓
Properties Buyers Commission
```

### Revenue Chain
```
Source property mandate
       ↓
Score + AVM property
       ↓
Match to institutional buyer (7,342 available)
       ↓
Sofia qualifies buyer
       ↓
Deal pack generated
       ↓
Offer made / CPCV signed
       ↓
Commission earned (5%)
```

---

## TECHNOLOGY ARCHITECTURE

```
┌─────────────────────────────────────────────────────┐
│              PRESENTATION LAYER                      │
│  Next.js 16.2.1 + React 19.2.4 + Tailwind CSS v4   │
│  142 pages | 6 languages | GSAP animations          │
├─────────────────────────────────────────────────────┤
│                 API LAYER                            │
│         542 routes (TypeScript strict, 0 errors)    │
│  Auth | Properties | CRM | Sofia | Analytics | SRE  │
├─────────────────────────────────────────────────────┤
│              SERVICES LAYER (lib/)                   │
│         910 files across 115 modules                 │
│  AI | Compliance | Events | ML | Security | SRE     │
│  Runtime | Observability | Capital | Economics       │
├─────────────────────────────────────────────────────┤
│              DATA LAYER                              │
│         Supabase PostgreSQL (Frankfurt)              │
│  18 tables | 278 migrations | pgvector embeddings   │
├─────────────────────────────────────────────────────┤
│              INFRASTRUCTURE                          │
│  Vercel (cdg1 Paris) | Upstash Redis | Supabase    │
│  Sentry | Anthropic API | Resend | Stripe           │
└─────────────────────────────────────────────────────┘
```

---

## CRM ARCHITECTURE

```
DUAL CRM SYSTEM
═══════════════

1. CAPITAL NETWORK (institutional)
   capital_profiles: 7,342 contacts
   Scored (0-100) | Country-tagged (60+ countries)
   Profile types: Family Office, Wealth Manager, Fund, PE, VC
   Quality: 116 A+ (≥80) | 67 with email
   Enrichment: 0.9% email rate — 99.1% no email

2. PORTAL CRM (operational)
   contacts: 28 records (demo + 1 real)
   deals: 8 (ALL demo/seeded)
   activities: 8 (ALL demo)
   matches: 17 (ALL demo)
   
   REAL USAGE: 1 external contact (ISABELGRILO@GMAIL.COM, 2026-06-03)
```

---

## LEAD ARCHITECTURE

```
LEAD SOURCES
  ↓
capital_profiles (7,342) ──→ HIGH QUALITY institutional
leads (10,665) ──────────→ Scraped, unprocessed
outreach_queue (3,120) ──→ Pending n8n sequences
offmarket_leads (14) ────→ Active evaluation
contacts CRM (28) ───────→ Portal CRM (mostly demo)
  ↓
TOTAL: ~21,169 records
CONTACTED: 0
```

---

## CAPITAL ARCHITECTURE

```
INSTITUTIONAL CAPITAL NETWORK
  Family Offices: ~1,701  → Direct HNW capital (€50M–€500M AUM)
  Wealth Managers: ~1,470 → Intermediary capital
  Funds: ~900             → Institutional tickets
  PE: ~650                → Opportunistic
  Introducers: ~800       → Referral network
  VC: ~400                → Growth capital
  Other: ~421
  ═══════════
  TOTAL: 7,342
  
  Geography: US(3,010) GB(882) FR(748) AE(504) DE(380) CH(280)
  
  Theoretical deployment capacity: $500B–$2T AUM represented
  Active transactions: 0
```

---

## INVENTORY ARCHITECTURE

```
PROPERTY SOURCES
  DB properties: 55 (seeded, unverified)
  Verified mandates: 0
  Off-market leads: 14 (evaluating)
  Co-agency agreements: 0

PROPERTY TABLE SCHEMA (Portuguese columns):
  nome, zona, bairro, tipo, preco, area, quartos,
  casas_banho, energia, descricao, features,
  images, lat, lng, matterport_url, embedding

AVM ENGINE:
  Input: Location + features + market data
  Output: Valuation ± 4.2%
  Cron: Daily 07:00 UTC
  Real valuations: 0 (no real properties)
```

---

## SOFIA ARCHITECTURE

```
SOFIA AI AGENT
  Model: Anthropic Claude (claude-sonnet-4-6)
  SDK: @anthropic-ai/sdk ^0.80.0
  Mode: Multi-turn conversation + 8-tool agentic loop
  
  CHANNELS:
    Web chat widget → /api/sofia-agent/chat ✅ (built, 0 conversations)
    WhatsApp → /api/whatsapp/* (configured, INACTIVE)
    Video (HeyGen) → /api/heygen/* (configured, never used)
    Voice/TTS → /api/tts (configured, never used)
  
  TOOLS (8 in agentic mode):
    search_contacts | create_contact | update_contact
    search_properties | create_match | generate_deal_pack
    send_notification | log_activity
  
  REALITY: 0 conversations ever. 0 turns. 0 users.
  
  AI AGENTS (lib/agents/implementations/): 16 specialized agents
    leadQualificationAgent | dealClosingAgent | followUpAgent
    forecastingAgent | pricingStrategyAgent | revenueLeakAgent
    kpiIntelligenceAgent | conversionOptimizationAgent
    pipelineStallAgent | growthStrategyAgent | riskGovernanceAgent
    systemHealthAgent | dataIntegrityAgent | decisionArbitrationAgent
    agentSupervisor | workflowAutomationAgent
```

---

## REVENUE ARCHITECTURE

```
REVENUE MACHINE (configured, not running)
  
  Step 1: Lead scoring   → /api/automation/lead-score (cron 06:15 Mon-Fri)
  Step 2: Outreach       → n8n sequences (LOCAL ONLY — not deployed)
  Step 3: Qualification  → Sofia chat (0 conversations)
  Step 4: Matching       → /api/automation/match-buyer (0 real matches)
  Step 5: Deal pack      → /api/deal-packs/generate (2 packs exist, demo)
  Step 6: Commission     → /api/deal/commission-pl (0 real commissions)
  
  REVENUE LOOP CRON: /api/automation/revenue-loop runs 3x/day
  EFFECT: Unknown (no real deals to process)
```

---

## PARTNER ARCHITECTURE

```
PARTNER SYSTEM
  Status: COMPLETELY NON-FUNCTIONAL
  Reason: database table 'partners' DOES NOT EXIST
  
  Code exists:
    Routes: /api/partners/performance ← 404 (table missing)
    Routes: /api/distribution/invite  ← broken
    Routes: /api/commercial/partner-tiers ← broken
    Files: lib/commercial/partnerTiering.ts
    Files: lib/commercial/revenueAttribution.ts
    
  Fix: 5 minutes — CREATE TABLE partners (...)
```

---

## AGENT (REAL ESTATE AGENT) ARCHITECTURE

```
AGENT SYSTEM
  Active agents: 0
  Agent profiles: 0
  agent_performance table: 404 (doesn't exist)
  
  Pages exist: /agente/[slug] (template ready)
  Routes exist: /api/agent/weekly-report etc.
  Portal leaderboard: /portal/leaderboard (built, empty)
  
  Fix: CREATE TABLE agent_performance + hire first agent
```

---

## SECURITY ARCHITECTURE

```
SECURITY LAYERS (OWASP 87/100)
  
  Auth: Magic links (SHA-256, one-time, 15-min TTL)
  2FA: TOTP (otpauth ^9.3.6)
  Rate limiting: Upstash Redis on all auth routes
  RLS: Supabase row-level security on all tables
  Zero trust: lib/security/zeroTrustEngine.ts
  SIEM: lib/security/siemPipeline.ts
  Compliance: GDPR + SOC2 + AML/KYC + MiFID
  Secrets: 76 env vars in Vercel (never in code)
  
  Real threat events detected: 0
  Real security incidents: 0
  Real SIEM alerts: 0 (nobody is using the system)
```

---

## OPERATIONS ARCHITECTURE

```
OPERATIONAL STATUS (2026-06-14)
  
  Real users: 1 (Carlos — geral@agencygroup.pt)
  Real logins: 38 (all Carlos)
  Real conversations: 0
  Real deals: 0
  Real revenue: €0
  
  WHAT'S RUNNING:
    kpi-snapshot cron: ✅ (50 runs since 2026-04-24)
    Vercel CDN/hosting: ✅ (site live)
    Auth system: ✅ (38 real logins)
    
  WHAT'S NOT RUNNING:
    40 other crons: status unknown
    n8n automation: LOCAL ONLY
    Email sequences: 0 sent
    WhatsApp: INACTIVE
    AI conversations: 0
```

---

## SYSTEM RELATIONSHIP MAP

```
agencygroup.pt (public site)
     │
     ├── /imoveis → [FIXED] DB properties (55 seeded)
     ├── /blog → 55 SEO articles (live, indexed)
     ├── /avm → Valuation tool (built, 0 real uses)
     ├── Sofia widget → /api/sofia-agent/chat → 0 conversations
     └── Contact forms → /api/contacto → 0 verified leads

Portal (/portal, auth-gated)
     │
     ├── Dashboard → KPI cards (data from kpi_snapshots, demo values)
     ├── Properties → /api/properties [FIXED] → 55 seeded
     ├── CRM → contacts (28, mostly demo)
     └── Analytics → /api/analytics/* (real system, 0 real data)

Supabase (Frankfurt)
     │
     ├── capital_profiles: 7,342 (REAL, scored, tagged)
     ├── leads: 10,665 (REAL, scraped)
     ├── kpi_snapshots: 50 (RUNNING)
     └── Everything else: demo or empty

Vercel (41 crons scheduled)
     └── kpi-snapshot: CONFIRMED ✅
     └── 40 others: scheduled but unverified
```

---

*Evidence: TypeScript compiler (0 errors, exit 0), Supabase REST API (2026-06-14), lib/ scan (910 files), app/ scan (542 routes), vercel.json*
