# DATA TRUTH REPORT
Agency Group | Section 6 | 2026-06-06

---

## DATA REALITY

### EMAIL COVERAGE

| Metric | Value |
|--------|-------|
| Total contacts | 7,342 |
| Has email | 67 (0.9%) |
| No email | 7,275 (99.1%) |

**Source of emails:** These 67 emails come from the original CRM build. No enrichment has been done.

### LINKEDIN COVERAGE

All 7,342 contacts have LinkedIn profile URLs. 100% coverage.  
LinkedIn URLs enable: manual outreach, Apollo enrichment, Dropcontact enrichment.

### COUNTRY QUALITY

All country_iso fields are now ISO-2 codes (fixed 2026-06-06).  
No full country names remain. Clean for filtering, routing, and analytics.

### COMPANY FIELD

| Status | Approx Count |
|--------|-------------|
| Has company | ~7,100 (97%) |
| Empty company | ~240 (3%) |

### TITLE FIELD

| Status | Approx Count |
|--------|-------------|
| Has title | ~6,950 (95%) |
| Empty title | ~400 (5%) |

### SCORE DISTRIBUTION

| Metric | Value |
|--------|-------|
| Total with score >0 | 7,342 (100% after fix) |
| Mean total_score | 50.4 |
| Score >80 | 111 |
| Score >50 | 3,493 |
| Max score | 100 |
| Min score | 13 |

### CONTACTABILITY SCORE

| Range | Count |
|-------|-------|
| >70 | 67 |
| 50-70 | ~4,000 |
| <50 | ~3,275 |

---

## DUPLICATE ANALYSIS

| Check | Finding |
|-------|---------|
| lead_id UNIQUE index | Exists — prevents exact duplicates |
| LinkedIn URL duplicates | Unknown (no scan run) |
| Name duplicates | Unknown |
| Email duplicates | Very unlikely (only 67 emails) |

**Recommendation:** Run duplicate check on LinkedIn URLs (primary dedup key).

```sql
SELECT linkedin, COUNT(*) as n 
FROM capital_profiles 
GROUP BY linkedin 
HAVING COUNT(*) > 1 
ORDER BY n DESC 
LIMIT 20;
```

---

## MARKET DATA QUALITY

| Table | Count | Quality |
|-------|-------|---------|
| market_data | 10 | Unknown format |
| properties | 55 | Unverified origin |
| offmarket_leads | 14 | ALL test data |
| kpi_snapshots | 43 | Real (daily cron) |

---

## ENRICHMENT READINESS

All 7,342 contacts have LinkedIn URLs → ready for enrichment tools.

| Tool | Method | Expected yield |
|------|--------|----------------|
| Apollo.io | LinkedIn URL → email | 25-35% |
| Dropcontact | LinkedIn URL → email | 20-30% |
| Hunter.io | Company domain → email | 15-25% |

**Expected from TOP 1,000 (30% yield = 300 new emails)**

---

## BUYING POWER DISTRIBUTION (field analysis)

| Range | Count (approx) |
|-------|---------------|
| €10M–€100M+ | ~73 (A+ tier) |
| €2M–€10M | ~500 |
| €500K–€2M | ~2,000 |
| <€500K | ~4,700 |

---

## DATA QUALITY SCORE: 52/100

| Dimension | Score | Notes |
|-----------|-------|-------|
| Completeness | 62 | 99.1% missing email |
| Accuracy | 75 | LinkedIn URLs real, scores now correct |
| Consistency | 85 | ISO-2 fixed, enums consistent |
| Freshness | 35 | LinkedIn profiles may be outdated |
| Uniqueness | 80 | UNIQUE index on lead_id |
| Validity | 70 | Some company/title fields empty |
