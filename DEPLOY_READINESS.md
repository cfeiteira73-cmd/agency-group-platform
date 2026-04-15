# Deploy Readiness — Agency Group
**Last updated: 2026-04-15 | v18 → Production**

---

## 🔴 CRITICAL — Do Before Next Deploy

### 1. ✅ DONE — Migration 036 (Supabase)
Table `public_saved_searches` created on 2026-04-15.
Columns: id, email, zona, tipo, preco_min, preco_max, quartos_min, piscina, purpose, keyword,
is_active, last_notified_at, notify_count, source, created_at, updated_at.
Indexes + RLS disabled + GRANTS applied. Trigger trg_pss_updated_at active.

### 2. ✅ DONE — Env Vars added to Vercel (2026-04-15)
```
N8N_WEBHOOK_URL = https://agencygroup.app.n8n.cloud  ✅
PORTAL_API_SECRET = b60bd2a0bf...                    ✅
SITE_URL = https://www.agencygroup.pt                ✅
AGENT_ALERT_EMAIL = (still missing — add geral@agencygroup.pt)
```

### 3. ✅ DONE — n8n Workflows imported + active (2026-04-15)
```
agencygroup.app.n8n.cloud — Total 3 workflows, all Published:
  - Workflow P — Saved Search Created  (id: 6sjsxteL4hzLa9Gp) ✅ Published
  - Workflow Q — Property Alert Matching (id: 7JS7nOMCwfhcZTZ6) ✅ Published
  - Agency — Lead Capture & Score                              ✅ Published
```
NOTE: n8n Cloud free plan — Variables not available. Workflows use $env.RESEND_API_KEY,
$env.PORTAL_API_SECRET, $env.SITE_URL. These need to be set as n8n Credentials or
upgraded to Pro for Variables support. Emails will fail until RESEND_API_KEY is wired in.

### 4. 🔴 STILL PENDING — Rotate Exposed Credentials
These credentials were in `.env.local` and may have been committed to git:
- [ ] ANTHROPIC_API_KEY — rotate at console.anthropic.com
- [ ] RESEND_API_KEY — rotate at resend.com → API Keys
- [ ] OPENAI_API_KEY — rotate at platform.openai.com
- [ ] SUPABASE_SERVICE_ROLE_KEY — rotate at Supabase → Settings → API

---

## 🟡 IMPORTANT — Do This Week

### 5. Git Security
```bash
# Remove .env.local from git tracking (add to .gitignore if not already)
git rm --cached .env.local
echo ".env.local" >> .gitignore
git commit -m "security: remove .env.local from tracking"
```

### 6. Activate n8n Workflows
After importing, activate in this order:
1. workflow-a-lead-inbound
2. workflow-a-lead-enrichment
3. wf_g_current (off-market core)
4. workflow-p-saved-search-created (new)
5. workflow-q-property-alert-match (new)

### 7. Test E2E Flow
```
TEST 1 — Saved Search:
  1. Go to agencygroup.pt/imoveis
  2. Click "🔔 Guardar Pesquisa"
  3. Submit form with test email
  4. Expected: Supabase row in public_saved_searches + n8n webhook fires + welcome email arrives

TEST 2 — Blog Email Capture:
  1. Open any blog article (e.g. /blog/comprar-casa-lisboa-guia-completo)
  2. Submit inline email capture form at midpoint
  3. Expected: /api/leads upsert succeeds + /api/alerts secondary call succeeds

TEST 3 — Unsubscribe:
  1. Visit /api/alerts/unsubscribe?email=test@test.com&zona=Lisboa&tipo=Todos
  2. Expected: HTML success page + row marked is_active=false in Supabase
```

---

## 🟢 COMPLETE — No Action Needed

| Item | Status |
|---|---|
| TypeScript | ✅ 0 errors |
| Saved searches API (`/api/alerts`) | ✅ Supabase + dedup + n8n webhook |
| Blog email capture (inline + end-of-article) | ✅ Both variants live |
| Blog related listings | ✅ Zone-matched + keyword fallback |
| Blog article saved search CTA | ✅ Non-legal categories |
| Imoveis page "Guardar Pesquisa" button | ✅ With GTM tracking |
| Press section (verified citations only) | ✅ Bloomberg/CNN/NYT verified |
| Alert unsubscribe endpoint | ✅ `/api/alerts/unsubscribe` |
| n8n saved-search workflow | ✅ `workflow-p-saved-search-created.json` |
| n8n property-match workflow | ✅ `workflow-q-property-alert-match.json` |
| GTM events (18 total) | ✅ All typed in lib/gtm.ts |
| OWASP security | ✅ 86/100 |
| Rate limiting | ✅ On leads + auth routes |
| React Fragment keys | ✅ Fixed in BlogArticle.tsx |
| GET /api/alerts zona filter | ✅ Supports ?zona= param |

---

## Architecture Overview

```
User Action                  →  API Route         →  Storage        →  Automation
─────────────────────────────────────────────────────────────────────────────────
Fill imoveis alert form      →  POST /api/alerts  →  Supabase PSS   →  n8n wf-p
Submit blog email capture    →  POST /api/leads   →  contacts table →  lead score
                             +  POST /api/alerts  →  Supabase PSS   →  n8n wf-p
New property added (portal)  →  POST /api/alerts  →  n8n wf-q       →  email blast
Property alert match         →  GET /api/alerts   →  Supabase PSS   →  Resend
Unsubscribe from email link  →  GET /api/alerts/unsubscribe → Supabase PSS update
```

---

## Env Vars Checklist

### Vercel (production)
- [x] NEXT_PUBLIC_SUPABASE_URL
- [x] SUPABASE_SERVICE_ROLE_KEY
- [x] RESEND_API_KEY
- [x] ANTHROPIC_API_KEY
- [x] CRON_SECRET
- [ ] N8N_WEBHOOK_URL ← **ADD THIS**
- [ ] PORTAL_API_SECRET ← **ADD THIS**
- [ ] SITE_URL ← **ADD THIS**
- [ ] AGENT_ALERT_EMAIL ← add for lead notifications (geral@agencygroup.pt)

### n8n Cloud (agencygroup.app.n8n.cloud → Settings → Env)
- [ ] SITE_URL = https://www.agencygroup.pt
- [ ] SUPABASE_URL = https://isbfiofwpxqqpgxoftph.supabase.co
- [ ] SUPABASE_SERVICE_KEY
- [ ] RESEND_API_KEY
- [ ] PORTAL_API_SECRET
- [ ] CRON_SECRET
- [ ] ANTHROPIC_API_KEY
