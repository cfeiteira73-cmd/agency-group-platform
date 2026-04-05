# Agency Group Intelligence API

Real estate data scraping, enrichment, and off-market signal detection service.
Powers the **Deal Radar** and **Investor Intelligence** dashboards.

---

## Architecture

```
scraper/
├── main.py              — FastAPI app, all route definitions
├── scrapers/
│   ├── dre.py           — Diário da República off-market signals
│   ├── idealista.py     — Idealista.pt (OAuth2 API)
│   ├── imovirtual.py    — Imovirtual.com (Playwright scraper)
│   └── remax.py         — RE/MAX Portugal (GraphQL)
├── processors/
│   ├── enrichment.py    — Price/m², market comparison, deal tier
│   ├── embeddings.py    — Voyage AI / OpenAI vector embeddings
│   └── scoring.py       — Multi-factor opportunity scoring
└── models/
    └── schemas.py       — Pydantic models (ScrapedProperty, OffMarketSignal, …)
```

Data flows:
1. Scrapers collect raw listings → `ScrapedProperty`
2. Enrichment adds market context → `EnrichmentResult`
3. Scoring ranks opportunities → `opportunity_score` (0–100)
4. Embeddings enable semantic investor–property matching in Supabase pgvector

---

## Local Development

### Prerequisites
- Python 3.12+
- `pip install -r requirements.txt`
- `playwright install chromium` (for Imovirtual scraper)

### Setup
```bash
cd services/scraper
cp .env.example .env
# Fill in your keys in .env
```

### Run
```bash
# From the services/ directory (package import requires this):
uvicorn scraper.main:app --reload --port 8000
```

API docs available at: http://localhost:8000/docs

---

## API Endpoints

### System

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness check — returns status, version, active jobs |

### Signals (Off-Market)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/signals/dre` | Fetch off-market signals from Diário da República |

**Query params:**
- `days_back` (1–30, default 7) — history window
- `min_priority` (0–100, default 0) — filter by score
- `zone` — filter by zone name (e.g. `Lisboa`, `Porto`)
- `refresh` — bypass 6h cache

**Example:**
```bash
curl "http://localhost:8000/signals/dre?days_back=14&min_priority=40&zone=Lisboa"
```

### Scraping

| Method | Path | Description |
|--------|------|-------------|
| POST | `/scrape/{source}` | Trigger async scrape job (returns 202) |
| GET | `/scrape/jobs/{job_id}` | Poll job status |
| GET | `/scrape/jobs/{job_id}/results` | Fetch completed job results |

**Supported sources:** `idealista`, `imovirtual`, `remax`

**Example:**
```bash
# Start job
curl -X POST "http://localhost:8000/scrape/idealista?city=Porto&max_items=50"
# → {"job_id": "abc-123", "status": "pending", ...}

# Poll status
curl "http://localhost:8000/scrape/jobs/abc-123"

# Get results with enrichment
curl "http://localhost:8000/scrape/jobs/abc-123/results?enrich=true"
```

### Enrichment

| Method | Path | Description |
|--------|------|-------------|
| POST | `/enrich/property` | Enrich a single ScrapedProperty |
| POST | `/enrich/bulk` | Enrich up to 100 properties, optional embeddings |

**Example:**
```bash
curl -X POST http://localhost:8000/enrich/property \
  -H "Content-Type: application/json" \
  -d '{
    "source": "manual",
    "source_ref": "test-001",
    "source_url": "https://example.com",
    "title": "T3 Lisboa",
    "property_type": "apartment",
    "price": 450000,
    "area_m2": 100,
    "zone": "Lisboa",
    "city": "Lisboa"
  }'
```

**Response:**
```json
{
  "property_id": "test-001",
  "price_m2": 4500.0,
  "zone_avg_price_m2": 5000.0,
  "price_vs_market": -10.0,
  "estimated_yield": 4.2,
  "deal_tier": "GOOD"
}
```

### Market Data

| Method | Path | Description |
|--------|------|-------------|
| GET | `/market/zones` | Zone benchmarks (price/m², yield, YoY) |

### Scoring

| Method | Path | Description |
|--------|------|-------------|
| POST | `/score/signals` | Score a batch of off-market signals |
| POST | `/score/properties` | Score properties as investment opportunities |

---

## Deal Tiers

| Tier | Price vs Market | Action |
|------|----------------|--------|
| EXCELLENT | ≤ −20% | Immediate contact — motivated seller |
| GOOD | −10% to −20% | Strong opportunity — schedule visit |
| FAIR | ±5% | Market price — standard process |
| PREMIUM | +5% to +15% | Above market — negotiate or pass |
| OVERPRICED | > +15% | Avoid or lowball offer |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `ANTHROPIC_API_KEY` | Optional | For AI enrichment features |
| `VOYAGE_API_KEY` | Optional | Voyage AI embeddings (preferred) |
| `OPENAI_API_KEY` | Optional | OpenAI embeddings (fallback) |
| `IDEALISTA_API_KEY` | Optional | Idealista developer API key |
| `IDEALISTA_SECRET` | Optional | Idealista developer secret |
| `REDIS_URL` | Optional | Redis for production caching |
| `PORT` | Railway | Auto-set by Railway |

---

## Railway Deployment

1. Push code to GitHub
2. Connect Railway to your repo
3. Add a new service pointing to `services/scraper/Dockerfile`
4. Set environment variables in Railway dashboard (reference secrets with `@VAR_NAME`)
5. Railway auto-deploys on push to main

**Build context:** Set to repo root so Docker can copy `services/scraper/`.

**Health check:** Railway pings `/health` every 30s.

---

## Connecting to Next.js

From your Next.js API routes, call this service via internal Railway networking:

```typescript
// lib/intelligence.ts
const INTEL_API = process.env.INTEL_API_URL ?? "http://localhost:8000";

export async function getDRESignals(zone?: string) {
  const params = new URLSearchParams({ days_back: "7", min_priority: "30" });
  if (zone) params.set("zone", zone);
  const res = await fetch(`${INTEL_API}/signals/dre?${params}`);
  return res.json();
}

export async function enrichProperty(property: ScrapedProperty) {
  const res = await fetch(`${INTEL_API}/enrich/property`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(property),
  });
  return res.json();
}
```

Set `INTEL_API_URL` in your Next.js Railway service to the internal URL of this service (Railway provides this automatically for services in the same project).

---

## Notes

- **Imovirtual** uses Playwright (headless Chromium). The Docker image installs it automatically. Adds ~400MB to image size.
- **Idealista** requires an approved developer account. Without API keys it returns empty results gracefully.
- **DRE API** is public and requires no authentication.
- Cache TTL is 6 hours by default. Use `refresh=true` to force a fresh fetch.
- In-memory cache is per-instance. For multi-worker production deployments, switch to Redis using `REDIS_URL`.
