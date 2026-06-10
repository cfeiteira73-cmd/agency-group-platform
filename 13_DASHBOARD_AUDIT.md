# 13 — DASHBOARD AUDIT
Agency Group | Final Operating System Audit | 2026-06-11

---

## DASHBOARD INVENTORY

| Dashboard | URL | HTTP | Data Source | Accuracy |
|-----------|-----|------|-------------|---------|
| Public Stats | agencygroup.pt/dashboard | 200 | kpi_snapshots | ✅ FIXED — real data |
| Portal Main | /portal | 403 (auth) | Multiple tables | Auth-gated |
| Control Tower | /control-tower | 403 (auth) | Systems | Auth-gated |
| Daily Brief | /dashboard/daily-brief | 403 (auth) | Cron output | Auth-gated |
| CEO View | /dashboard/executive | 403 (auth) | All dimensions | Auth-gated |

---

## KPI SNAPSHOTS — CONFIRMED FIXED

**Before fix (2026-06-05)**: 0/0/0/0 for 43 days
**After fix (2026-06-06 onwards)**: REAL DATA

| Date | Leads | Deals | Properties | Pipeline |
|------|-------|-------|------------|---------|
| 2026-06-05 | 0 ❌ | 0 ❌ | 0 ❌ | 0 ❌ |
| 2026-06-06 | 28 ✅ | 8 ✅ | 55 ✅ | €9.44M ✅ |
| 2026-06-07 | 28 ✅ | 8 ✅ | 55 ✅ | €9.44M ✅ |
| 2026-06-08 | 28 ✅ | 8 ✅ | 55 ✅ | €9.44M ✅ |
| 2026-06-09 | 28 ✅ | 8 ✅ | 55 ✅ | €9.44M ✅ |

**Note**: Numbers are real (contacts=28, deals=8, properties=55) but data is demo/unverified.

---

## WIDGET ACCURACY

| Widget | Status | Reality |
|--------|--------|---------|
| Total leads | 28 ✅ | Real (1 external + test data) |
| Total deals | 8 ✅ | Demo data |
| Pipeline value | €9.44M ✅ | Demo data |
| Total properties | 55 ✅ | Unverified seeded data |
| Revenue | €0 ✅ | Correct (€0 real) |
| capital_profiles | Not tracked | 7,342 contacts (add to KPI) |

---

## BROKEN DASHBOARD WIDGETS (MISSING TABLES)

| Widget | Missing Table | Effect |
|--------|-------------|--------|
| Campaigns | campanhas | Error or empty |
| Seller pipeline | sellers | Error or empty |
| Buyer funnel | buyers | Error or empty |
| Partner activity | partners | Error or empty |
| Investment portfolio | investment_portfolios | Error or empty |

5 widgets require tables that don't exist.

---

## DATA FRESHNESS

| Metric | Frequency | Lag |
|--------|-----------|-----|
| KPI snapshots | Daily 23:55 | Max 24h |
| Market data | Monday 3:00 | Weekly |
| Match scores | Weekdays | Daily |
| Revenue loop | 3x daily | 8h max |

---

## SCORE: 62/100

| Category | Score | Reason |
|----------|-------|--------|
| Infrastructure | 90/100 | Dashboards built |
| KPI accuracy | 80/100 | FIXED — 4 days confirmed |
| Broken widgets | 25/100 | 5 tables missing |
| Data reality | 40/100 | Numbers real but data is demo |
| Freshness | 75/100 | Daily cron confirmed |
| Capital profiles | 0/100 | 7,342 not tracked in KPI |
