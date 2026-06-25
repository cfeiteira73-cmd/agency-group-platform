# 19 — INTEGRATIONS FORENSIC
**Agency Group | Absolute Master Forensic Audit | 2026-06-25**

---

## Integration Inventory

64 environment variables configured across development and Vercel.

### Tier 1: Live in Production

| Service | Purpose | Env Var | Status |
|---------|---------|---------|--------|
| Supabase | Primary DB + Auth | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Live |
| Anthropic | Sofia AI + AVM | `ANTHROPIC_API_KEY` | ✅ Live |
| Resend | Email delivery | `RESEND_API_KEY` | ✅ Live (key rotated 2026-04-13) |
| Upstash Redis | Rate limiting | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | ✅ Live |
| Vercel | Hosting + Crons | (platform env) | ✅ Live |
| NextAuth | Session management | `AUTH_SECRET`, `NEXTAUTH_URL` | ✅ Live |
| Google OAuth | Login | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | ✅ Live |
| VAPID | Push notifications | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | ✅ Coded (push configured) |

### Tier 2: Coded but Not Activated

| Service | Purpose | Env Var | Status |
|---------|---------|---------|--------|
| WhatsApp Business | Sofia on WhatsApp | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN` | ⚠️ PREENCHER — token placeholder |
| HeyGen | AI video avatars | `HEYGEN_API_KEY` | ⚠️ Key present, no production usage |
| Sentry | Error tracking | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | ⚠️ DSN configured, usage unverified |

### Tier 3: Revenue-Critical, Awaiting Activation

| Service | Purpose | Env Var | Status |
|---------|---------|---------|--------|
| Apollo.io | Email enrichment | `APOLLO_API_KEY` | ⚠️ Key present, enrichment not run |
| Smartlead.ai | Email sequences | `SMARTLEAD_API_KEY` | ⚠️ Key present, no sequences active |
| Notion | CRM + knowledge base | `NOTION_API_KEY` | ⚠️ Coded, limited real usage |

### Tier 4: Configured, Unknown Status

| Service | Purpose | Env Var | Status |
|---------|---------|---------|--------|
| Stripe | Subscription billing | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | ⚠️ Not needed for current model |
| Apify | Web scraping | `APIFY_API_KEY` | ⚠️ Used in Lead Engine (separate) |
| Casafari | Property data | `CASAFARI_API_KEY` | ⚠️ Integration coded, usage unverified |
| Idealista | Property listings | `IDEALISTA_API_KEY` | ⚠️ Integration coded, usage unverified |
| Railway | n8n hosting | (Railway env) | ⚠️ NOT deployed yet |

---

## Integration Depth Analysis

### Anthropic (Claude) — Production

| Usage | Route | Model | Status |
|-------|-------|-------|--------|
| Sofia AI agent | `/api/sofia` | claude-sonnet-4-6 | ✅ Live |
| AVM valuation | `/api/avm` | claude-sonnet-4-6 | ✅ Live |
| Consultor Jurídico | `/api/juridico` | claude-sonnet-4-6 | ✅ Live |
| Deal pack generation | `/api/deal-packs` | claude-sonnet-4-6 | ✅ Live |
| Computer vision scoring | `/api/photo-scorer` | claude-3-5-sonnet | ✅ Live |

Lazy Proxy pattern in `lib/ai/gateway.ts` prevents jsdom browser-env error (fixed commit 8aa4f63).

---

### Supabase — Production

| Feature | Status |
|---------|--------|
| PostgreSQL (EU Frankfurt) | ✅ |
| RLS on all tables | ✅ |
| pgvector (semantic search) | ✅ |
| Edge functions | ⚠️ May exist |
| Realtime subscriptions | ⚠️ Coded, usage unverified |
| Auth (used for magic link) | ✅ |

---

### Resend — Production

| Capability | Status |
|-----------|--------|
| Magic link emails | ✅ Live |
| Deal pack emails | ✅ Code ready |
| Lead outreach (via n8n) | ⚠️ Pending n8n deploy |
| Daily digest to Carlos | ⚠️ Pending n8n deploy |

Resend API key rotated 2026-04-13 (commit: n8n_resend_security_update).

---

### WhatsApp Business — BLOCKED

| State | Detail |
|-------|--------|
| Code | Complete (`app/api/whatsapp/`) |
| Webhook | Fixed (timingSafeEqual fix, commit 1760efe) |
| Token | `PREENCHER` placeholder in Vercel |
| Activation | Carlos must: get real token from Meta Business → set in Vercel |
| Time | 2-3 hours |

---

## Integration Critical Path for Revenue

```
Priority order for activation:

1. Apollo ($49) → 3,000+ email lookups → unlock 3% more outreach
2. n8n Railway ($15/mo) → activate 21 workflows → 3,164 sequences
3. WhatsApp (free) → activate Sofia on WhatsApp → inbound buyer channel
4. Smartlead (already paid?) → activate email sequences → automated follow-up
```

---

*Evidence: .env.local file scan | Vercel env vars (64) | reverse-engineering/14_INTEGRATION_GENOME.md | n8n_resend_security_update_2026-04-13.md memory*
