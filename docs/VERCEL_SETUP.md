# Vercel Environment Variables Setup

## Quick Setup Steps

1. Go to [vercel.com](https://vercel.com) → agency-group project → Settings → Environment Variables
2. Add each variable below for **Production + Preview** environments
3. Redeploy after adding all variables

---

## Required Variables (Production will fail without these)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (Settings → API) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (keep secret) |
| `AUTH_SECRET` | NextAuth secret — min 32 chars random string |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key (sk-ant-...) |
| `OPENAI_API_KEY` | OpenAI API key — semantic search + Whisper voice |
| `RESEND_API_KEY` | Resend email API key (re_...) |
| `NOTION_TOKEN` | Notion integration token (secret_...) |
| `NEXT_PUBLIC_APP_URL` | `https://www.agencygroup.pt` |
| `NEXTAUTH_URL` | `https://www.agencygroup.pt` |
| `NEXT_PUBLIC_BASE_URL` | `https://www.agencygroup.pt` |

---

## Security Variables

| Variable | Description |
|----------|-------------|
| `INTERNAL_API_TOKEN` | Secures `/api/embeddings/sync` — run `node scripts/generate-token.js` to generate |
| `OFFMARKET_CODES` | Comma-separated codes: `offmarket2026,ag2026,vip2026` |

**Generate INTERNAL_API_TOKEN:**
```bash
node scripts/generate-token.js
```

---

## Notion Database IDs (already set — do not change)

| Variable | Value |
|----------|-------|
| `NOTION_DEALS_DB` | `b5693a14ca8c43fa8645606363594662` |
| `NOTION_MENSAGENS_DB` | `cc52c0eba2df4649ae2b1cb45bb83513` |
| `NOTION_REELS_DB` | `f03b534cef7b40fab423e440ca09f997` |
| `NOTION_APRENDIZAGENS_DB` | `d4d4ce407ae14358855d67cc7f28cbb4` |
| `NOTION_CRM_DB` | `e8e554eb-adad-482e-b38b-443c23d08a40` |
| `NOTION_PROPERTIES_DB` | `bd030794-9aec-4b7d-9219-1b7beae5a658` |
| `NOTION_PIPELINE_DB` | `7e68e68d-86ed-471c-8655-d8edf1e5c604` |

---

## HeyGen Sofia Video Setup

1. Sign up at [heygen.com](https://heygen.com)
2. Create a custom avatar: HeyGen → Avatars → Create
3. Copy the Avatar ID (format: `xxx-xxx-xxx`) from the avatar detail page
4. Go to Voices tab, select a Portuguese voice (e.g. "Ana" or "Sofia"), copy Voice ID
5. Add to Vercel:

| Variable | Where to find |
|----------|---------------|
| `HEYGEN_API_KEY` | HeyGen Dashboard → Settings → API |
| `HEYGEN_AVATAR_ID` | HeyGen → Avatars → [your avatar] → copy ID |
| `HEYGEN_VOICE_ID` | HeyGen → Voices → [portuguese voice] → copy ID |

---

## Push Notifications (VAPID)

Already generated — copy from `.env.local`:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | VAPID public key for browser subscription |
| `VAPID_PRIVATE_KEY` | VAPID private key (keep secret) |
| `VAPID_SUBJECT` | `mailto:info@agencygroup.pt` |

---

## WhatsApp Business

| Variable | Description |
|----------|-------------|
| `WHATSAPP_PHONE_NUMBER_ID` | From Meta Developer Dashboard |
| `WHATSAPP_ACCESS_TOKEN` | Permanent system user token from Meta |
| `WHATSAPP_VERIFY_TOKEN` | Webhook verification token (your custom string) |
| `WHATSAPP_ACTIVE` | `false` = CRM only; `true` = Sofia replies on WhatsApp |

---

## Rate Limiting (Upstash Redis)

| Variable | Description |
|----------|-------------|
| `UPSTASH_REDIS_REST_URL` | From Upstash console → REST API |
| `UPSTASH_REDIS_REST_TOKEN` | From Upstash console → REST API |

---

## Monitoring (Sentry)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SENTRY_DSN` | Public Sentry DSN (safe to expose) |
| `SENTRY_AUTH_TOKEN` | Sentry auth token for source maps upload |

---

## Verifying the Setup

After deployment, test these endpoints:

```bash
# Market data endpoint
GET https://www.agencygroup.pt/api/gpt/market?zona=Lisboa
# Expected: JSON with market data for Lisboa

# Sofia chat
POST https://www.agencygroup.pt/api/chat
Body: {"message": "Quais as melhores zonas para investir?"}
# Expected: Sofia AI response

# Pre-market exclusives
GET https://www.agencygroup.pt/api/premarket
# Expected: Array of pre-market properties

# Semantic search (requires OPENAI_API_KEY)
GET https://www.agencygroup.pt/api/search?q=apartamento+vista+mar+Lisboa
# Expected: Semantically ranked results

# Embeddings sync (requires INTERNAL_API_TOKEN header)
POST https://www.agencygroup.pt/api/embeddings/sync
Headers: Authorization: Bearer YOUR_INTERNAL_API_TOKEN
# Expected: {"synced": N, "status": "ok"}
```

---

## Vercel CLI Quick Add

```bash
# Install Vercel CLI
npm i -g vercel

# Add variables interactively
vercel env add INTERNAL_API_TOKEN production
vercel env add OPENAI_API_KEY production
vercel env add HEYGEN_API_KEY production
vercel env add HEYGEN_AVATAR_ID production
vercel env add HEYGEN_VOICE_ID production
vercel env add OFFMARKET_CODES production

# Pull env to local after setting
vercel env pull .env.local
```

---

## Post-Deploy Checklist

- [ ] All Required Variables added to Production
- [ ] `INTERNAL_API_TOKEN` generated via `node scripts/generate-token.js` and set in Vercel
- [ ] `OPENAI_API_KEY` set (enables semantic search + voice)
- [ ] `HEYGEN_API_KEY` + `HEYGEN_AVATAR_ID` + `HEYGEN_VOICE_ID` set (enables Sofia video)
- [ ] Supabase migrations run (3 files in `supabase/migrations/`)
- [ ] Test `/api/gpt/market?zona=Lisboa` returns data
- [ ] Test `/api/chat` with POST returns Sofia response
- [ ] `WHATSAPP_ACTIVE=true` set only when Sofia WhatsApp approved
