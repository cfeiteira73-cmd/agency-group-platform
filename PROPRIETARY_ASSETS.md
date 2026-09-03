# AGENCY GROUP — PROPRIETARY ASSETS REGISTER
**Version 1.0 | 2026-09-03**
*Living document. Update after every significant asset creation or change.*

---

## ASSET CLASSIFICATION

Each asset rated on:
- **OWNERSHIP:** Who owns it and how defensible is that ownership?
- **QUALITY:** How good is it today (1–10)?
- **UNIQUENESS:** How hard to replicate (1–10)? 1=commodity, 10=irreplaceable
- **DEFENSIBILITY:** How protected from competition (1–10)?
- **EV CONTRIBUTION:** Estimated contribution to enterprise value path

---

## CATEGORY A — BRAND ASSETS

### A1 — Agency Group Brand + Domain
- **Asset:** agencygroup.pt (domain) + brand identity (AG Design System: gold #D4AF37, navy, typography)
- **Ownership:** Carlos Feiteira, AMI 22506. Domain registered. Design system in codebase.
- **Quality:** 6/10 (solid design system, zero market recognition yet)
- **Uniqueness:** 5/10 (brand is unproven but distinctive visual identity)
- **Defensibility:** 7/10 (AMI license + domain + trademark potential)
- **Evidence:** `globals.css`, AMI card 22506, domain agencygroup.pt live
- **Build priority:** Becomes 9/10 defensibility after first 10 transactions

### A2 — AMI License 22506
- **Asset:** Portuguese real estate license, issued by IMPIC
- **Ownership:** Individual license held by Carlos Feiteira
- **Quality:** 10/10 (legally required to transact; complete and current)
- **Uniqueness:** 7/10 (anyone can get AMI but it takes time + reputation)
- **Defensibility:** 9/10 (legal requirement = natural barrier to instant competition)
- **EV contribution:** Enables €0 → €GCI. Without this, no revenue.

### A3 — Multi-Language Content Moat (6 Languages)
- **Asset:** 55 blog articles in English, Portuguese, French, German, Chinese, Italian
- **Ownership:** Agency Group, original content
- **Quality:** 7/10 (published and indexed; not yet driving significant traffic — UNKNOWN if ranking)
- **Uniqueness:** 8/10 (no Portuguese real estate agent has comparable multilingual content depth)
- **Defensibility:** 7/10 (takes 6–12 months for competitor to replicate at this depth)
- **Evidence:** `/app/blog/` directory, 55 articles confirmed
- **Build priority:** Add 2 articles/month. Prioritize: Chinese (8% buyer market), German (5% market)

---

## CATEGORY B — DATA ASSETS

### B1 — Buyer Intent CRM (18,042 leads)
- **Asset:** 18,042 qualified contacts in Supabase `leads` table, scored, categorized by market/country
- **Ownership:** Agency Group (collected through lead engine)
- **Quality:** 4/10 (volume excellent; enrichment incomplete — 99.1% no email at time of audit)
- **Uniqueness:** 8/10 (this specific scored + segmented dataset does not exist elsewhere)
- **Defensibility:** 6/10 (raw lead data can be re-scraped; enrichment + scoring = the proprietary layer)
- **Evidence:** leads table: 18,042 rows confirmed June 2026 audit
- **Build priority:** Apollo enrichment ($49/mo) → email enrichment → activate outreach

### B2 — Capital Intelligence Profiles (25,384)
- **Asset:** 25,384 profiles in `capital_profiles` table — HNWI, family offices, institutional buyers
- **Ownership:** Agency Group
- **Quality:** 3/10 (volume excellent; enrichment minimal; most lack direct contact)
- **Uniqueness:** 9/10 (curated institutional buyer dataset for Portuguese RE = rare)
- **Defensibility:** 7/10 (collecting this again would take 18+ months)
- **Evidence:** capital_profiles table count confirmed June 2026
- **Build priority:** Enrich with emails → segment by investment mandate → activate

### B3 — HNWI Email Outreach Network (113 contacts, sent 2026-09-03)
- **Asset:** 113 institutional/HNWI contacts (family offices, PE funds, private banks) with direct email contact
- **Ownership:** Carlos Feiteira + Agency Group
- **Quality:** 7/10 (high-quality contacts: Rothschild, JPMorgan, LGT, Citi, family offices)
- **Uniqueness:** 9/10 (this specific network relationship set is personal + built over years)
- **Defensibility:** 9/10 (relationships are the most defensible asset in real estate)
- **Evidence:** LEADS_WITH_EMAIL_117.csv, send log 2026-09-03 (113/113 sent, 0 failed)
- **Build priority:** Follow up within 72h on replies. Convert 5% = 5–6 relationships

### B4 — AVM (Automated Valuation Model) — ESTIMATED
- **Asset:** Computer vision + market data AVM for property pricing (±4.2% stated accuracy)
- **Ownership:** Agency Group
- **Quality:** 5/10 (code exists; accuracy claimed but UNVERIFIED against real transactions)
- **Uniqueness:** 6/10 (several AVMs exist; proprietary photo-based scoring is differentiated)
- **Defensibility:** 5/10 (needs transaction data to improve; currently limited by 0 closed deals)
- **Evidence:** `app/api/avm/` routes exist; photo scoring in PortalPhotoScorer
- **Build priority:** Validate against 10 real transactions → calibrate → publish as tool

### B5 — Transaction Intelligence (Future Asset)
- **Asset:** Verified transaction comparables database
- **Ownership:** Will be Agency Group
- **Quality:** 0/10 (DOES NOT EXIST YET — 0 closed transactions)
- **Uniqueness:** 10/10 (real transaction data with buyer behavior = irreplaceable)
- **Defensibility:** 10/10 (competitors cannot buy this; must be lived)
- **Build priority:** Capture every deal in structured format from first close

---

## CATEGORY C — TECHNOLOGY ASSETS

### C1 — Next.js Platform (agencygroup.pt)
- **Asset:** 155-page Next.js 16 App Router application, 542 API routes, deployed Vercel Paris (cdg1)
- **Ownership:** Agency Group, all code original
- **Quality:** 8/10 (OWASP 87/100, TS 0 errors, 2,222 tests, excellent architecture)
- **Uniqueness:** 7/10 (tech is not unique; quality of execution is differentiated)
- **Defensibility:** 6/10 (code can be replicated; but 18+ months of development work)
- **Evidence:** `pnpm tsc --noEmit` = 0 errors. vitest = 2,222/2,222. Vercel deployment live.
- **Build priority:** Protect. Never degrade. Add features that strengthen moat.

### C2 — Sofia AI Agent (7 Roles, 8 Tools)
- **Asset:** Claude-powered property advisor AI with roles: residential, commercial, investment, developer, AVM, juridico, multilingual
- **Ownership:** Agency Group (system prompts + configuration)
- **Quality:** 6/10 (code excellent; 0 real conversations = unproven commercially)
- **Uniqueness:** 8/10 (no Portuguese real estate agency has AI advisor at this depth)
- **Defensibility:** 6/10 (improves with conversation data — 0 conversations = no advantage yet)
- **Evidence:** `app/api/sofia/` routes; SofiaAgentWidget component; 0 rows in sofia_conversations
- **Build priority:** Get first 50 real conversations → use data to improve prompts

### C3 — CRM Automation Stack (41 Cron Jobs + n8n)
- **Asset:** 41 automated cron jobs across every revenue function; n8n workflows designed but not deployed
- **Ownership:** Agency Group
- **Quality:** 5/10 (crons exist in codebase; n8n NOT deployed = automation not running)
- **Uniqueness:** 7/10 (depth of automation is unusual for a boutique agency)
- **Defensibility:** 5/10 (automation runs but n8n = critical gap)
- **Evidence:** 41 route.ts files in cron directories. n8n cloud trial expired (confirmed June 2026).
- **Build priority:** Deploy n8n to Railway (€15/mo, ~4 hours work) → critical blocker

### C4 — Security Architecture (OWASP 87/100)
- **Asset:** 7 waves of security hardening — auth, rate limiting, CSRF, RLS, magic links, GDPR
- **Ownership:** Agency Group
- **Quality:** 9/10 (OWASP 87/100 is genuinely exceptional for a startup)
- **Uniqueness:** 8/10 (HNWI clients require this; competitors rarely invest this deeply)
- **Defensibility:** 8/10 (trust = most important sales asset with institutional buyers)
- **Evidence:** OWASP audit Wave 7 results; Upstash rate limiting live; RLS confirmed
- **Build priority:** Protect at all costs. Never degrade below 87.

### C5 — pgvector Semantic Search
- **Asset:** Vector similarity search for property matching and semantic buyer-property pairing
- **Ownership:** Agency Group
- **Quality:** 5/10 (code exists; UNVERIFIED how many vectors exist or search quality)
- **Uniqueness:** 7/10 (semantic matching is rare in Portuguese RE market)
- **Defensibility:** 6/10 (vectors compound with data — better data = better search)
- **Evidence:** pgvector extension in Supabase; `app/api/properties/search/` route
- **Build priority:** Validate with real property data → test search quality

---

## CATEGORY D — NETWORK ASSETS

### D1 — Carlos Feiteira Personal Network
- **Asset:** Professional relationships built over career — developers, HNWI clients, institutional contacts
- **Ownership:** Carlos Feiteira (PERSONAL — cannot be transferred without relationship management)
- **Quality:** UNKNOWN (not systematically mapped)
- **Uniqueness:** 10/10 (personal network is irreplaceable)
- **Defensibility:** 10/10 (relationships follow the person)
- **Build priority:** Map all relationships into CRM within 30 days. Build relationship maintenance system.

### D2 — International Buyer Access (Via CRM)
- **Asset:** 25,384 profiles spanning US (3,010), UK (882), FR (748), AE (504)
- **Ownership:** Agency Group (data)
- **Quality:** 3/10 (mostly uncontacted, unenriched)
- **Uniqueness:** 8/10 (Iberian-focused international buyer database of this size = rare)
- **Defensibility:** 5/10 (data can degrade; relationships make it defensible)
- **Build priority:** Activate top 500 A+ leads → convert 5% to conversations

---

## CATEGORY E — OPERATIONAL ASSETS

### E1 — Multi-Language Capability (6 Languages)
- **Asset:** Platform, content, and Sofia all operate in EN/PT/FR/DE/ZH/IT
- **Ownership:** Agency Group
- **Quality:** 7/10 (EN + PT excellent; FR good; DE/ZH/IT functional)
- **Uniqueness:** 9/10 (no Portuguese boutique agency operates at this language depth)
- **Defensibility:** 7/10 (Sofia's multilingual capability is particularly hard to replicate quickly)
- **Evidence:** Multilingual blog articles; Sofia multilingual system prompts; hreflang in all 6 languages

### E2 — Vercel Infrastructure (Paris cdg1)
- **Asset:** Production deployment, edge computing, sub-100ms response times, 99.99% uptime SLA
- **Ownership:** Agency Group (Vercel account)
- **Quality:** 9/10 (enterprise-grade infrastructure for a fraction of the cost)
- **Uniqueness:** 3/10 (commodity infrastructure; value is in reliability)
- **Defensibility:** 8/10 (switching cost = risk; don't switch without cause)

---

## ASSET PORTFOLIO SUMMARY

| Asset | Quality | Uniqueness | Defensibility | Priority |
|-------|---------|------------|---------------|----------|
| AMI License | 10 | 7 | 9 | PROTECT |
| HNWI Network (113) | 7 | 9 | 9 | ACTIVATE (72h follow-up) |
| Capital Profiles (25K) | 3 | 9 | 7 | ENRICH (Apollo) |
| Security (OWASP 87) | 9 | 8 | 8 | PROTECT |
| Tech Platform | 8 | 7 | 6 | PROTECT + EXTEND |
| Sofia AI | 6 | 8 | 6 | ACTIVATE (get conversations) |
| Leads CRM (18K) | 4 | 8 | 6 | ENRICH + ACTIVATE |
| Blog/Content (55 articles) | 7 | 8 | 7 | EXTEND (2/month) |
| n8n Automation | 5 | 7 | 5 | DEPLOY (4h fix) |
| Personal Network | ? | 10 | 10 | MAP INTO CRM |
| Transaction Data | 0 | 10 | 10 | BUILD (starts with deal 1) |

**Most critical gap:** Transaction data (0/10). The entire long-term value model depends on starting to accumulate this. Every deal matters. Every close is an asset, not just GCI.

---

## ASSET PROTECTION PROTOCOL

Before any action that could affect an asset:

1. **NEVER delete CRM records** — every contact is a potential €50K+ in commission
2. **NEVER downgrade security** — OWASP 87 is a trust asset, not a cost
3. **NEVER publish false claims** — brand reputation is irreplaceable
4. **NEVER lose the personal network** — relationships that aren't in CRM will be lost
5. **ALWAYS capture transactions in structured data** — each closed deal = compounding asset

---

*Proprietary Assets Register v1.0 | Agency Group | 2026-09-03*
*Review: quarterly. Update immediately after: new deal close, new partnership, new major technical milestone.*
