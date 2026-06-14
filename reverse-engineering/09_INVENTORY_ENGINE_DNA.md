# 09 — INVENTORY ENGINE DNA
**Agency Group | Ultimate Reverse Engineering Audit | 2026-06-14**

---

## PROPERTY UNIVERSE

| Source | Count | Quality | Verified? |
|--------|-------|---------|-----------|
| DB properties | 55 | Seeded/demo | ❌ None verified |
| Off-market leads | 14 | Under evaluation | ❌ Not verified |
| Verified mandates | 0 | N/A | — |
| Exclusive listings | 0 | N/A | — |
| Co-agency agreements | 0 | N/A | — |

**TOTAL REAL INVENTORY: 0**

---

## PROPERTY TABLE ANALYSIS

### Schema (Portuguese columns — FIXED in commit 1760efe)
```
nome, zona, bairro, tipo, preco, area, quartos, casas_banho,
energia, descricao, features (JSONB), images (JSONB),
lat, lng, matterport_url, embedding (VECTOR 1536),
score, is_offmarket, mandate_type
```

### 55 Seeded Properties
```
Data source:    System seeded (fake/demo data)
Zones covered:  Lisboa, Cascais, Algarve, Porto (estimated)
Price range:    €400K–€3M (estimated, seeded values)
Verified:       0
Real mandates:  0
Matterport:     0 real tours
Embeddings:     0 real (or seeded)
```

---

## AVM ENGINE

### Architecture
```
Inputs:
  - Property location (zone + coordinates)
  - Type (apartment/house/commercial)
  - Area (m²)
  - Bedrooms, bathrooms
  - Energy rating
  - Condition
  - Features (pool, garage, terrace, etc.)

Algorithm:
  1. Fetch comparable sales in zone
  2. Weight by recency, similarity, distance
  3. Apply market multiplier (zone index)
  4. Apply condition adjustment
  5. Generate range: value ± 4.2% (stated accuracy)

Output:
  - Valuation estimate (€/m²)
  - Confidence interval
  - Comparable properties used
  - Market trend
```

### AVM Market Data (2026)
```
Lisboa:    €5,000/m² (CLAUDMD source)
Cascais:   €4,713/m²
Algarve:   €3,941/m²
Porto:     €3,643/m²
Madeira:   €3,760/m²
Açores:    €1,952/m²
National:  €3,076/m² (median)
Growth:    +17.6% YoY
Transactions: 169,812 (2025)
Avg days on market: 210 days
```

### AVM Status
```
Route:    /api/avm/estimate (POST)
Cron:     /api/cron/avm-daily (07:00 UTC — unconfirmed)
Real runs: 0 (no real properties to value)
Public:   /avm page exists (lead capture form)
```

---

## COMPUTER VISION SCORING

### Architecture
```
Input:    Property photos (URLs)
Engine:   lib/property-ai/photoScorer.ts
Model:    Stability AI (STABILITY_API_KEY configured)
Output:   Score 0-100 per photo + overall property photo score

Scoring criteria:
  - Natural light
  - Room size impression
  - Furniture quality
  - Photo angle/composition
  - Exterior appeal
```

### Status
```
Built:    Yes (PortalPhotoScorer component + API)
Active:   Unknown (0 real properties with real photos)
Routes:   /api/properties/images (POST)
```

---

## SEMANTIC SEARCH

### Architecture
```
Engine:   pgvector extension on Supabase
Model:    OpenAI text-embedding-3-small (1536 dims)
Index:    IVFFlat on properties.embedding
Query:    /api/properties/search → cosine similarity

Natural language query example:
  "3-bedroom apartment near beach Algarve under €800K"
  → Embed query → cosine search → ranked results
```

### Status
```
Built:    Yes (routes + DB index confirmed)
Used:     Unknown (0 real users on site)
```

---

## OFF-MARKET SYSTEM

### Architecture
```
Tables:   offmarket_leads (14 rows)
Sources:  Manual entry + Idealista monitoring
Process:  Lead identified → AVM estimate → Owner contact → Mandate

14 off-market leads:
  Status: Under evaluation (manual review needed)
  Action: Carlos to review and contact owners
```

### Idealista Monitoring
```
API:      IDEALISTA_API_KEY + IDEALISTA_SECRET
Purpose:  Monitor new listings + price changes
Status:   Configured, usage unknown
Route:    /api/market/idealista/* (built)
```

---

## PROPERTY MATCHING ENGINE

### Architecture
```
Match logic: lib/matching/propertyMatcher.ts
Algorithm:
  1. Get property features
  2. Filter capital_profiles by:
     - Investment range (profile.min_ticket ≤ preco ≤ profile.max_ticket)
     - Preferred zones (profile.preferred_zones contains zona)
     - Profile type suitability
  3. Score match (0-100)
  4. Rank by score
  5. Auto-trigger deal pack if score ≥80

Output:
  - matches table row
  - Priority: HIGH/MEDIUM/LOW
  - next_best_action
```

### Status
```
Route:    /api/properties/match (POST) — built
Cron:     /api/cron/match-buyer — unconfirmed
Real matches: 0 (17 demo rows)
Trigger:  Needs real property + real buyer
```

---

## PROPERTY PIPELINE

```
ACQUISITION (supply sources):
  1. Developer partnerships  → 0 signed agreements
  2. Owner mandates (direct) → 0 verified mandates
  3. Off-market detection    → 14 leads pending
  4. Co-agency              → 0 co-agency agreements
  5. Inherited mandates     → 0
  6. Idealista scraping     → Configured, unknown

TECH PIPELINE:
  Intake → AVM → Photo score → Embed → Match → Pack → Outreach
  FIXED  ← Portuguese columns now correct in API (commit 1760efe)

REAL PIPELINE:
  Step 1 (BLOCKED): No real mandates
  Everything after: Built but not running
```

---

## WHAT NEEDS TO HAPPEN

| Priority | Action | Expected Result |
|----------|--------|----------------|
| 1 | Call developers in 14 off-market leads | 1-2 co-agency agreements |
| 2 | Visit Vanguard Properties, Norfin, Imofid | Co-agency pitch |
| 3 | Sign 1 exclusive mandate from any source | Unlock entire matching engine |
| 4 | Upload real property to DB | AVM + matching + outreach triggers |
| 5 | Run photo scoring on real photos | Property score for marketing |

**Time to first real property in system: 1 week (if meetings happen this week)**

---

*Evidence: Supabase REST API, forensic-inventory/08_INVENTORY_ENGINE_MAP.md, vercel.json, CLAUDMD market data*
