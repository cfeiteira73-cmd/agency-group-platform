# 08 — LEAD ENGINE FORENSIC REALITY
**Agency Group | Absolute Master Forensic Audit | 2026-06-25**

---

## Summary

| Metric | Value |
|--------|-------|
| Total leads in DB | **18,042** |
| Markets covered | **32** |
| Personas | **7** |
| With verified email | **117** |
| A+ tier (score ≥80) | **154** (or 95 by tier column) |
| A tier (60-79) | **3,434** |
| B tier (40-59) | **7,128** |
| C tier (<40) | **7,326** |
| Leads contacted | **0** |
| Revenue from leads | **€0** |

---

## Source Architecture

The Lead Engine is in `CODE & OZ/lead-engine/` (separate repository from agency-group).

### Ingestion Pipeline
```
Apify (web scraping) → Hunter/Apollo (email enrichment) → Supabase leads table
```

### Data Sources by Market

**Tier 1 Markets (High Value)**
- USA: ~3,500 leads (family offices, PE funds, HNW)
- France: ~2,000 leads
- UK: ~1,200 leads
- Germany: ~800 leads

**Tier 2 Markets**
- Switzerland: ~600 leads
- Spain: ~500 leads
- Portugal: ~400 leads
- UAE: ~300 leads

**Other markets**: ~8,742 leads across 24+ remaining countries

---

## Scoring Logic

```
lead_score (0-100):
  HNWI signals: +40 points
  PE/Family Office: +35 points
  Wealth manager: +30 points
  Real estate history: +20 points
  Geographic match (PT/ES/FR): +15 points
  Company size/AUM proxy: +10 points
  LinkedIn profile quality: +5 points
```

### Tier Classification
| Tier | Score Range | Count |
|------|-------------|-------|
| A+ | ≥80 | 154 |
| A | 60-79 | 3,434 |
| B | 40-59 | 7,128 |
| C | <40 | 7,326 |
| D | <20 | ~1,059 (subset of C) |

**Discrepancy Note**: `lead_tier = 'A+'` column yields 95 leads, but `lead_score >= 80` yields 154. Root cause: tier column not updated for 59 leads where score was recalculated after initial import. Both values are valid for targeting.

---

## Email Coverage — The Critical Gap

| Source | Count |
|--------|-------|
| `leads.email` (non-null) | **117** |
| `capital_profiles` with email | **67** |
| **Total directly contactable** | **~184** |

This represents:
```
184 / 25,384 total records = 0.7% email coverage
```

**Root cause**: Apify scrapes company data (LinkedIn, websites) but email scraping is blocked by platforms. Hunter/Apollo enrichment was never funded at scale.

### Apollo Enrichment Economics

| Plan | Cost | Emails | Coverage Gain |
|------|------|--------|--------------|
| Free (50 credits) | €0 | 15-25 emails | +10-25 |
| Starter ($49/mo) | €49 | 240/mo | +240 |
| Budget ($300 one-time) | €300 | 3,000-6,000 lookups | +900-2,400 |

**At 30-40% hit rate**: $300 → +900-2,400 new emails → 1,000-2,600 contactable leads.

---

## Export Infrastructure (Operational)

The revenue-activation sprint (2026-06-24) produced:

| Export | Records | Status |
|--------|---------|--------|
| A+ leads CSV | 95 (by tier) / 154 (by score) | ✅ Generated |
| With email CSV | 117 | ✅ Generated |
| Apollo batch CSV (2,500) | 2,500 top A+A leads | ✅ Generated |
| Capital profiles with email | 67 | ✅ Generated |

These exports are in `revenue-activation/apollo/` (committed folder).

---

## Personas Covered

1. **Family Office Principal** — HNW individuals managing family capital
2. **PE Fund Partner** — Private equity with real estate mandate
3. **Wealth Manager** — Managing client portfolios
4. **Real Estate Developer** — International developers seeking land/projects
5. **HNWI Investor** — High net worth individuals
6. **Real Estate Introducer** — Brokers/introducers
7. **Property Fund Manager** — Institutional fund managers

---

## Lead Engine Workflow Files

In `n8n-workflows/`:
- `workflow-a-lead-enrichment.json` (26KB) — Full enrichment pipeline
- `workflow-a-lead-inbound.json` (2.5KB) — Inbound lead handling
- `workflow-b-lead-scoring.json` (5.3KB) — Automated scoring
- `workflow-c-dormant-lead.json` (19KB) — Dormant lead reactivation
- `workflow-d-investor-alert.json` (24KB) — Alert on high-score investor

**Status**: ALL n8n workflows are local JSON files. None deployed to Railway/production.

---

## Deduplication Logic

The lead engine includes dedup logic:
```
Dedup by: company_name + country + linkedin_url
Threshold: 90% string similarity
```

The `20260413_015_source_dedup_watchlist.sql` migration adds a dedup watchlist.

---

## Commercial Activation Status

| Action | Status | Unlock |
|--------|--------|--------|
| Leads in DB | ✅ 18,042 | — |
| Scoring applied | ✅ | — |
| Export CSVs created | ✅ | — |
| Email addresses found | ✅ 117 leads | — |
| First email sent | ❌ NONE | €0 → potential €75K |
| Apollo enrichment run | ❌ NONE | Would add 900-2,400 emails |
| n8n sequences running | ❌ NONE | Would automate 3,164 contacts |
| First meeting booked | ❌ NONE | — |
| First deal | ❌ NONE | — |

---

*Evidence: revenue-activation/02_DATABASE_REALITY_CHECK.md | reverse-engineering/07_LEAD_ENGINE_DNA.md | lead-engine repository | 2026-06-25*
