# CRM IMPORT RUNBOOK
Agency Group | 2026-06-05

---

## WHAT THIS DOES
Imports 7,342 contacts from MASTER_CRM_DATABASE.xlsx into Supabase capital_profiles table.

## PRE-REQUISITES

### Step 1: Apply Migration 000155 (schema extension)
Run this SQL in Supabase Dashboard SQL Editor:
Copy from: supabase/migrations/000155_capital_profiles_crm_extension.sql

This adds 30 CRM fields to capital_profiles without breaking anything.

### Step 2: Also apply migrations 000149-000154 if not done
Run RUN_WAVE52_SUPABASE.sql + the individual SQL files.

### Step 3: Install xlsx package (for import script)
```bash
npm install xlsx
```

## RUN IMPORT

### Dry run first (REQUIRED before real import)
```bash
DRY_RUN=true npx tsx scripts/import-crm-final.ts
```
Expected output: "Would import: 7,315 records" (after filtering duplicates/DNC)

### Real import
```bash
NEXT_PUBLIC_SUPABASE_URL=[your Supabase URL from .env.local] \
SUPABASE_SERVICE_ROLE_KEY=[your service role key from .env.local] \
DEFAULT_TENANT_ID=00000000-0000-0000-0000-000000000001 \
npx tsx scripts/import-crm-final.ts
```

## SAFETY RULES
- Script uses ON CONFLICT DO NOTHING — never overwrites
- DO_NOT_CONTACT contacts are filtered out
- IS_DUPLICATE contacts are filtered out
- Batches of 100 — if fails partway, safe to re-run
- Log written to logs/crm-import-{date}.json

## POST-IMPORT VALIDATION
After import, verify in Supabase SQL Editor:
```sql
SELECT COUNT(*) FROM capital_profiles;
SELECT tier, COUNT(*) FROM capital_profiles GROUP BY tier ORDER BY 2 DESC;
SELECT crm_pipeline, COUNT(*) FROM capital_profiles GROUP BY 1;
```

Expected:
- total: ~7,315 (minus DNC and duplicates)
- Tier C: ~3,089 | B: ~2,090 | A: ~1,571 | A+: ~73 | D: ~519
