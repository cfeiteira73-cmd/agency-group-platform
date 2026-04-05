# n8n Workflows — Deployment Guide

## Option A: Railway (Recommended)

1. Go to railway.app → New Project → Deploy from GitHub
2. Select agency-group repo, Root Directory: `n8n-workflows`
3. Add environment variables:
   - N8N_ENCRYPTION_KEY=<32-char random string>
   - N8N_WEBHOOK_URL=https://your-n8n.railway.app
   - SUPABASE_URL=<from .env.local>
   - SUPABASE_SERVICE_ROLE_KEY=<from .env.local>
   - ANTHROPIC_API_KEY=<from .env.local>
   - PORTAL_URL=https://your-portal.vercel.app
4. Deploy. Visit https://your-n8n.railway.app to access n8n UI

## Option B: Local Docker

```bash
# Copy and fill in variables
cp .env.example .env

# Start n8n
docker compose up -d

# Access at http://localhost:5678
```

## Import Workflows

In n8n UI → Settings → Import Workflow, import these files in order:

1. `workflow-a-lead-inbound.json` — New lead inbound webhook (placeholder — extend as needed)
2. `workflow-a-lead-enrichment.json` — Full lead enrichment: normalise, dedup, score, WhatsApp
3. `workflow-b-lead-scoring.json` — Lead scoring automation (placeholder — extend as needed)
4. `workflow-b-daily-report.json` — Daily market intelligence report (Mon–Fri 08:00 cron)
5. `workflow-c-dormant-lead.json` — Daily dormant lead re-engagement (09:00 cron)
6. `workflow-d-investor-alert.json` — Investor alert webhook: property matching + WhatsApp
7. `workflow-e-vendor-report.json` — Monday vendor reports (08:00 cron)

## Environment Variables needed in each workflow

After importing, update credentials in n8n for:
- **Supabase**: URL + Service Role Key
  Credential name expected: `Supabase PostgreSQL` (id: `supabase-postgres-cred`)
- **Anthropic**: API Key
  Credential name expected: `Anthropic API`
- **WhatsApp**: Phone Number ID + Access Token
  Credential name expected: `WhatsApp Business API`
- **Portal API**: Internal API Secret
  Credential name expected: `Agency Group Portal API`

## Webhook URLs (after deploy)

| Workflow | Path | Full URL |
|---|---|---|
| Lead Enrichment | `/lead-enrichment` | `https://your-n8n.railway.app/webhook/lead-enrichment` |
| Investor Alert | `/new-property` | `https://your-n8n.railway.app/webhook/new-property` |

## Notes

- All workflows use PostgreSQL credentials pointing to Supabase (connection pooler recommended: port 6543)
- Cron jobs run in UTC — adjust expressions if needed for Lisbon time (UTC+1/UTC+2)
- Workflow D uses an investor matching algorithm with a 60-point qualification threshold (budget 30pts, zone 25pts, type 20pts, yield 25pts)
- Workflow B (daily report) aggregates new listings + price reductions from the last 24h and sends a digest
