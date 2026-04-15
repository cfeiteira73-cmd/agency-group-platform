# n8n Workflows — Deployment Guide
**Agency Group Deal Machine — Off-Market Engine**

> **n8n Cloud**: https://agencygroup.app.n8n.cloud (confirmed active)
> **Supabase**: https://isbfiofwpxqqpgxoftph.supabase.co

---

## ✅ Deploy Status

| Component | Status | URL |
|---|---|---|
| n8n Cloud | **ACTIVE** | https://agencygroup.app.n8n.cloud |
| Vercel | **ACTIVE** | https://www.agencygroup.pt |
| Supabase | **ACTIVE** | isbfiofwpxqqpgxoftph |
| Migration 036 | **PENDING** — apply in Supabase Dashboard | `public_saved_searches` table |

---

## Setup: n8n Cloud (Current Setup)

Since n8n Cloud is already active at `agencygroup.app.n8n.cloud`:

1. Go to **https://agencygroup.app.n8n.cloud**
2. Settings → **Environment Variables** → Add each variable:

```
SITE_URL=https://www.agencygroup.pt
SUPABASE_URL=https://isbfiofwpxqqpgxoftph.supabase.co
SUPABASE_SERVICE_KEY=<from .env.local: SUPABASE_SERVICE_ROLE_KEY>
ANTHROPIC_API_KEY=<from .env.local: ANTHROPIC_API_KEY>
RESEND_API_KEY=<from .env.local: RESEND_API_KEY>
PORTAL_API_SECRET=<from .env.local: PORTAL_API_SECRET — just generated>
CRON_SECRET=<from .env.local: CRON_SECRET>
```

3. Import workflows (Settings → Import) — see table below
4. Activate each workflow

---

## Option B: Railway (Self-hosted, if needed later)

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Select `agency-group` repo, Root Directory: `n8n-workflows`
3. Add environment variables (same as above + `N8N_ENCRYPTION_KEY`)
4. Deploy. Visit your Railway URL to access n8n UI.

---

## Option B: Local Docker

```bash
cp .env.example .env        # fill in variables above
docker compose up -d        # starts n8n on http://localhost:5678
```

---

## Required n8n Credentials (create before importing workflows)

In n8n UI → Settings → Credentials, create each credential:

| Credential Name | Type | Fields |
|---|---|---|
| `Supabase PostgreSQL` | PostgreSQL | Host: `db.<project>.supabase.co:6543`, DB: `postgres`, User: `postgres`, Pass: service_role_key |
| `Anthropic API` | HTTP Header Auth | Header: `x-api-key`, Value: `<ANTHROPIC_API_KEY>` |
| `Agency Group Portal API` | HTTP Header Auth | Header: `x-cron-secret`, Value: `<CRON_SECRET>` |
| `WhatsApp Business API` | HTTP Header Auth | Header: `Authorization`, Value: `Bearer <WA_ACCESS_TOKEN>` |
| `Resend API` | HTTP Header Auth | Header: `Authorization`, Value: `Bearer <RESEND_API_KEY>` |
| `Telegram Bot` | Telegram Bot | Bot Token: `<TELEGRAM_BOT_TOKEN>` |

> **Note on Portal API auth**: All webhook calls to `/api/offmarket-leads` must include header `x-cron-secret: <CRON_SECRET>`. The `Agency Group Portal API` credential must use header name `x-cron-secret`.

---

## Import Workflows (in this order)

In n8n UI → Settings → Import Workflow, import these files:

### Tier 1 — Core (import first, required for operation)

| # | File | Description | Trigger |
|---|---|---|---|
| 1 | `workflow-a-lead-inbound.json` | Lead inbound webhook — receives raw lead data | Webhook POST `/lead-inbound` |
| 2 | `workflow-a-lead-enrichment.json` | Full enrichment: normalise, dedup, score via API, WhatsApp outreach | Webhook POST `/lead-enrichment` |
| 3 | `wf_g_current.json` | **OFF-MARKET CORE**: receives Apify scrape, deduplicates, calls POST `/api/offmarket-leads`, triggers scoring | Webhook POST `/offmarket-new` |
| 4 | `workflow-h-score-high-alert.json` | **ALERT**: when score ≥ 80, sends Telegram + WhatsApp to assigned advisor | Webhook POST `/score-high-alert` |
| 5 | `workflow-n-daily-digest.json` | **DAILY**: calls GET `/api/reporting/daily`, formats and sends digest to Telegram | Cron: Mon–Fri 08:30 UTC |

### Tier 2 — Operations (import after Tier 1)

| # | File | Description | Trigger |
|---|---|---|---|
| 6 | `workflow-b-lead-scoring.json` | Batch lead scoring automation | Cron: 07:00 UTC weekdays |
| 7 | `workflow-b-daily-report.json` | Daily market intelligence report | Cron: 08:00 UTC daily |
| 8 | `workflow-c-dormant-lead.json` | Dormant lead re-engagement (no contact 14d) | Cron: 09:00 UTC daily |
| 9 | `workflow-i-followup-auto.json` | Auto follow-up scheduling for interested leads | Cron: 09:30 UTC weekdays |
| 10 | `workflow-m-advisor-assignment.json` | Round-robin advisor assignment for new leads | Webhook POST `/assign-advisor` |

### Tier 3 — Partnerships & Reporting

| # | File | Description | Trigger |
|---|---|---|---|
| 11 | `workflow-d-investor-alert.json` | Investor alert: property match → WhatsApp | Webhook POST `/new-property` |
| 12 | `workflow-e-vendor-report.json` | Monday vendor reports | Cron: Mon 08:00 UTC |
| 13 | `workflow-j-partner-onboarding.json` | New institutional partner welcome flow | Webhook POST `/partner-onboard` |
| 14 | `workflow-k-meeting-notify.json` | Meeting scheduled → confirmation WhatsApp/email | Webhook POST `/meeting-notify` |
| 15 | `workflow-l-lead-reactivation.json` | Reactivation campaign for cold leads (>30d) | Cron: Mon 10:00 UTC |

### Tier 4 — Blog & Alerts Engine (NEW — 2026-04-15)

| # | File | Description | Trigger |
|---|---|---|---|
| 16 | `workflow-p-saved-search-created.json` | **NEW**: Blog/imoveis subscriber → welcome email + lead score update | Webhook POST `/saved-search-created` |
| 17 | `workflow-q-property-alert-match.json` | **NEW**: New property added → query `public_saved_searches` → notify matching subscribers | Webhook POST `/new-property` |

---

## Webhook URLs (n8n Cloud)

Base URL: `https://agencygroup.app.n8n.cloud`

| Workflow | Path | Usage |
|---|---|---|
| Lead Enrichment | `/webhook/lead-enrichment` | Apify webhook, manual trigger |
| Off-Market New Lead | `/webhook/offmarket-new` | **Apify Idealista/OLX actor webhook** |
| Score High Alert | `/webhook/score-high-alert` | Called by scoring API on score ≥ 80 |
| Daily Digest | *(cron — no webhook)* | Auto-runs Mon–Fri 08:30 UTC |
| Investor Alert | `/webhook/new-property` | Portal → new property created |
| Assign Advisor | `/webhook/assign-advisor` | Called on new lead creation |
| **Saved Search Created** | `/webhook/saved-search-created` | **NEW** — fired by `/api/alerts` POST |
| **Property Alert Match** | `/webhook/new-property` | **NEW** — fired when new property added |

---

## Apify Configuration (External — must do in Apify Console)

Create an **Idealista Scraper** actor with:
- **Webhook URL**: `https://agencygroup.app.n8n.cloud/webhook/offmarket-new`
- **Webhook Headers**: `x-cron-secret: <CRON_SECRET>`
- **Schedule**: Daily 06:00 UTC
- **Target**: Portugal listings, price range €100K–€5M, types: moradia/apartamento/quinta/terreno
- **Output mapping**: ensure `nome`, `cidade`, `price_ask`, `area_m2`, `source_listing_id` are mapped

---

## How Apify → Portal flow works

```
Apify runs daily
  → Sends webhook POST to n8n /webhook/offmarket-new
  → workflow-g: deduplicates by source_listing_id
  → POST /api/offmarket-leads with header x-cron-secret
  → Lead created with score_status = pending_score
  → Vercel cron (07:00 UTC) calls GET /api/offmarket-leads/score?only_pending=true
  → Leads with score ≥ 80 trigger workflow-h (Telegram + WhatsApp to advisor)
  → Advisor runs Match Buyers from Deal Desk
  → DPS computed, attack_recommendation stored
  → Lead appears in Deal Desk Execução Diária as P0/P1
```

---

## Important Notes

- **CRON_SECRET** must be identical in Vercel env vars, n8n env, and Apify webhook headers
- All Supabase connections should use the **connection pooler** (port 6543), not direct (5432)
- Cron times are UTC — Lisbon is UTC+1 (winter) / UTC+2 (summer)
- After import, activate each workflow (toggle to Active)
- Workflow G (`offmarket-new`) is the single most critical workflow for Deal Machine operation
- Test webhook delivery with: `curl -X POST https://your-n8n.railway.app/webhook/offmarket-new -H "x-cron-secret: <CRON_SECRET>" -H "Content-Type: application/json" -d '{"nome":"Teste","cidade":"Lisboa","price_ask":500000}'`
