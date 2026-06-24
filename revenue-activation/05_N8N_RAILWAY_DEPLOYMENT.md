# Phase 05 — n8n Railway Deployment Readiness
**Date:** 2026-06-24  
**Status:** ⚠️ NOT DEPLOYED — CARLOS ACTION REQUIRED

## Current State
- n8n NOT deployed (confirmed from prior audits)
- n8n local instance: `http://localhost:5678` — pwd `AgGroup2026!`
- n8n Cloud: Trial expired

## Deploy n8n on Railway (Recommended Path)

### Step 1: Railway Setup (10 min)
1. Go to https://railway.app
2. New Project → Deploy from Docker Image
3. Image: `n8nio/n8n:latest`
4. Set environment variables:
   ```
   N8N_BASIC_AUTH_ACTIVE=true
   N8N_BASIC_AUTH_USER=carlos
   N8N_BASIC_AUTH_PASSWORD=<strong-password>
   DB_TYPE=postgresdb
   DB_POSTGRESDB_HOST=<Railway Postgres host>
   DB_POSTGRESDB_PORT=5432
   DB_POSTGRESDB_DATABASE=n8n
   DB_POSTGRESDB_USER=<user>
   DB_POSTGRESDB_PASSWORD=<password>
   WEBHOOK_URL=https://<your-railway-domain>
   N8N_HOST=0.0.0.0
   N8N_PORT=5678
   ```
5. Add Railway Postgres plugin → get connection string

### Step 2: Core Workflows to Activate First

| Workflow | Trigger | Action | Revenue Impact |
|----------|---------|--------|----------------|
| Lead Inbound → CRM | Webhook or cron | Score + insert to contacts | HIGH |
| Sofia Follow-up Loop | Schedule (daily) | Create crm_tasks from sofia_conversations | HIGH |
| Dormant Lead Revival | Weekly cron | Re-engage B/C leads with email | MEDIUM |
| Vendor Report | Weekly | WhatsApp/email to property owners | MEDIUM |
| Investor Alert | Score threshold | Alert Carlos of A+ new leads | HIGH |

### Step 3: Connect Agency Group → n8n
In agency-group `.env.local` (already present pattern):
```
N8N_WEBHOOK_URL=https://<railway-domain>/webhook/
```

### Step 4: Sofia → CRM Loop (Priority Workflow)
```
Sofia conversation ends
  → POST /api/crm/create-task (existing route)
  → n8n webhook picks up
  → Creates contact in Supabase contacts table
  → Schedules follow-up email via Resend
  → Logs to crm_tasks
```

## Monthly Cost
- Railway Hobby: $5/month + compute (~$10-15/month total)
- Much cheaper than n8n Cloud ($20+/month)

## Existing Workflow JSON Files
Check `C:\Users\Carlos\agency-group\revenue-activation\n8n\` for any exported workflows.

## Verdict
n8n is the #2 infrastructure gap after Apollo. **15-30 min to deploy.** Highest ROI is the Sofia → CRM follow-up loop.
