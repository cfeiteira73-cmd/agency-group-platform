# AG Scraper Service

FastAPI service for DRE signals, market enrichment, and property analysis.

## Deploy to Railway

1. Go to railway.app → New Project → Deploy from GitHub
2. Select the `agency-group` repo
3. Set Root Directory: `services/scraper`
4. Add environment variables from `.env.example`
5. Railway auto-detects Dockerfile and deploys

## Endpoints

- `GET /health` — Service health check
- `POST /signals/dre` — Fetch DRE building permits
- `POST /enrich/property` — Property market enrichment
- `GET /market/zones` — Zone market data
