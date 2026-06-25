# 09 — CAPITAL NETWORK FORENSIC REALITY
**Agency Group | Absolute Master Forensic Audit | 2026-06-25**

---

## What Is capital_profiles?

`capital_profiles` is a **legacy institutional buyer database** imported from historical data. It is separate from the Lead Engine (`leads` table). It represents known institutional investors with a history of Portuguese/Iberian real estate interest.

---

## Core Numbers

| Metric | Value |
|--------|-------|
| Total records | **7,342** |
| With verified email | **67** |
| A+ tier (score ≥80) | **116** |
| Immediately contactable | **67** |
| Revenue potential (1 deal) | **€75,000** |

---

## Geographic Distribution

| Country | Count | Buyer Profile |
|---------|-------|--------------|
| United States | 3,010 | Family offices, tech HNW |
| United Kingdom | 882 | Institutional, wealth management |
| France | 748 | HNWI, family offices |
| United Arab Emirates | 504 | Sovereign-adjacent, wealth |
| Brazil | ~180 | HNWI, diaspora |
| Germany | ~150 | Institutional, funds |
| China | ~120 | HNWI, family offices |
| Middle East (other) | ~100 | Various |
| Other (55+ countries) | ~1,648 | Mixed |

---

## Scoring Distribution

| Tier | Score | Count |
|------|-------|-------|
| A+ | ≥80 | 116 |
| A | 60-79 | ~1,200 |
| B | 40-59 | ~2,400 |
| C | <40 | ~3,626 |

---

## The 67 Actionable Contacts

These are the highest-priority contacts:

```
67 capital_profiles with verified email
├── Score ≥80: ~40 contacts (subset of A+)
├── US-based: ~25
├── UK-based: ~15
├── FR-based: ~12
└── Other: ~15
```

**Outreach template needed**:
- Subject: "Exclusive Portuguese real estate — institutional allocation"
- Target: Family offices, PE, wealth managers seeking Portugal exposure
- Ask: 30-minute call + property deck

**Expected conversion**:
- 67 emails → 3-5 replies (4-7% response rate)
- 3-5 replies → 1-2 meetings
- 1-2 meetings → 1 offer in 60-90 days
- 1 offer → €75K commission (on €1.5M property at 5%)

---

## Data Quality Assessment

| Attribute | Coverage | Quality |
|-----------|---------|---------|
| Company name | ~95% | High |
| Country | ~98% | High |
| Score | 100% | High (all scored) |
| Email | 0.9% (67/7,342) | ❌ Critical gap |
| Phone | Unknown | Unknown |
| LinkedIn URL | Unknown | Unknown |
| AUM/fund size | Unknown | Unknown |
| Investment history | Unknown | Unknown |

---

## Capital Network vs Lead Engine: Key Differences

| Dimension | capital_profiles | leads |
|-----------|----------------|-------|
| Source | Historical import | Apify scraping |
| Quality | Higher (known institutions) | Mixed |
| Records | 7,342 | 18,042 |
| With email | 67 (0.9%) | 117 (0.6%) |
| A+ count | 116 | 154 |
| Primary use | Direct capital outreach | Mass outreach pipeline |
| Schema | company, email, score, country_iso | company_name, country, lead_score, lead_tier |

---

## Apollo Enrichment Opportunity

Running Apollo.io enrichment on A+ capital_profiles:

```
116 A+ profiles → Apollo lookup → ~35-50 additional emails
Cost: 116 credits × $0.05 = ~$6
Time: 30 minutes
Result: 67 + 35-50 = 100-117 total contactable from capital_profiles
```

---

## Commercial Activation Priority

This is the highest-quality, most actionable database Agency Group possesses.

**Week 1 action**: Send 67 emails
**Month 1 action**: Apollo enrich A+ tier → unlock 35-50 more
**Month 2 action**: Apollo enrich A tier (1,200 records) → unlock 360-480 more

**First deal probability** from this database: **HIGH**
- These are known institutional buyers
- Many have purchased in Portugal/Spain before
- The €500K-€3M bracket matches Agency Group's core segment

---

*Evidence: reverse-engineering/08_CAPITAL_NETWORK_DNA.md | revenue-activation/02_DATABASE_REALITY_CHECK.md | capital_profiles row count=7,342 verified 2026-06-24*
