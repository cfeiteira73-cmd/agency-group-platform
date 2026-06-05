# CRM POST-IMPORT VALIDATION
Agency Group | 2026-06-05

---

## TO RUN AFTER IMPORT

### Verify row counts (SQL)
```sql
-- Total
SELECT COUNT(*) AS total FROM capital_profiles;
-- Expected: ~7,315

-- By tier
SELECT tier, COUNT(*) FROM capital_profiles WHERE tier IS NOT NULL GROUP BY tier ORDER BY COUNT(*) DESC;

-- By pipeline
SELECT crm_pipeline, COUNT(*) FROM capital_profiles GROUP BY 1;

-- By persona
SELECT persona_type, COUNT(*) FROM capital_profiles WHERE persona_type IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 10;

-- Family offices
SELECT COUNT(*) FROM capital_profiles WHERE persona_type = 'FAMILY_OFFICE';
-- Expected: ~1,701

-- Carlos owned
SELECT COUNT(*) FROM capital_profiles WHERE owner = 'CARLOS';
-- Expected: ~1,644

-- Founder 25 check
SELECT COUNT(*) FROM capital_profiles WHERE tier = 'A+';
-- Expected: 73
```

### Verify Sofia can access
```
POST /api/matching/capital
Authorization: Bearer [INTERNAL_API_SECRET]
```
Expected: total_matches > 0 (once assets added)

### Verify newsletter segments
```sql
SELECT newsletter_segment, COUNT(*) FROM capital_profiles GROUP BY 1 ORDER BY 2 DESC;
-- Expected: 14 segments, all populated
```

---

## CURRENT STATUS (before import)
- capital_profiles rows: EMPTY
- contacts imported: 0
- Status: NOT_IMPORTED

## EXPECTED STATUS (after import)
- capital_profiles rows: ~7,315
- All CRM fields populated
- Sofia matching engine operational
- Newsletter segments available
- Founder 25 identifiable by tier=A+
