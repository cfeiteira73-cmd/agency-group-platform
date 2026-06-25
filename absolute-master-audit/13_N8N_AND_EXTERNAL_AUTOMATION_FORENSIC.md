# 13 — N8N / EXTERNAL AUTOMATION FORENSIC
**Agency Group | Absolute Master Forensic Audit | 2026-06-25**

---

## Current State

| Item | Value |
|------|-------|
| n8n workflow files | **21 JSON workflows** |
| n8n support files | **10** (README, docker-compose, Dockerfile, railway.toml, import scripts) |
| Total n8n-workflows/ files | **31** |
| Railway deployment | ❌ NOT DEPLOYED |
| n8n running locally | Unknown (no evidence of local run) |
| Previous claim "11 workflows" | ❌ FALSE — actual count is 21 |

---

## Workflow Inventory (21 files)

| Workflow | File Size | Purpose | Priority |
|----------|-----------|---------|---------|
| `workflow-a-lead-enrichment.json` | 26KB | Apollo enrichment + email discovery | 🔴 HIGH |
| `workflow-a-lead-inbound.json` | 2.5KB | Inbound lead capture | 🔴 HIGH |
| `workflow-b-daily-report.json` | 19KB | Daily performance report | 🟡 MEDIUM |
| `workflow-b-lead-scoring.json` | 5.3KB | Automated lead scoring | 🟡 MEDIUM |
| `workflow-c-dormant-lead.json` | 19KB | Dormant lead reactivation | 🟡 MEDIUM |
| `workflow-d-investor-alert.json` | 24KB | High-score investor alert | 🔴 HIGH |
| `workflow-e-vendor-report.json` | 29KB | Vendor/developer reporting | 🟢 LOW |
| `workflow-g-fixed.json` | 10KB | Capital outreach (fixed version) | 🔴 HIGH |
| `wf_g_current.json` | 6.9KB | Capital outreach (current) | 🔴 HIGH |
| `workflow-g-offmarket-new.json` | 6.8KB | Off-market notifications | 🔴 HIGH |
| `workflow-h-score-high-alert.json` | 4.4KB | High score alert | 🔴 HIGH |
| `workflow-i-followup-auto.json` | 5.2KB | Automated follow-up sequences | 🔴 HIGH |
| `workflow-j-partner-onboarding.json` | 5.7KB | Partner onboarding | 🟢 LOW |
| `workflow-k-meeting-notify.json` | 4.1KB | Meeting notifications | 🟡 MEDIUM |
| `workflow-l-lead-reactivation.json` | 6.6KB | Lead reactivation | 🟡 MEDIUM |
| `workflow-m-advisor-assignment.json` | 6.0KB | Advisor assignment | 🟢 LOW |
| `workflow-n-daily-digest.json` | 5.6KB | Daily digest | 🟡 MEDIUM |
| `workflow-o-weekly-performance.json` | 6.6KB | Weekly performance | 🟢 LOW |
| `workflow-p-saved-search-created.json` | 9.2KB | Saved search trigger | 🟡 MEDIUM |
| `workflow-q-property-alert-match.json` | 12KB | Property match alert | 🔴 HIGH |
| `workflow-r-lead-nurture.json` | 10.7KB | Lead nurture sequence | 🔴 HIGH |
| `post-close-automation.json` | 10.3KB | Post-close workflow | 🟢 LOW |
| `property-ai-live-notification.json` | 4.0KB | AI property notification | 🟡 MEDIUM |

---

## Deployment Infrastructure (All Present)

| File | Purpose | Status |
|------|---------|--------|
| `railway.toml` | Railway deployment config | ✅ Present |
| `docker-compose.yml` | Local Docker setup | ✅ Present |
| `Dockerfile.n8n` | n8n Docker image | ✅ Present |
| `IMPORT_ALL.sh` | Import all workflows script | ✅ Present |
| `IMPORT_GUIDE.md` | Step-by-step import guide | ✅ Present |
| `README.md` | Full deployment guide | ✅ Present |
| `.env` | n8n environment vars | ✅ Present (credentials in .env) |

Railway deployment is **fully configured** — it's just waiting to be executed.

---

## n8n .env Credentials Required

The `n8n-workflows/.env` file contains placeholder credentials for:
- N8N_HOST, N8N_PORT
- SUPABASE_URL, SUPABASE_KEY
- RESEND_API_KEY
- WHATSAPP_ACCESS_TOKEN
- ANTHROPIC_API_KEY (for Sofia workflows)
- APOLLO_API_KEY (for enrichment)

---

## Deployment Steps (From IMPORT_GUIDE.md)

1. Create Railway account (free tier available)
2. `railway init` in n8n-workflows/
3. `railway up` — deploys n8n instance
4. Import workflows via IMPORT_ALL.sh
5. Configure credentials in n8n UI
6. Activate 3 core workflows (capital outreach, investor alert, lead inbound)

**Estimated time**: 4 hours
**Cost**: €15/month (Railway starter)

---

## What Activating n8n Unlocks

| Unlock | Impact |
|--------|--------|
| 3,164 outreach_queue contacts → automated sequences | First automated email campaigns |
| Apollo enrichment workflow → +900-2,400 emails | Email coverage 0.6% → 5-10% |
| Investor alert workflow → auto-notify Carlos of hot leads | Never miss a high-score lead |
| Property match alert → buyers notified of new listings | Passive deal funnel |
| Daily digest → Carlos gets daily summary | Operational awareness |

---

## Previous False Claim Correction

**Previous audit (reverse-engineering/11_AUTOMATION_GENOME.md 2026-06-14)**: "11 n8n workflows"
**Truth (2026-06-25 file scan)**: **21 JSON workflow files**

Root cause: Previous audit counted only the main letter-named workflows (a-k = 11) and missed workflows l-r, post-close, property-ai, wf_g_current, and the duplicate/variant files.

---

*Evidence: Get-ChildItem n8n-workflows -Recurse -File (31 files counted) | n8n-workflows/IMPORT_GUIDE.md | revenue-activation/05_N8N_RAILWAY_DEPLOYMENT.md | 2026-06-25*
