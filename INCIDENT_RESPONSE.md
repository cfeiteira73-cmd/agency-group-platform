# AGENCY GROUP — INCIDENT RESPONSE
**Last updated: 2026-09-03 | AMI: 22506**

---

## SEVERITY LEVELS

| Level | Definition | Response Time | Owner |
|-------|-----------|--------------|-------|
| SEV-0 | Site down OR data exposed OR legal breach | Immediate | Carlos |
| SEV-1 | Lead loss OR payment failure OR wrong listing published | < 1h | Carlos |
| SEV-2 | Feature broken OR sync failure OR AI error visible | < 4h | Carlos/Tech |
| SEV-3 | Performance degradation OR non-critical bug | < 24h | Tech |

---

## INCIDENT SCENARIOS

### SCENARIO 1 — Site Outage (Vercel down)
1. Check https://vercel-status.com
2. Check Vercel dashboard for deployment errors
3. If Vercel issue: wait + monitor (SLA 99.99%)
4. If our code: identify last deployment, revert to previous
5. Communicate to active clients via WhatsApp/email manually
6. Log incident + root cause

### SCENARIO 2 — Lead Form Not Working
**Risk: Highest commercial impact — lost leads = lost revenue**
1. Test form immediately on mobile + desktop
2. Check Supabase `leads` table for recent inserts
3. Check Resend for email notifications
4. If broken: set up temporary WhatsApp/email catch manually
5. Fix within 2h maximum
6. Verify fix with test submission

### SCENARIO 3 — Confidential Property Exposed Publicly
**Risk: Legal, trust, mandate loss**
1. Immediately set property to PRIVATE in Supabase
2. Check Google cache — request removal via Search Console
3. Contact property owner immediately to inform
4. Review how exposure happened (bug or human error)
5. Audit all other private/confidential listings

### SCENARIO 4 — Wrong Price Published
**Risk: Trust, legal, commercial**
1. Correct in Supabase immediately
2. Verify site reflects correction within 5 minutes
3. If client saw wrong price: contact and clarify
4. Document: what was wrong, why, how fixed

### SCENARIO 5 — Data Exposure (Supabase breach or RLS failure)
**Risk: GDPR, legal, existential**
1. Immediately assess scope: what data, how many records
2. Disable affected API routes temporarily if needed
3. Contact legal advisor within 24h
4. GDPR notification to CNPD within 72h if required
5. Notify affected clients per legal guidance
6. Full security audit before re-enabling

### SCENARIO 6 — Sofia AI Hallucination (false claim to client)
**Risk: Trust, legal, mandate loss**
1. Identify what was said and to whom
2. Contact client immediately to correct
3. Review Sofia prompt and tools for source of error
4. If systemic: disable Sofia until fixed
5. Never allow AI to autonomously make legal/financial claims

### SCENARIO 7 — Email Deliverability Failure (Resend)
**Risk: Lost client communications**
1. Check Resend dashboard for failures/bounces
2. Verify SPF/DKIM still passing
3. If key issue: rotate key (Resend dashboard → new key → update Vercel)
4. Test with manual email immediately after fix
5. Monitor for 24h

### SCENARIO 8 — n8n Automation Runaway
**Risk: Spam to clients, duplicate messages**
1. Disable affected n8n workflow immediately
2. Identify root cause (trigger loop, webhook duplicate, etc.)
3. Audit what was sent and to whom
4. Manual cleanup if needed (contact clients who received duplicates)
5. Fix workflow, test with single record before re-enabling

---

## POST-MORTEM TEMPLATE

After any SEV-0 or SEV-1:

```
INCIDENT: [name]
DATE/TIME: 
DURATION: 
SEVERITY: 
DETECTED BY: 
RESOLVED BY: 

WHAT HAPPENED:
WHY IT HAPPENED (ROOT CAUSE):
BUSINESS IMPACT:
TECHNICAL IMPACT:
CLIENT IMPACT:

IMMEDIATE FIX:
PERMANENT FIX:
PREVENTION:

WHAT WE LEARNED:
```

---

## CONTACTS

| Situation | Contact |
|-----------|---------|
| Legal issue | Advogado (TBD — define before first transaction) |
| Supabase emergency | support@supabase.io |
| Vercel emergency | support@vercel.com |
| GDPR breach notification | cnpd.pt |
| AMI compliance question | IMPIC (impic.pt) |
