# Apify → n8n Integration — Agency Group Deal Machine

## Status: CONFIGURED (pending n8n Railway deploy for public webhook URL)

## Apify Account
- Token: stored in `.env.local` → `APIFY_TOKEN`
- Idealista Actor: `dz_omar/idealista-scraper-api` (ID: `oJTRDX4iyfR3erNnv`)

## Test Run Created
- Run ID: `7ya7Y6oULk29Cd4Ma`
- Started: 2026-04-12T20:55:18Z
- Status: SUCCEEDED ✅

## n8n Webhook (Production URL when deployed on Railway)
- Production: `https://{railway-app}.railway.app/webhook/offmarket-new`
- Local dev: `http://localhost:5678/webhook/offmarket-new` ✅ LIVE

## Apify Webhook Configuration (Run after each actor run)
```json
POST https://api.apify.com/v2/acts/dz_omar~idealista-scraper-api/webhooks
Headers: Authorization: Bearer $APIFY_TOKEN

Body:
{
  "eventTypes": ["ACTOR.RUN.SUCCEEDED"],
  "requestUrl": "https://{railway-app}.railway.app/webhook/offmarket-new",
  "headersTemplate": {
    "Content-Type": "application/json",
    "x-cron-secret": "$CRON_SECRET"
  },
  "payloadTemplate": "{{#each resource.defaultDatasetId}}{{.}}{{/each}}"
}
```

## Actor Input for Scheduled Runs (06:30 UTC Mon-Fri)
```json
{
  "searchType": "homes",
  "operation": "sale",
  "location": "lisboa",
  "country": "pt",
  "propertyType": "all",
  "maxItems": 50
}
```

## Activate Command (once n8n Railway URL is known)
```bash
APIFY_TOKEN="$APIFY_TOKEN"  # from .env.local
N8N_WEBHOOK_URL="https://{railway}.railway.app/webhook/offmarket-new"

curl -X POST "https://api.apify.com/v2/acts/dz_omar~idealista-scraper-api/webhooks?token=$APIFY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "eventTypes": ["ACTOR.RUN.SUCCEEDED"],
    "requestUrl": "'"$N8N_WEBHOOK_URL"'",
    "headersTemplate": {"Content-Type":"application/json","x-cron-secret":"'"$CRON_SECRET"'"},
    "isAdHoc": false
  }'
```
