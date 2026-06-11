# 07 — CAPITAL NETWORK MAP
**Agency Group | Nano Detail Forensic Inventory | 2026-06-11**

---

## TOTAL NETWORK SIZE

| Metric | Value |
|--------|-------|
| Total institutional contacts | 7,342 |
| Countries represented | 60+ |
| With email | 67 |
| A+ score (≥80) | 116 |
| Family Offices | ~1,701 |
| Wealth Managers | ~1,470 |

---

## SEGMENT BREAKDOWN

### Family Offices (~1,701)
- Primary acquisition target
- Typically €2M-€50M+ mandates
- US-heavy, Swiss, UK, Middle East
- Long decision cycle (3-18 months)
- Relationship-driven — need warm intro or direct contact
- Top names confirmed in DB: Rothschild, Citi Private Bank, State Street

### Wealth Managers (~1,470)
- Intermediary segment — represents client capital
- Typically manage €100M+ AUM
- Strong in UK, Switzerland, Luxembourg, Singapore
- Commission receptive — will refer clients for fee
- Best outreach: "off-market allocations for HNW clients"

### Funds (~900 estimated)
- Real estate funds, REITs, infrastructure funds
- Larger tickets (€5M-€100M+)
- Acquisition-focused, not relationship-dependent
- Contact: Investment committee or acquisitions director

### Private Equity (~650 estimated)
- Opportunistic capital
- Development plays, distressed assets
- Portugal specific: Comporta, Melides, Alentejo
- Typical ticket: €3M-€20M

### Introducers (~800 estimated)
- Referral network — lawyers, accountants, advisors
- Send HNW clients in return for referral fee
- High leverage: one introducer = multiple deals
- Need activation and referral agreement

### Venture (~400 estimated)
- Tech/startup capital looking for lifestyle assets
- €500K-€2M range
- Strong in US (Silicon Valley), Israel, UK

---

## GEOGRAPHIC BREAKDOWN

### Tier 1 Markets (High Volume + High Quality)

| Country | Count | Avg Ticket | Priority |
|---------|-------|-----------|---------|
| United States | ~3,010 | €1M-€5M | 🔴 HIGHEST |
| United Kingdom | ~882 | €800K-€3M | 🔴 HIGH |
| France | ~748 | €600K-€2M | 🔴 HIGH |
| UAE | ~504 | €2M-€10M | 🔴 HIGH |

### Tier 2 Markets (Strategic)

| Country | Count | Avg Ticket |
|---------|-------|-----------|
| Germany | ~380 | €1M-€4M |
| Switzerland | ~280 | €2M-€10M |
| Portugal | ~260 | €300K-€2M |
| Brazil | ~220 | €200K-€800K |
| China | ~190 | €500K-€3M |

### Tier 3 Markets (Emerging)

| Country | Count | Notes |
|---------|-------|-------|
| Israel | ~160 | Strong Middle East connection |
| Singapore | ~140 | Asia Pacific HQ |
| Canada | ~130 | NHR interest |
| Hong Kong | ~120 | Capital flight |
| Netherlands | ~100 | Institutional funds |

---

## CONTACTABILITY ANALYSIS

| Status | Count | % | Action |
|--------|-------|---|--------|
| Email available | 67 | 0.9% | Email TODAY |
| LinkedIn only | ~2,200 | ~30% | LinkedIn DM |
| Phone only | Unknown | ~5% | Cold call |
| No contact info | ~5,000 | ~68% | Enrichment needed |

### Apollo.io Enrichment Potential
- Apollo.io free: 50 credits/month
- Apollo.io paid: $99/month for 1,000 credits
- Estimated email find rate: 40-60% for business emails
- Expected result: 2,800-4,400 new emails from paid plan

---

## QUALITY TIERS

### A+ Network (116 contacts)
The 116 contacts with score ≥80 represent the highest-quality institutional buyers:
- Mix of Family Offices, Funds, and Wealth Managers
- Primarily US, UK, UAE, Switzerland
- Known tier-1 firms confirmed in DB
- **These 116 contacts represent €1B+ in theoretical investment capacity**
- 67 have email → can be contacted TODAY without enrichment

---

## CAPITAL ENGINE

| Component | File | Purpose |
|-----------|------|---------|
| Transaction pipeline | lib/capital/transactionPipeline.ts | Capital flow orchestration |
| Investor ledger | lib/capital/investorLedger.ts | Capital tracking |
| Settlement machine | lib/capital/settlementStateMachine.ts | Deal settlement |
| Escrow layer | lib/capital/escrowLayer.ts | Escrow management |
| Capital intake | lib/capital/capitalIntake.ts | New capital onboarding |
| Intelligence engine | lib/capital-intel/capitalIntelligenceEngine.ts | Capital analysis |
| Matching engine | lib/capital-intel/investorMatchingEngine.ts | AI matching |
| ROI simulator | lib/capital-intel/roiDistributionSimulator.ts | Return modeling |

---

## MATCHING SYSTEM

| Component | Status |
|-----------|--------|
| matches table | 17 existing matches |
| Match engine | lib/capital-intel/investorMatchingEngine.ts |
| Match trigger | /api/automation/match-buyer |
| Scoring | Buyer score × Property score |
| Auto-trigger | ≥80 score → deal pack generated |

### Match Distribution (17 existing)
All 17 matches are likely demo data from system seeding. 0 confirmed real matches.

---

*Evidence: Supabase REST API, lib/ directory analysis, .env.example — 2026-06-11*
