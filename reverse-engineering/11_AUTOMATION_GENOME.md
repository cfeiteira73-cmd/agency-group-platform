# 11 — AUTOMATION GENOME
**Agency Group | Ultimate Reverse Engineering Audit | 2026-06-14**

---

## AUTOMATION LANDSCAPE

```
CONFIGURED AUTOMATION:
  Vercel crons: 41 jobs scheduled
  n8n workflows: 11 JSON files
  Total automation configured: 52 pieces

RUNNING AUTOMATION:
  Vercel crons: 1 confirmed (kpi-snapshot)
  n8n workflows: 0 deployed
  Total automation running: 1

AUTOMATION GAP: 51 of 52 unconfirmed or inactive
```

---

## VERCEL CRON JOBS (41 total)

### CONFIRMED RUNNING
| Job | Schedule | Evidence | Output |
|-----|----------|---------|--------|
| /api/cron/kpi-snapshot | Daily 23:55 UTC | 50 rows in kpi_snapshots | ✅ CONFIRMED |

### HIGH-PRIORITY UNCONFIRMED (assumed running, no direct evidence)
| Job | Schedule | Purpose | Risk if failing |
|-----|----------|---------|----------------|
| /api/cron/gdpr-purge | Daily 03:00 | GDPR compliance | HIGH — regulatory |
| /api/cron/lead-score | Mon-Fri 06:15 | Score leads | MEDIUM |
| /api/cron/match-buyer | Mon-Fri 06:30 | Match properties | MEDIUM |
| /api/cron/avm-daily | Daily 07:00 | Property valuations | LOW (0 real props) |
| /api/cron/daily-brief | Daily 07:30 | Sofia daily brief | LOW |

### MEDIUM-PRIORITY UNCONFIRMED
| Job | Schedule | Purpose |
|-----|----------|---------|
| /api/cron/revenue-loop | 3x daily | Revenue engine |
| /api/cron/weekly-report | Mon 08:00 | Agent reports |
| /api/cron/health-check | Every 15 min | System health |
| /api/cron/embedding-refresh | Weekly | Property embeddings |
| Other 30 crons | Various | Various |

**Why unconfirmed**: No observable side-effects in DB (no new rows, no changes in non-kpi tables).

---

## N8N WORKFLOWS (11 — ALL LOCAL ONLY)

### CRITICAL (Revenue-blocking if not deployed)
| Workflow | Purpose | Impact |
|----------|---------|--------|
| lead-inbound.json | New lead → qualify → route | CRITICAL |
| cpcv-followup.json | After CPCV → coordinate closing | CRITICAL |
| capital-outreach.json | Email sequences to capital_profiles | CRITICAL |

### HIGH (Revenue-supporting)
| Workflow | Purpose | Impact |
|----------|---------|--------|
| dormant-reactivation.json | Re-engage dormant contacts | HIGH |
| visit-coordination.json | Schedule property viewings | HIGH |
| investor-alert.json | Alert when matching property found | HIGH |
| developer-pipeline.json | Developer relationship management | HIGH |
| kyc-verification.json | KYC compliance workflow | HIGH |

### MEDIUM
| Workflow | Purpose | Impact |
|----------|---------|--------|
| vendor-report.json | Weekly vendor updates | MEDIUM |
| whatsapp-handoff.json | Sofia → human escalation | MEDIUM |
| analytics-digest.json | Weekly KPI email | LOW |

### n8n Deployment Status
```
Deployment: LOCAL ONLY
Location:   agency-group/n8n-workflows/*.json
n8n server: NOT DEPLOYED
Railway:    Not configured
n8n Cloud:  Trial expired (per memory)

TO DEPLOY:
  1. Create Railway account (or n8n Cloud)
  2. Add Railway project with n8n template
  3. Upload 11 workflow files
  4. Configure credentials (Supabase, Resend, Twilio)
  5. Activate key sequences (capital-outreach first)

TIME:     4 hours
COST:     €15-20/month (Railway)
IMPACT:   Unlocks outreach_queue (3,120 contacts waiting)
```

---

## EMAIL AUTOMATION (Resend)

```
API Key:    RESEND_API_KEY (configured)
Provider:   Resend
Free tier:  3,000 emails/month
Templates:  lib/templates/emailTemplates.ts (built)

SEQUENCES CONFIGURED:
  1. Lead welcome sequence (3 emails, 7 days)
  2. Property alert (single email)
  3. Follow-up sequence (3-touch, 14 days)
  4. CPCV confirmation
  5. Weekly investor digest
  6. Monthly market report

EMAILS SENT: 0

To send first email:
  Option A: n8n deployed (runs sequences automatically)
  Option B: Manual via Resend dashboard (67 contacts today)
  Option C: /api/automation/email-sequence (POST, trigger manually)
```

---

## WHATSAPP AUTOMATION

```
Provider:   Twilio WhatsApp Business
Webhook:    /api/whatsapp/webhook ← FIXED (timingSafeEqual bug)
Status:     BUILT BUT INACTIVE
Env var:    WHATSAPP_ACTIVE (NOT SET)

TO ACTIVATE:
  1. Set WHATSAPP_ACTIVE=true in Vercel env vars
  2. In Meta Business Manager:
     - Add webhook URL: https://agencygroup.pt/api/whatsapp/webhook
     - Set verify token (matches WHATSAPP_VERIFY_TOKEN)
     - Subscribe to messages, message_status events
  3. Test with WhatsApp message to business number
  
TIME: 2-4 hours
COST: €0 (Twilio charges per message, not setup)
IMPACT: New channel for lead qualification via Sofia
```

---

## PUSH NOTIFICATIONS

```
System:   Web Push (VAPID)
Package:  web-push ^3.6.7
Keys:     VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY (configured)
Tables:   push_subscriptions: 0 rows, notifications: 0 rows
Status:   BUILT, 0 subscribers

USE CASE:
  1. Sofia generates high-score match → Push to Carlos
  2. New lead replies to email → Push to Carlos
  3. AVM alert (price change in zone) → Push to Carlos
  
TO ENABLE:
  1. User visits portal → Browser prompts for push permission
  2. User accepts → push_subscriptions row created
  3. Next event → push sent
  
TIME: 0 (already built, just needs portal login + accept)
```

---

## AUTOMATION READINESS MATRIX

| Component | Built | Deployed | Running | Revenue Impact |
|-----------|-------|---------|---------|---------------|
| kpi-snapshot cron | ✅ | ✅ | ✅ | Monitoring only |
| Lead scoring cron | ✅ | ✅ | ❓ | Medium |
| n8n email sequences | ✅ | ❌ | ❌ | CRITICAL |
| WhatsApp handler | ✅ | ✅ | ❌ | High |
| Push notifications | ✅ | ✅ | ❌ | Low |
| GDPR purge cron | ✅ | ✅ | ❓ | Compliance |
| Revenue loop cron | ✅ | ✅ | ❓ | Medium |
| Email sequences | ✅ | ❌ | ❌ | CRITICAL |
| AVM daily cron | ✅ | ✅ | ❓ | Low |
| Match buyer cron | ✅ | ✅ | ❓ | Medium |

---

## AUTOMATION GAPS RANKED BY REVENUE IMPACT

1. **n8n email sequences** — Deploy to Railway (4h work) → 3,120 contacts get outreach
2. **WhatsApp activation** — Set env var + Meta webhook (2h work) → New buyer channel
3. **First email campaign** — Manual or Resend dashboard (60 min) → Immediate
4. **Push notifications** — Already built, just login (5 min) → Carlos alerts

---

*Evidence: vercel.json (41 crons), n8n-workflows/ (11 files), kpi_snapshots (50 rows), forensic-inventory/11_AUTOMATION_MAP.md*
