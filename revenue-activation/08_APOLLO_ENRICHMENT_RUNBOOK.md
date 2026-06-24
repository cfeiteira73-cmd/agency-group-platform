# Phase 08 — Apollo Enrichment Runbook
**Date:** 2026-06-24  
**Status:** ⚠️ CARLOS ACTION — READY TO EXECUTE

## Apollo Credentials
- `APOLLO_API_KEY` = `bjPrwVZGUC38BlZarepA2g` (confirmed in lead-engine/.env)
- Apollo account must have credits. Verify at: https://app.apollo.io/settings/billing

## What Apollo Does
- Takes: `full_name` + `company_name` (+ optionally `linkedin_url`)
- Returns: verified business email + phone + additional enrichment
- Hit rate: ~30-40% on LinkedIn leads
- Cost: varies by plan — check credits before uploading 2,500 leads

## Option A: Apollo UI Upload (Fastest — No Code)

### Step-by-Step
1. Log in at https://app.apollo.io
2. Go to **People** → **Import** → **Upload CSV**
3. Upload `TOP_500_APOLLO_ENRICHMENT.csv` (500 rows — start small)
4. Map columns:
   - `full_name` → First + Last Name
   - `company` → Company Name  
   - `linkedin_url` → LinkedIn URL
   - `email` → Existing Email (to skip already enriched)
5. Click **Import & Enrich**
6. Wait 5-30 min for enrichment
7. Export → Download CSV with emails

### Files to Upload (in order):
| Batch | File | Rows | Expected emails (~35%) |
|-------|------|------|------------------------|
| 1 | `TOP_500_APOLLO_ENRICHMENT.csv` | 500 | ~175 |
| 2 | `TOP_1000_APOLLO_ENRICHMENT.csv` | 1,000 | ~350 |
| 3 | `TOP_2500_APOLLO_ENRICHMENT.csv` | 2,500 | ~875 |

**Total expected new emails: ~900-1,400**

## Option B: Apollo API (Automated — Better)

Apollo API key is already in lead-engine/.env. The Hunter enricher in lead-engine also works.

```bash
# Test Apollo API connectivity:
curl -X POST https://api.apollo.io/api/v1/people/match \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "bjPrwVZGUC38BlZarepA2g",
    "first_name": "Russell",
    "last_name": "Deakin",
    "organization_name": "Aceana Group",
    "reveal_personal_emails": false
  }'
```

## After Enrichment: Update Supabase

Once you have enriched CSVs from Apollo:

### Via Supabase SQL Editor
```sql
-- Update email for a specific lead (run per row or via bulk import)
UPDATE leads
SET email = '<email-from-apollo>',
    email_status = 'verified',
    email_source = 'apollo',
    updated_at = now()
WHERE dedup_key = '<dedup_key-from-csv>'
  AND (email IS NULL OR email = '');
```

### Via Lead Engine Script (Preferred)
A bulk update script can be written to take the enriched CSV and update the DB in batch.

## Priority After Enrichment
1. **Immediately launch** `SMARTLEAD_FIRST_50.csv` campaign (with enriched emails)
2. Move top A+ enriched leads to Notion CRM for personal outreach
3. Load remaining into Smartlead sequences

## Expected Revenue Math
- 1,000 enriched emails × 3% reply rate = 30 replies
- 30 replies × 20% meeting conversion = 6 meetings
- 6 meetings × 15% deal rate = 0.9 deals
- 0.9 deals × €750K avg × 5% commission = **€33,750 commission**
- Timeline: 60-90 days from today

## Verdict
Apollo enrichment is the **#1 revenue-unlocking action**. $300 investment. Do this TODAY.
