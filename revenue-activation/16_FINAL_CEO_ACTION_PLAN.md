# Phase 16 — Final CEO Action Plan
**Date:** 2026-06-24  
**Author:** Revenue Activation Sprint AI  
**For:** Carlos Feiteira — Agency Group (AMI 22506)

---

## TODAY (2026-06-24) — 3 hours max

### Hour 1: Apollo Enrichment (30 min, $300 investment)
1. Log in: https://app.apollo.io
2. People → Import → Upload CSV
3. Upload: `lead-engine/exports/revenue-activation/apollo/APOLLO_TOP_500_UPLOAD.csv`
4. Map: first_name, last_name, company_name, linkedin_url
5. Start enrichment → go do other tasks while it runs (30 min)

### Hour 1: Vercel Environment Variables (10 min)
1. Go to: https://vercel.com/dashboard → Agency Group → Settings → Environment Variables
2. Add/verify these exist (same values as .env.local):
   - `CRON_SECRET`
   - `RESEND_API_KEY`
   - `NOTION_TOKEN`
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `NOTION_CRM_DB` (if using Notion CRM)

### Hour 2: Start Email Outreach (45 min)
1. Open `LEADS_WITH_EMAIL_117.csv` — sort by lead_score descending
2. Take top 20 (score > 70) — these are your first batch
3. For each:
   - Open LinkedIn URL → Connect with personalized note
   - Send email using template from Phase 09
4. Smartlead/Instantly: import `SMARTLEAD_FIRST_50.csv` for automated sequence

### Hour 2: Add to Notion CRM (15 min)
1. Open Notion: https://www.notion.so/cc52c0eba2df4649ae2b1cb45bb83513
2. Add top 10 leads from `FOUNDER_95_A_PLUS.csv` (those with highest score and clear buying signals)
3. Set status: "FOLLOW_UP_NEEDED"
4. Tomorrow at 9:00 UTC the cron fires and sends first email

### Hour 3: WhatsApp Activation (15 min)
1. Go to: https://developers.facebook.com/apps/
2. Find your app → WhatsApp → API Setup → Generate System User Token
3. Copy token → add to .env.local: `WHATSAPP_ACCESS_TOKEN=<token>`
4. Add to Vercel environment variables
5. Set `WHATSAPP_ACTIVE=true`
6. Test: visit agencygroup.pt/api/whatsapp/test

### Hour 3: LinkedIn Outreach (30 min)
1. Open `FOUNDER_95_A_PLUS.csv`
2. Top 10 leads with LinkedIn URL → open each profile
3. Send connection request with note:
   > "Hi [Name], I'm Carlos from Agency Group (AMI 22506). We specialize in premium Portuguese real estate €500K–€3M. I have exclusive off-market inventory that may interest you. Happy to connect."

---

## THIS WEEK (Day 2-7)

### Day 2: Apollo Results
- Download enriched CSV from Apollo
- Check email count (expect ~150-175 new emails from 500 uploads)
- Update Supabase leads table with new emails
- Expand Smartlead campaign with enriched leads

### Day 3: n8n Railway Deploy (30 min)
- See Phase 05 for step-by-step
- Railway: https://railway.app → New Project → Docker → n8nio/n8n
- First workflow to build: Lead inbound → Supabase contacts

### Day 4-7: Cold Call Blitz
- 5 calls/day from `INVENTORY_CONNECTORS_PORTUGAL.csv`
- Target: architects, lawyers, notaries
- Goal: 2 mandate meetings by end of week

### Day 5: Upload TOP_2500 to Apollo
- After first batch results, upload 2,500 batch
- Expected: ~875 new emails

### Day 7: First Deal Pipeline Review
- Count: LinkedIn connections, email replies, meetings booked
- Adjust messaging based on response rates

---

## NEXT 30 DAYS (Month 1)

| Week | Focus | Target |
|------|-------|--------|
| 1 | Apollo enrichment + first email campaign | 5+ replies |
| 2 | LinkedIn outreach + inventory sourcing calls | 2 meetings + 2 mandates |
| 3 | n8n deployed + follow-up sequences active | 10 follow-ups automated |
| 4 | Second email wave + HeyGen video outreach | 2 more meetings |

**Month 1 Goal: 1 signed CPCV = €37,500 commission**

---

## IGNORE FOR 90 DAYS
- Any new feature development
- Spain market (Portugal first)
- White-label platform
- ML improvements
- Agent recruitment (solo until 3 deals closed)
- New API routes (system already has 542)

---

## One-Line North Star
**Revenue = Leads with Email × Outreach × Conversion. Today's job: maximize the first two.**

---

## Key Files
- Leads: `lead-engine/exports/revenue-activation/FOUNDER_95_A_PLUS.csv`
- Apollo: `lead-engine/exports/revenue-activation/apollo/APOLLO_TOP_500_UPLOAD.csv`
- Campaign: `revenue-activation/09_SMARTLEAD_CAMPAIGN_READINESS.md`
- n8n: `revenue-activation/05_N8N_RAILWAY_DEPLOYMENT.md`
- Inventory: `revenue-activation/10_INVENTORY_SOURCING_OS.md`
