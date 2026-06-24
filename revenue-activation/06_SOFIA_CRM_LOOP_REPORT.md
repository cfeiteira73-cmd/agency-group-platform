# Phase 06 — Sofia → CRM Loop
**Date:** 2026-06-24  
**Status:** ⚠️ CODE READY — TRAFFIC NEEDED

## Sofia Conversation Persistence
**Code:** `app/api/sofia/chat/route.ts:338-351`  
**Status:** ✅ Implemented and correctly wired

Sofia persists every conversation turn to `sofia_conversations` table:
```typescript
;(supabaseAdmin as any)
  .from('sofia_conversations')
  .insert({
    session_id, user_message, assistant_message,
    mode, user_ip, property_ref, context
  })
```
**Why 0 rows:** No real users have chatted with Sofia yet. The site needs traffic.

## Follow-up Cron
**Code:** `app/api/cron/followups/route.ts`  
**Schedule:** `0 9 * * *` (9:00 UTC daily)  
**Status:** ⚠️ Reads from Notion CRM (not Supabase)

### How It Works
1. Reads contacts from Notion database `NOTION_CRM_DB` (ID: `385a010f...`)
2. Filters for contacts needing follow-up (status logic)
3. Sends personalized email via Resend
4. Marks sent in Notion + Redis idempotency key (prevents double-send)

### Why It Fires 0 Emails Today
- Notion CRM database is empty (or has 0 contacts due for follow-up)
- OR `NOTION_CRM_DB` env var is not set in Vercel (only in .env.local)

## CRM Loop Gap: Sofia → Supabase contacts Table
There is NO automatic pipeline from `sofia_conversations` → `contacts` table.
Sofia logs conversations but does NOT create CRM contacts.

### The Missing Bridge (to build or n8n)
```
sofia_conversations (logged)
  → [n8n workflow OR new API] 
  → contacts table (create/upsert)
  → crm_tasks (schedule follow-up)
  → cron/followups (fire email)
```

## What's Working Right Now
| Component | Status |
|-----------|--------|
| Sofia AI (chat) | ✅ Live and working |
| Sofia → sofia_conversations | ✅ Coded, waiting for traffic |
| sofia_conversations → contacts | ❌ Bridge missing |
| contacts → cron followup | ✅ Cron exists, needs Notion data |
| Notion CRM → email | ✅ Coded, needs Notion contacts |

## Actions Required (Priority Order)

### IMMEDIATE (Carlos):
1. Add A+ leads manually to Notion CRM: https://www.notion.so/cc52c0eba2df4649ae2b1cb45bb83513
   - Add from `FOUNDER_95_A_PLUS.csv` — top 10-20 A+ leads with email
   - Set status to "FOLLOW_UP_NEEDED"
   - This triggers tomorrow's 9:00 UTC cron to send real emails

2. Verify `NOTION_CRM_DB` env var is set in Vercel dashboard

### NEXT WEEK (code fix — optional):
Build a Sofia → Supabase contacts bridge so conversations auto-create CRM contacts.

## Verdict
Sofia is conversation-ready. CRM loop needs Notion population to fire. n8n bridges the gap long-term.
