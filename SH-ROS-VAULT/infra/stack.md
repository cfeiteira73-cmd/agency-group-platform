# SH-ROS Infrastructure Stack
## Version: 1.0.0 | Created: 2026-05-19

> Full detail in system-bible/SH-ROS_MASTER_BIBLE.md Section 2.
> This doc covers external services, env vars, Vercel config, and cron schedule.

---

## External Services

| Service | URL / Account | Purpose | Status |
|---------|--------------|---------|--------|
| Supabase | isbfiofwpxqqpgxoftph.supabase.co | Database + Auth + Storage | Production |
| Vercel | carlos-feiteiras-projects team | Hosting + Crons + Edge | Production |
| n8n Cloud | agencygroup.app.n8n.cloud | Automation workflows | Production |
| Upstash Redis | via REST URL | Circuit breakers, rate limits, dedup | Production |
| Anthropic | api.anthropic.com | Claude AI | Production |
| OpenAI | api.openai.com | Embeddings + Whisper | Production |
| Resend | api.resend.com | Transactional email | Production |
| WhatsApp Meta | graph.facebook.com | WhatsApp Business API | +351 919948986 |
| HeyGen | api.heygen.com | Sophia avatar videos | Pending activation |
| Stability AI | api.stability.ai | Virtual staging images | Production |
| Sentry | sentry.io | Error tracking | Production |
| Apify | api.apify.com | Web scraping / lead enrichment | Production |
| Stripe | api.stripe.com | Payments (test mode) | Test |

---

## Required Environment Variables

### Supabase
```
SUPABASE_URL=https://isbfiofwpxqqpgxoftph.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### AI
```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
HEYGEN_API_KEY=...
STABILITY_API_KEY=sk-...
```

### Redis
```
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
```

### Communications
```
RESEND_API_KEY=re_...
WHATSAPP_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_VERIFY_TOKEN=...
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
```

### Auth
```
AUTH_SECRET=...          (min 32 chars, used for JWT signing)
NEXTAUTH_URL=https://agencygroup.pt
```

### Automation
```
N8N_WEBHOOK_URL=https://agencygroup.app.n8n.cloud/webhook/...
N8N_API_KEY=...
CRON_SECRET=...          (used to verify cron requests from Vercel)
```

### Monitoring
```
SENTRY_DSN=https://...@sentry.io/...
SENTRY_AUTH_TOKEN=...
DATADOG_API_KEY=...      (optional, for SIEM Datadog sink)
```

### Integrations
```
APIFY_API_TOKEN=apify_api_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### App Config
```
NEXT_PUBLIC_APP_URL=https://agencygroup.pt
TENANT_ID=agency-group
TENANT_ISOLATION_ENABLED=false
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
```

---

## Vercel Project Configuration

- **Project ID**: prj_gr2FFZaDEBrYL7AzJtoisGuLnrvV
- **Team**: carlos-feiteiras-projects
- **Framework**: Next.js 15
- **Node version**: 20.x
- **Build command**: `next build`
- **Output directory**: `.next`
- **Root directory**: `/` (monorepo root)

---

## Cron Job Schedule (29 jobs in vercel.json)

| Cron | Schedule | Route | Purpose |
|------|----------|-------|---------|
| vault-integrity | `0 2 * * *` | /api/cron/vault-integrity | Daily vault hash check |
| gdpr-purge | `0 3 * * *` | /api/cron/gdpr-purge | Delete expired tokens/data |
| daily-brief | `0 7 * * *` | /api/cron/daily-brief | Agent morning briefing |
| match-compute | `0 6 * * *` | /api/cron/match-compute | Nightly match scoring run |
| deal-followup | `0 8 * * *` | /api/cron/deal-followup | Daily follow-up queue |
| dlq-processor | `*/5 * * * *` | /api/cron/dlq-processor | DLQ retry every 5 min |
| token-budget | `0 0 1 * *` | /api/cron/token-budget | Monthly token budget reset |
| priority-refresh | `0 7 * * 1-5` | /api/cron/priority-refresh | Weekday priority queue rebuild |
| secret-audit | `0 2 * * 1` | /api/cron/secret-audit | Weekly secrets expiry check |
| avm-refresh | `0 1 * * 0` | /api/cron/avm-refresh | Weekly property valuations |
| ...20 more... | various | /api/cron/* | Feature-specific automation |

---

## n8n Workflow Summary

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| inbound-lead | Webhook | Route new leads to CRM + Sofia |
| whatsapp-router | Webhook | Route WhatsApp messages to Sofia |
| email-sequence | Cron | Drip email sequences |
| deal-alert | Supabase trigger | Agent notification on deal stage change |
| investor-digest | Cron weekly | Send portfolio update to investors |
| lead-enrichment | On new contact | Apify enrichment run |
| heygen-video | Manual trigger | Generate Sophia video for HNWI |
| slack-notify | Event | Internal team notifications |

All workflow JSON files stored in: `n8n-workflows/` directory and `/SH-ROS-VAULT/infra/n8n-exports/`
