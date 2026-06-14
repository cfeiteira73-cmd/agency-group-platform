# 17 — REBUILD ANALYSIS
**Agency Group | Ultimate Reverse Engineering Audit | 2026-06-14**

---

## WHAT WAS BUILT

```
SOURCE:          2,837 files, 461,190 lines of TypeScript
PAGES:           142
API ROUTES:      542
LIB SERVICES:    910 files
TESTS:           2,222
DB MIGRATIONS:   278
TS ERRORS:       0

MARKET VALUE:    €530,000 – €1,150,000 (rebuild cost estimate)
```

---

## REBUILD SCENARIO A: JUNIOR DEVELOPER (1 person, 0-2 years)

### Realistic Scope (can rebuild)
```
What a junior CAN rebuild:
  - Static website with blog (€5K–€8K, 3 months)
  - Basic property listing page (€3K–€5K, 1 month)
  - Simple contact form (€1K, 1 week)
  - Basic auth (magic links) (€2K–€3K, 2 weeks)
  
Total junior scope: €11K–€16K in 5-6 months
```

### What They CANNOT Rebuild
```
  - Sofia AI (multi-tool agentic loop) — needs AI expertise
  - Capital profiles scoring (ML) — needs data science
  - pgvector semantic search — needs ML ops
  - Security layer (OWASP 87/100) — needs security expertise
  - Compliance layer (GDPR/SOC2/AML) — needs regulatory expertise
  - Event streaming system — needs architecture expertise
  
ESTIMATE: Junior can deliver ~10% of current system
COST: €11K–€16K
TIME: 5-7 months
```

---

## REBUILD SCENARIO B: SENIOR DEVELOPER (1 person, 5+ years)

### Full Stack Senior (1 person)
```
Timeline: 12-18 months full-time
Cost: €80,000–€150,000 (salary/contracting)
Can deliver: ~60% of current system
Missing: AI fine-tuning, ML training, compliance depth

What they'd skip:
  - Most of lib/runtime/ (premature)
  - Advanced ML pipeline
  - Multi-agent architecture
  - Custom SIEM
  
Would build:
  - Entire Next.js platform
  - Supabase integration
  - Basic Sofia (without agentic loop)
  - Core CRM + deals
  - Basic security (OWASP 70/100)
```

---

## REBUILD SCENARIO C: TEAM (3-5 developers, 6 months)

### Frontend × 1 + Backend × 2 + AI × 1 + DevOps × 1
```
Team cost: €200,000–€350,000 (6 months)
Timeline: 6 months
Quality: 70-80% of current system
Missing: Depth of compliance, advanced ML

Team composition:
  Frontend (React/Next.js): €6K/month × 6 = €36K
  Backend × 2 (Node.js/Supabase): €8K/month × 6 = €96K
  AI engineer (LLM/pgvector): €10K/month × 6 = €60K
  DevOps (Vercel/infra): €7K/month × 6 = €42K
  
TOTAL: €234,000 + overhead = ~€300,000
RESULT: Production-ready platform, 6 months
```

---

## REBUILD SCENARIO D: AGENCY (with PM and QA)

### Premium Agency, 4 months
```
6-8 developers + PM + QA + AI specialist
Agency rate: €800–€1,500/day × 8 people × 80 days

COST: €512,000–€960,000
TIMELINE: 4 months (focused sprint)
QUALITY: 85-90% of current (would skip advanced ML)

This matches the €530K–€1.15M rebuild estimate from previous audit.
```

---

## REBUILD SCENARIO E: ENTERPRISE (Compass-style)

### Full Enterprise Clone
```
Target: Full Compass-equivalent for Portugal/Iberia
Team: 15-25 developers, 18-24 months
Cost: €2,000,000–€5,000,000

Would include:
  - All current features
  - Mobile app (iOS + Android native)
  - Enterprise ML (real training data)
  - 50 language support
  - Global infrastructure
  - Formal SOC2 certification
  
This is Year 3-5 of Agency Group, not today.
```

---

## WHAT CANNOT BE REBUILT (THE REAL MOAT)

### 7,342 Capital Profiles — IRREPLACEABLE
```
To rebuild from scratch:
  - LinkedIn Sales Navigator: €5,000/month × 12 months = €60K
  - Enrichment (Apollo, Hunter): €2,000/month × 12 months = €24K
  - Manual review and scoring: 500 hours × €50/hour = €25K
  - TOTAL COST: ~€110K
  - TOTAL TIME: 12-18 months
  
RESULT: Similar quality database, but 12+ months from now.
Agency Group has this TODAY.

The capital network is the most defensible asset.
```

### Reputation (Once Built)
```
Can't buy:   3 successful transactions
             3 happy institutional clients
             1 press mention in EFC/Financial Times
             
When earned: These create compounding flywheel
Time to earn: First deal needed first
```

---

## ACQUISITION VALUE

```
COMPARABLE: Compass raised at 1-2x ARR
            Agency Group ARR = €0 → Not comparable yet

ASSET-BASED VALUATION:
  Tech platform:         €530K–€1.15M (rebuild cost)
  Capital profiles:      €110K–€200K (data rebuild)
  AMI licence:           €5K–€10K
  Domain + brand:        €10K–€30K
  TOTAL ASSET VALUE:     €655K–€1.39M

FIRST DEAL POST-CLOSE:
  After 1 deal (€75K commission), ARR-based valuation opens.
  If run rate = €300K/year, acquirer might pay 3-5x = €900K–€1.5M
  Combined with assets: €1.5M–€2.5M acquisition target

STRATEGIC ACQUISITION VALUE (to Savills/Knight Frank/E&V):
  "Portuguese institutional AI brokerage with 7,342 institutional contacts"
  Strategic multiple: 5-10x ARR
  After €300K ARR: €1.5M–€3M
  After €1M ARR: €5M–€10M
```

---

## DECISION: REBUILD OR CONTINUE?

```
REBUILD (from scratch):    €300K–€1M, 6-18 months, worse result
CONTINUE (current system): €0 incremental tech investment needed

VERDICT: CONTINUE 100%

The platform is production-ready. The tech risk is solved.
The only work needed is COMMERCIAL, not technical.

5 actions worth €0 in tech investment that could generate €75K-€300K:
  1. Email 67 contacts (60 min)
  2. Deploy n8n to Railway (4h, €15/month)
  3. Call 3 developers for co-agency (1 week)
  4. Activate WhatsApp (2h)
  5. Sign 1 mandate (meeting needed)

DO NOT REBUILD. DO NOT PAUSE. SELL.
```

---

*Evidence: File scan (2,837 files, 461K LoC), previous audit scores, industry rebuild rate benchmarks*
