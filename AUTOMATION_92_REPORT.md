# AUTOMATION 92 REPORT
Agency Group | Phase 8 | 2026-06-06

---

## CURRENT STATE: 58/100

### Confirmed
- vercel.json: 41 cron jobs defined
- n8n-workflows/: 12 workflow JSON files
- Resend email: API key configured
- WhatsApp: credentials configured (inactive)
- Cron routes: all 41 exist in app/api/

### NOT Confirmed
- Cron execution: Cannot verify without Vercel dashboard access
- n8n deployment: Only local Docker (docker-compose.yml), not cloud
- n8n cloud: Trial expired (confirmed in MEMORY.md)
- Email sequences: 0 running

---

## CRON INVENTORY

| Category | Count | Frequency |
|----------|-------|-----------|
| Self-healing | 3 | Every 5 min |
| Worker processor | 1 | Every 5 min |
| Incident detection | 1 | Every 5 min |
| Anomaly monitor | 1 | Every 5 min |
| Graph refresh | 1 | Every 30 min |
| Drift capture | 1 | Hourly |
| Health check | 1 | Hourly |
| KPI snapshot | 1 | Hourly |
| Data pipeline | 14 | Daily |
| Reporting | 3 | Weekdays |
| Market analysis | 4 | Daily/Weekly |
| Revenue | 3 | 3x/day |
| **Total** | **41** | — |

---

## N8N WORKFLOWS INVENTORY

| Workflow | Purpose | Status |
|----------|---------|--------|
| workflow-a-lead-inbound.json | New lead processing | LOCAL ONLY |
| workflow-a-lead-enrichment.json | Lead data enrichment | LOCAL ONLY |
| workflow-b-lead-scoring.json | Scoring engine | LOCAL ONLY |
| workflow-b-daily-report.json | Daily summary | LOCAL ONLY |
| workflow-c-dormant-lead.json | Re-engagement | LOCAL ONLY |
| workflow-d-investor-alert.json | Investment alerts | LOCAL ONLY |
| workflow-e-vendor-report.json | Seller reports | LOCAL ONLY |
| workflow-h-score-high-alert.json | High score alerts | LOCAL ONLY |
| workflow-i-followup-auto.json | Follow-up automation | LOCAL ONLY |
| post-close-automation.json | Post-deal workflow | LOCAL ONLY |
| property-ai-live-notification.json | Property alerts | LOCAL ONLY |
| wf_g_current.json | General workflow | LOCAL ONLY |

**ALL 12 workflows are LOCAL ONLY — not in production.**

---

## GAPS TO 75 (Internal Max)

### Gap 1: n8n Not in Production (Critical — Impact: -12)
**Fix:** Deploy to Railway free tier  
**Steps:**
1. Create Railway account (free)
2. New project → Deploy from Docker
3. Use n8n-workflows/Dockerfile.n8n
4. Import 12 workflows via n8n UI
5. Configure Supabase + Resend + WhatsApp credentials

**Time:** 3-4 hours  
**Cost:** €0 (Railway free tier for first project)  
**Carlos can do this alone? YES**

### Gap 2: Cron Execution Not Verified (Impact: -5)
**Fix:** 
1. Log into Vercel dashboard
2. Go to project → Logs → Filter by cron
3. Confirm at least /api/cron/health-check ran in last 24h

**Time:** 5 minutes  
**Carlos can do this alone? YES**

### Gap 3: No Email Sequences Running (Impact: -5)
**Fix:** Configure first Resend sequence in Sofia  
**Prerequisite:** n8n deployment + 10 contacts with email

---

## GAPS TO 92 (Market Max)

1. n8n cloud with full workflow activation
2. All 41 crons monitored with success/failure alerts
3. WhatsApp automated sequences
4. Email sequences on 500+ contacts
5. Lead scoring pipeline running daily
6. Automated weekly investor reports

---

## DEAD LOGIC IDENTIFIED

- `/api/automation/alert-check-sent/route.ts` — may reference deleted table
- `/api/automation/nurture-candidates/route.ts` — references schema that may have changed

**Impact:** Low (secondary automation routes, not core)  
**Recommendation:** Fix when applying W54-W58 migrations
