# MAXIMUM SCORE MODEL
Agency Group | Final Maximum Reality Program | 2026-06-06
Evidence-based ceiling analysis. No speculation.

---

## SCORING DEFINITIONS

**Current Score** — What evidence supports today  
**Internal Max** — Maximum achievable with Carlos alone, no external budget  
**Market Max** — Maximum achievable with proper team, budget, operations  
**Gap: Internal** — What must change to reach Internal Max  
**Gap: Market** — What must change to reach Market Max  

---

## TECHNOLOGY

| Level | Score | Requirements |
|-------|-------|--------------|
| Current | 88 | As-is (447 TS errors, missing W54 tables) |
| Internal Max | 95 | Fix 52 TS error files, apply W54-W58 migrations |
| Market Max | 99 | Multi-region, CDN, external load test, pen test cert |

**Missing points to 95:**
- Fix 52 TypeScript error files (47 = nullable type issues, 5 = missing DB tables)
  - All deterministic fixes, ~8-12 hours work
- Apply W54-W58 migrations (reality_monitor_snapshots, asel_defense_runs, ios_runtime_audits, campanhas)
  - 5-6 SQL files, 30 minutes work

**Missing points to 99:**
- Multi-region Vercel deployment (EU + US)
- CDN edge caching for property images
- External penetration test report
- Load test certification (k6 or similar)
- Vercel Analytics enabled

**Missing to 100 (market):**
- SOC2 Type II certification
- ISO 27001 audit
- 99.99% uptime SLA with monitoring proof

---

## CRM

| Level | Score | Requirements |
|-------|-------|--------------|
| Current | 52 | 7,342 contacts, 0.9% email, 0% scored |
| Internal Max | 72 | Fix scores, fix country_iso, start sequences |
| Market Max | 95 | Email enrichment for 7K+ contacts, active pipeline |

**Missing points to 72:**
1. Fix total_score for all 7,342 contacts (re-import from Excel with correct column mapping)
2. Fix country_iso truncation (ALTER COLUMN, re-import)
3. Start first Sofia sequence (50 contacts minimum)
4. Activate 25 contacts in active pipeline
5. Get 5 real buyers into contacts table

**Missing points to 95:**
1. Email enrichment tool (Hunter.io, Apollo, LinkedIn Sales Navigator)
   - Est. 30-40% enrichment rate → ~2,200 emails added
   - Cost: €99-299/month
2. Phone numbers for A+ tier (73 contacts)
3. Active email sequences on A+ + A tiers
4. Meetings booked and tracked
5. Deals linked to capital_profiles contacts

---

## SOFIA

| Level | Score | Requirements |
|-------|-------|--------------|
| Current | 68 | Code complete, 0 conversations |
| Internal Max | 82 | Web chat proven, first sequences |
| Market Max | 95 | WhatsApp active, 500+ conversations/month |

**Missing points to 82:**
1. Demonstrate 10 web chat conversations in production
2. Activate first email sequence (10 contacts)
3. Show task creation working (learning_events populated)
4. Log first meeting request

**Missing points to 95:**
1. WhatsApp channel activation (requires Meta Business Verification)
2. 500+ conversations/month
3. Meeting creation + CRM sync proven
4. Escalation to human agent working
5. Follow-up sequences automated end-to-end

---

## SECURITY

| Level | Score | Requirements |
|-------|-------|--------------|
| Current | 79 | Rate limiting, auth, CSRF, HMAC |
| Internal Max | 88 | Apply W54 tables, fix security schema gaps |
| Market Max | 97 | External pen test, SIEM, PagerDuty |

**Missing to 88:**
1. Apply W54-W58 migrations (creates asel_defense_runs, ios_runtime_audits tables)
2. Configure Slack SOC webhook properly with production alerts
3. Verify DR runbook manually (test restore from PITR)

**Missing to 97:**
1. External penetration test ($3-8K)
2. SIEM integration (Datadog or Azure Sentinel)
3. PagerDuty on-call rotation
4. Verified DR test under load
5. Security certifications

---

## AUTOMATION

| Level | Score | Requirements |
|-------|-------|--------------|
| Current | 58 | 41 crons defined, n8n local only |
| Internal Max | 75 | Deploy n8n to Railway, confirm cron logs |
| Market Max | 92 | All sequences live, full automation stack |

**Missing to 75:**
1. Deploy n8n to Railway (free tier available)
   - 12 workflows ready to import
   - ~2 hours setup
2. Get Vercel cron execution logs (Vercel dashboard)
3. Confirm at least 3 crons executed this week
4. Start first automated email sequence

**Missing to 92:**
1. n8n cloud with all 12 workflows active
2. WhatsApp sequences
3. Automated lead enrichment pipeline
4. All 41 crons with execution monitoring
5. Alert on cron failure

---

## DATA

| Level | Score | Requirements |
|-------|-------|--------------|
| Current | 42 | 55 properties (seeded?), 7K CRM, no live feeds |
| Internal Max | 58 | Confirm/replace seeded data, basic market data |
| Market Max | 90 | Live Casafari feed, 200+ real properties |

**Missing to 58:**
1. Manually verify if 55 properties are real — if seeded, replace with real mandates
2. Subscribe to Casafari basic (€99/month) OR export from Idealista Pro
3. Import real market transaction data (INE/Confidencial Imobiliário)
4. Get 10 real buyer profiles into contacts table

**Missing to 90:**
1. Casafari live API feed (€300-800/month)
2. 200+ real property listings
3. Historical transaction database
4. Automated AVM with live comps
5. Demand intelligence by zone/typology

---

## CAPITAL NETWORK

| Level | Score | Requirements |
|-------|-------|--------------|
| Current | 48 | 7,342 LinkedIn-only contacts, 0 conversations |
| Internal Max | 65 | Fix data quality, start LinkedIn outreach |
| Market Max | 85 | Email enrichment, 200+ real conversations |

**Missing to 65:**
1. Fix total_score for all 7,342 (re-import)
2. Fix country_iso truncation
3. Start LinkedIn outreach to top 73 A+ contacts
4. Log first 10 conversations in capital_profiles
5. Get 3 qualified meetings booked

**Missing to 85:**
1. Email addresses for 2,000+ contacts (enrichment)
2. 200+ real conversations logged
3. 25+ meetings completed
4. Capital matching → opportunity pipeline proven
5. First deal referral or co-investment confirmed

---

## OPERATIONS

| Level | Score | Requirements |
|-------|-------|--------------|
| Current | 15 | Website live, no active operations |
| Internal Max | 65 | Carlos using system daily, first real pipeline |
| Market Max | 90 | Full team, daily operations cadence |

**Missing to 65:**
1. Carlos logs in daily and works the CRM
2. At least 10 real contacts actively in pipeline
3. Weekly report running and being read
4. 3 deals being actively pursued
5. Cron jobs confirmed executing

**Missing to 90:**
1. Sales team (2-3 agents)
2. Operations manager
3. Daily standup cadence
4. KPIs tracked weekly
5. Revenue flowing

---

## INVENTORY

| Level | Score | Requirements |
|-------|-------|--------------|
| Current | 18 | 55 properties (unverified) |
| Internal Max | 55 | 30 real confirmed mandates |
| Market Max | 85 | 100+ mandates, off-market network |

**Missing to 55:**
1. Verify which of 55 properties are real mandates
2. Add source URL, mandate date, agent for each real property
3. Add 20 more real mandates (sellers, developers, co-agency)
4. Off-market pipeline: first 5 opportunities logged

**Missing to 85:**
1. 100+ active mandates
2. Off-market network (50+ developer relationships)
3. Citius/auction pipeline active
4. Hotel and land portfolio segment
5. Casafari or manual CMO active

---

## BRAND

| Level | Score | Requirements |
|-------|-------|--------------|
| Current | 18 | Website + blog live |
| Internal Max | 45 | LinkedIn thought leadership + PR outreach |
| Market Max | 75 | Top 3 Portugal family office brand, press coverage |

**Missing to 45:**
1. LinkedIn personal brand: 3 posts/week on Carlos's profile
2. 1 PR article in Eco/Jornal de Negócios or Expresso
3. Speak at 1 family office event
4. Co-author 1 market report with another institution

**Missing to 75:**
1. Regular media presence (5+ articles/year in financial press)
2. Institutional partnerships announced
3. Family office association membership
4. Case studies published (3+ deals)

---

## REVENUE

| Level | Score | Requirements |
|-------|-------|--------------|
| Current | 0 | €0 |
| Internal Max | 35 | First commission signed |
| Market Max | 85 | €500K+ annual revenue |

**Missing to 35:**
1. Close first real deal (mandate + buyer + offer)
2. CPCV signed and notarized
3. Commission invoice issued
4. €0 → €X (any amount)

**Missing to 85:**
1. 5% commission on €10M+ annual transaction volume = €500K
2. Requires: 3-5 agents, 50+ real mandates, active buyer database

---

## SUMMARY TABLE

| Dimension | Current | Internal Max | Market Max |
|-----------|---------|--------------|------------|
| Technology | 88 | 95 | 99 |
| CRM | 52 | 72 | 95 |
| Sofia | 68 | 82 | 95 |
| Security | 79 | 88 | 97 |
| Automation | 58 | 75 | 92 |
| Data | 42 | 58 | 90 |
| Capital Network | 48 | 65 | 85 |
| Operations | 15 | 65 | 90 |
| Inventory | 18 | 55 | 85 |
| Brand | 18 | 45 | 75 |
| Revenue | 0 | 35 | 85 |
| **AGGREGATE** | **44** | **67** | **86** |

**Key insight:** The gap from 44→67 (Internal Max) is ALL deterministic or solo-actionable.  
The gap from 67→86 (Market Max) requires budget, team, and time.
