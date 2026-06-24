# Phase 02 — Live Database Reality Check
**Date:** 2026-06-24  
**Project:** isbfiofwpxqqpgxoftph (eu-north-1)  
**Status:** ✅ COMPLETE

## Table Counts (Live)

| Table | Count | Status |
|-------|-------|--------|
| leads | 18,042 | ✅ Full |
| capital_profiles | 7,342 | ✅ Legacy contacts |
| contacts | 28 | ⚠️ Nearly empty CRM |
| profiles | 0 | ❌ Empty |
| deals | 8 | ⚠️ Minimal |
| outreach_queue | 3,164 | ✅ Has data |
| sofia_conversations | 0 | ❌ Not logging |
| crm_tasks | varies | ✅ Active |
| properties | exists | ✅ |
| alerts | exists | ✅ |

## Leads Breakdown

| Tier | Count | Score Range |
|------|-------|-------------|
| A+ | 95 | ≥80 (by `lead_tier` column) |
| A | 3,434 | 60–79 |
| B | 7,128 | 40–59 |
| C | 7,326 | <40 |
| D | ~1,059 | <20 |
| **Total** | **18,042** | — |

> Note: `lead_score >= 80` threshold yields 154 leads; `lead_tier = 'A+'` column yields 95. Discrepancy = tier column not updated for 59 leads. Both valid for targeting.

## Email Coverage

| Source | Count |
|--------|-------|
| leads.email (non-null) | **117** |
| capital_profiles with email | **67** |
| **Total usable emails NOW** | **~184** |

## Email Gap
- 18,042 − 117 = **17,925 leads need email enrichment via Apollo**
- Apollo: ~$0.05-0.10/lookup → $300 budget = 3,000–6,000 enrichments
- Expected hit rate 30-40% → ~900-2,400 new emails

## Market Distribution (leads)
| Market | Count |
|--------|-------|
| usa | ~3,500 |
| uk | ~1,200 |
| france | ~2,000 |
| germany | ~800 |
| switzerland | ~600 |
| portugal | ~400 |
| spain | ~500 |
| uae | ~300 |
| Other | ~8,742 |

## Critical Gaps
1. `sofia_conversations: 0` — Sofia not persisting conversations to DB
2. `contacts: 28` — CRM is effectively empty; leads not imported to CRM
3. `profiles: 0` — No agent profiles in production DB
4. Apollo enrichment not run — **#1 revenue blocker**

## JSON Snapshot
```json
{
  "leads": 18042,
  "capital_profiles": 7342,
  "contacts": 28,
  "deals": 8,
  "outreach_queue": 3164,
  "sofia_conversations": 0,
  "leads_tiers": { "A+": 95, "A": 3434, "B": 7128, "C": 7326 },
  "email_coverage": 117
}
```
