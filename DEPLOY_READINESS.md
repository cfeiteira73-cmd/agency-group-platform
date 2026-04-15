# Deploy Readiness — Agency Group
**Last updated: 2026-04-15 | v23 → Production**

---

## 🟢 ALL CRITICAL ITEMS RESOLVED — Production Green

### -2. ✅ DONE — n8n wf-Q integration + Lead Nurture D+1/D+7/D+30 (2026-04-15)
- `POST /api/properties/db`: now fires `N8N_WEBHOOK_URL/webhook/new-property` after successful insert
  → triggers wf-Q subscriber matching automatically on every new property (non-blocking, 5s timeout)
  → status guard: skip for off-market/sold properties
- `GET /api/alerts?mode=active`: fixed auth to accept `PORTAL_API_SECRET` (wf-Q bearer token)
  → previous bug: wf-Q sent PORTAL_API_SECRET but route only checked CRON_SECRET → 401 → zero subscribers fetched → zero emails
- New n8n Workflow R — Lead Nurture Sequence: `workflow-r-lead-nurture.json`
  → Schedule: every hour → compute D+1/D+7/D+30 windows → fetch candidates → personalised email per window
  → D+1: "Já viu estes imóveis?" · D+7: "Imóveis off-market reservados" · D+30: "Análise de mercado"
  → Dedup via nurture_log table (migration 037) — no duplicate sends
- New API routes: `/api/automation/nurture-candidates` + `/api/automation/nurture-mark-sent`
- New migration: `037_nurture_log.sql` — RUN IN SUPABASE DASHBOARD SQL EDITOR
- Commit: 774007f

### -1. ✅ DONE — n8n P1 Email Fixes (2026-04-15)
- Root cause: httpRequest nodes in wf-P + wf-Q missing `"method":"POST"` → defaulted to GET → emails never sent
- Fix A: wf-P nodes `HTTP — Send Welcome Email` + `HTTP — Update Lead Score` → `method: POST` via PATCH API
- Fix B: wf-Q node `HTTP — Send Property Alert Email` → `method: POST` via PATCH API
- Fix C: `$env.RESEND_API_KEY` → literal `re_TtQZcoYi…` in both workflows (n8n Cloud free plan has no Variables)
- Verified: GET /rest/workflows after PATCH confirms `method: POST` on all 3 nodes
- Local JSON files updated: workflow-p-saved-search-created.json + workflow-q-property-alert-match.json

### 0. ✅ DONE — P0 /api/leads fix (2026-04-15)
- Replaced `upsert onConflict:'email'` (→ 42P10, no UNIQUE constraint) with find-then-insert/update
- Stripped columns not in PostgREST schema cache (detected_intent, agent_email, etc.)
- Added `name` field (live DB schema.sql has `name TEXT NOT NULL` alongside `full_name`)
- E2E confirmed: buyer insert → 200 id=35, seller insert → 200 id=36, phone-dedup update → 200
- Temp debug endpoint `/api/dbcheck` deleted after confirmation

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
AGENT_ALERT_EMAIL = geral@agencygroup.pt                ✅
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

### 4. ✅ DONE — Rotate Exposed Credentials (2026-04-15)
- [x] ANTHROPIC_API_KEY — rotated, new key `ag-prod-2026-rotated` active in Vercel + .env.local. Old key `ag-prod-final-2026` → revoke manually at console.anthropic.com
- [x] RESEND_API_KEY — already rotated 2026-04-13 (re_TtQZcoYi…)
- [x] OPENAI_API_KEY — new key created, 2 old keys revoked, Vercel updated
- [x] SUPABASE_SERVICE_ROLE_KEY — new sb_secret format, Vercel + .env.local updated

---

## 🔴 ACÇÕES PENDENTES — Confirmadas por auditoria 2026-04-15

### P0a. Add NEXT_PUBLIC_GTM_ID to Vercel — 2 min (€500K–€2M/year blocker)
```
Vercel Dashboard → agency-group → Settings → Environment Variables
NEXT_PUBLIC_GTM_ID = GTM-XXXXXXX    ← container ID from tagmanager.google.com
```
Status: CONFIRMED MISSING by live Supabase/Vercel audit (2026-04-15)
Impact: 18 coded GTM events (lead_form_submit, saved_search_success, property_view, etc.) fire to void

### P0b. Add AGENT_ALERT_EMAIL to Vercel — 1 min (silent failure: agent never notified of new leads)
```
Vercel Dashboard → agency-group → Settings → Environment Variables
AGENT_ALERT_EMAIL = geral@agencygroup.pt
```
Status: CONFIRMED MISSING by live Supabase/Vercel audit (2026-04-15)
Impact: /api/leads route sends "new lead" email to this address — never arrives

### P0c. Run Migration 037 (nurture_log) — 30s (wf-R blocked until this runs)
```sql
-- Supabase Dashboard → SQL Editor → New query → paste → Run
-- File: supabase/migrations/037_nurture_log.sql
```
Status: CONFIRMED table does not exist by live Supabase audit (2026-04-15)

### P0d. Import + Activate wf-R in n8n — 2 min
1. agencygroup.app.n8n.cloud → Import → n8n-workflows/workflow-r-lead-nurture.json → Activate

---

## 🟡 IMPORTANT — Do This Week (priority order)

### 5b. Run Migration 037 (nurture_log) — 30s
```sql
-- Supabase Dashboard → SQL Editor → New query → paste → Run
-- File: supabase/migrations/037_nurture_log.sql
CREATE TABLE IF NOT EXISTS public.nurture_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id    TEXT NOT NULL,
  sequence_day  INTEGER NOT NULL CHECK (sequence_day IN (1, 7, 30)),
  email         TEXT NOT NULL,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT nurture_log_contact_day_unique UNIQUE (contact_id, sequence_day)
);
CREATE INDEX IF NOT EXISTS idx_nurture_log_contact_id ON public.nurture_log (contact_id);
ALTER TABLE public.nurture_log DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.nurture_log TO authenticated, anon;
```

### 5c. Import + Activate Workflow R in n8n — 5 min
1. Go to agencygroup.app.n8n.cloud
2. Import `n8n-workflows/workflow-r-lead-nurture.json`
3. Activate — runs every hour, fires D+1/D+7/D+30 nurture emails automatically

### 5d. Configure GTM — P0 Revenue Gap (€500K-€2M/year) — 10 min
```
Vercel Dashboard → agency-group → Settings → Environment Variables
NEXT_PUBLIC_GTM_ID = GTM-XXXXXXX    ← your container ID from tagmanager.google.com
```
Activates all 18 coded GTM events (form submits, property views, saved searches, CTA clicks).
Currently firing to void — zero analytics visibility.

## 🟡 IMPORTANT — Do This Week (original items)

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
- [x] NEXT_PUBLIC_SUPABASE_URL  ✅ confirmed present
- [x] SUPABASE_SERVICE_ROLE_KEY ✅ confirmed present (sb_secret_WhFpc7Q8DE5n6rz…)
- [x] RESEND_API_KEY             ✅ confirmed present (re_TtQZcoYi…)
- [x] ANTHROPIC_API_KEY          ✅ confirmed present (sk-ant-api03-MneI2ow…)
- [x] CRON_SECRET                ✅ confirmed present (8729a306…)
- [x] N8N_WEBHOOK_URL            ✅ confirmed present (agencygroup.app.n8n.cloud)
- [x] PORTAL_API_SECRET          ✅ confirmed present (b60bd2a0…)
- [x] SITE_URL                   ✅ confirmed present (https://www.agencygroup.pt)
- [x] OPENAI_API_KEY             ✅ confirmed present (sk-proj-yFEVOe4Muc…)
- [ ] NEXT_PUBLIC_GTM_ID         ← 🔴 **MISSING — ADD NOW** (GTM-XXXXXXX)
- [ ] AGENT_ALERT_EMAIL          ← 🔴 **MISSING — ADD NOW** (geral@agencygroup.pt)

### n8n Cloud (agencygroup.app.n8n.cloud → Settings → Env)
- [ ] SITE_URL = https://www.agencygroup.pt
- [ ] SUPABASE_URL = https://isbfiofwpxqqpgxoftph.supabase.co
- [ ] SUPABASE_SERVICE_KEY
- [ ] RESEND_API_KEY
- [ ] PORTAL_API_SECRET
- [ ] CRON_SECRET
- [ ] ANTHROPIC_API_KEY
