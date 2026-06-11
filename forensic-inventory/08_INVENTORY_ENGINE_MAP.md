# 08 — INVENTORY ENGINE MAP
**Agency Group | Nano Detail Forensic Inventory | 2026-06-11**

---

## INVENTORY SUMMARY

| Metric | Value |
|--------|-------|
| DB properties | 55 |
| Verified mandates | 0 |
| Real co-agency agreements | 0 |
| Off-market leads | 14 |
| Verified off-market | Unknown |

---

## PROPERTY DATABASE (55 records — UNVERIFIED)

All 55 properties in the DB are seeded/demo data. Column structure confirmed:

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| nome | TEXT | Property name |
| zona | TEXT | Zone (Lisboa, Cascais, Porto, Algarve, etc.) |
| bairro | TEXT | Neighbourhood |
| tipo | TEXT | Apartment, Villa, Penthouse, etc. |
| preco | BIGINT | Price in EUR |
| area | NUMERIC | Area in m² |
| quartos | INTEGER | Bedrooms |
| casas_banho | INTEGER | Bathrooms |
| energia | TEXT | Energy certificate (A, B, C, etc.) |
| status | TEXT | active/sold/pending |
| descricao | TEXT | Property description |
| features | JSONB | Feature list |
| lifestyle_tags | TEXT[] | Lifestyle tags |
| badge | TEXT | Display badge |
| gradient | TEXT | Visual gradient |
| images | JSONB | Photo URLs |
| lat/lng | NUMERIC | GPS coordinates |
| matterport_url | TEXT | 3D tour URL |
| youtube_url | TEXT | Video URL |
| agent_id | UUID | Assigned agent |
| embedding | VECTOR(1536) | Semantic search |

### Estimated Zone Distribution (seeded)
| Zone | Estimated Count |
|------|----------------|
| Lisboa | ~20 |
| Cascais | ~10 |
| Algarve | ~10 |
| Porto | ~8 |
| Madeira | ~4 |
| Other | ~3 |

---

## OFF-MARKET SYSTEM (14 leads)

### offmarket_leads table (14 records)
- Managed via /api/offmarket-leads/* routes (9 sub-routes)
- Source: Off-market signals
- Status: Under evaluation

### Off-Market Routes
```
GET  /api/offmarket-leads          — List leads
POST /api/offmarket-leads/manual   — Add manually
GET  /api/offmarket-leads/[id]     — Lead detail
GET  /api/offmarket-leads/[id]/call-script   — AI call script
POST /api/offmarket-leads/[id]/deal-eval     — Deal evaluation
POST /api/offmarket-leads/[id]/log-action    — Log action
GET  /api/offmarket-leads/[id]/match-buyers  — Find buyers
GET  /api/offmarket-leads/[id]/price-intel   — Price intelligence
POST /api/offmarket-leads/batch-eval         — Batch evaluation
GET  /api/offmarket-leads/risk-flags         — Risk analysis
POST /api/offmarket-leads/score              — Score leads
```

---

## PROPERTY AI SYSTEM

| Component | File | Purpose |
|-----------|------|---------|
| Listing generator | lib/property-ai/listing-generator/ | AI listing creation |
| Media scoring | lib/property-ai/media/imageScoringEngine.ts | Photo quality |
| Ingestion | lib/property-ai/ingestion/ | Multi-modal input |
| Distribution | lib/property-ai/distribution/ | Multi-channel publish |
| Copilot | lib/property-ai/copilot/ | Seller guidance |
| Intelligence | lib/property-ai/intelligence/ | Market analysis |
| Learning | lib/property-ai/learning/ | Performance tracking |
| Homepage feed | lib/property-ai/homepage/ | Dynamic hero |

### Property AI Routes
```
POST /api/property-ai/submit    — Submit new property (seller form)
GET  /api/property-ai/submissions — List submissions
POST /api/property-ai/upload    — Upload media
POST /api/property-ai/track     — Track view events
GET  /api/property-ai/homepage-feed — Homepage ranking
```

---

## INVENTORY SUPPLY CHANNELS

### Channel 1: Developer Co-Agency (TARGET)
- Status: 0 agreements signed
- Targets: Vanguard Properties, Norfin, Imofid, Sonae Sierra
- Pitch: "7,342 international buyers. We co-sell your inventory."
- File: `lib/supply/supplyIngestionOrchestrator.ts`
- Pipeline: `lib/supply-dominance/supplyDominanceEngine.ts`

### Channel 2: Broker Co-Agency
- Status: 0 agreements signed
- Targets: Lisboa boutique brokers
- File: `lib/supply/brokers/brokerCrmConnector.ts`

### Channel 3: Portal Property Submissions
- Route: /api/property-ai/submit (seller form on /vender)
- Status: Form live, 0 real submissions

### Channel 4: Idealista / Casafari Ingestion
- Cron: /api/cron/ingest-listings (05:00 daily)
- File: `lib/ingestion/idealistaAdapter.ts`
- Status: Cron configured, actual execution unknown

### Channel 5: Bank NPL Feeds
- File: `lib/providers/npl/bankNplFeedClient.ts`
- Status: Configured, never activated

### Channel 6: Citius (Public Registry)
- File: `lib/providers/citius/citiusClient.ts`
- Status: Configured, never activated

### Channel 7: Off-Market Signals
- Route: /api/off-market/signals
- Status: 14 leads in system

---

## AVM ENGINE

| Component | Route | Purpose |
|-----------|-------|---------|
| AVM page | /avm | Public valuation tool |
| AVM API | /api/avm | Valuation calculation |
| Photo AVM | /api/avm/photos | Photo-based valuation |
| CMA | /api/properties/cma | Comparable market analysis |
| Market data refresh | /api/market-data/refresh (Mon 03:00) | Weekly update |
| AVM compute cron | /api/cron/avm-compute (07:00 daily) | Daily recalculation |

### AVM Model
- Located: `lib/valuation/avm.ts`
- Uses: Market data + property features + location
- Forecast horizon: 6 months
- Accuracy claim: ±4.2% (from audit reports)
- External data: Idealista, DRE, Casafari

---

## INVENTORY SCORING

| Score | Meaning | Action |
|-------|---------|--------|
| 90-100 | Trophy asset | Priority matching |
| 70-89 | Premium | Active marketing |
| 50-69 | Standard | Normal pipeline |
| <50 | Below average | Deprioritize |

---

*Evidence: Supabase REST API, lib/property-ai/ scan, app/api/offmarket-leads scan — 2026-06-11*
