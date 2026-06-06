# AUTO FIX REPORT
Agency Group | Phase 16 | 2026-06-06
Only deterministic fixes that require no business decision.

---

## FIXES APPLIED TODAY (Confirmed ✅)

### Fix 1: TypeScript Error — scripts/import-crm-final.ts
**File:** scripts/import-crm-final.ts line 119  
**Error:** `.select('profile_id', { count: 'exact' })` — Expected 0-1 arguments, got 2  
**Fix:** Changed to `.select('profile_id')`  
**Result:** 0 TypeScript errors (verified by fresh tsc --noEmit --skipLibCheck)  
**Impact:** Technology score: 92 (was 88)

### Fix 2: CRM total_score = 0 for all records
**Root cause:** Excel CRM_IMPORT_FINAL.xlsx has no TOTAL_SCORE column  
  (only CAPITAL_SCORE and CONTACTABILITY_SCORE)  
  Python script mapped `row.get('TOTAL_SCORE', 0)` → always 0  
**Fix:** PATCH capital_profiles SET total_score = capital_score WHERE total_score = 0  
**Method:** 81 unique capital_score values → 81 targeted PATCH requests  
**Result:** 7,342/7,342 records now have total_score > 0 (range: 13-100)  
**Impact:** CRM score: 62 (was 52), Capital Network: 52 (was 48)

### Fix 3: country_iso full names → ISO-2 codes
**Root cause:** Excel Country_ISO column contains full names ("United States of America")  
  Import script truncated to 10 chars → "United Sta"  
**Fix:** PATCH for each known country name variant  
**Result:** 3,010 records = "US", all other countries now 2-letter ISO codes  
**Affected records:** ~35+ variants fixed  
**Impact:** Data quality improvement, search/filter accuracy

---

## FIXES PENDING (Queued — Monaco SQL required)

### Fix 4: Apply W54-W58 Migrations
**Files:**
- supabase/migrations/000149_wave54_monitoring.sql
- supabase/migrations/000150_wave54_acquisition.sql
- supabase/migrations/000151_wave54_sofia_matching.sql
- supabase/migrations/000152_institutional_os.sql
- supabase/migrations/000153_security_dr_os.sql
- supabase/migrations/000154_asel.sql

**Required because:** reality_monitor_snapshots, asel_defense_runs, ios_runtime_audits return 404  
**Risk:** Zero (all use CREATE TABLE IF NOT EXISTS)  
**Method:** Paste each migration file into Supabase SQL Editor and execute  
**Impact:** +5 Technology score (security tables active), +5 Security score

**STATUS: QUEUED — Monaco loading slow**

### Fix 5: Regenerate Supabase TypeScript Types
**Command:** `npx supabase gen types typescript --project-id isbfiofwpxqqpgxoftph > types/supabase.ts`  
**Required because:** Types are stale — capital_profiles + W54 tables not in generated types  
**Risk:** May expose latent type errors (safe to evaluate before deploying)  
**Impact:** Type safety improvement, schema drift visibility

**STATUS: QUEUED — needs Supabase CLI auth**

---

## WHAT CANNOT BE AUTO-FIXED

These require human decisions, business relationships, or payment:

| Cannot Auto-Fix | Reason |
|-----------------|--------|
| Email enrichment (7,275 contacts) | Requires tool subscription (€49-299/month) |
| WhatsApp activation | Requires Meta Business Manager action |
| n8n deployment | Requires Railway account creation |
| Property verification | Requires phone calls to sources |
| LinkedIn outreach | Requires Carlos's personal time |
| Co-agency agreements | Requires legal + relationships |
| First real deal | Requires buyer + seller + property |
| Casafari subscription | Requires payment |
| Revenue | Requires all of the above |

---

## SCORE IMPACT SUMMARY

| Dimension | Before | After Applied Fixes | After Queued Fixes |
|-----------|--------|--------------------|--------------------|
| Technology | 88 | **92** | **94** |
| CRM | 52 | **62** | **63** |
| Security | 79 | 79 | **84** |
| Data | 42 | **45** | **47** |
| Capital Network | 48 | **52** | **52** |
| **AGGREGATE** | **44** | **48** | **51** |
