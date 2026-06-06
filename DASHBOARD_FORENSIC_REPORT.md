# DASHBOARD FORENSIC REPORT
Agency Group | Phase 13 | Ultimate Institutional Master Audit | 2026-06-06

---

## DASHBOARDS INVENTORY

| Dashboard | URL | HTTP | Data Source | Accuracy |
|-----------|-----|------|-------------|---------|
| Public Stats | agencygroup.pt/dashboard | 200 | kpi_snapshots | WAS ZERO, FIXED |
| Portal Main | /portal | 403 (auth) | Multiple tables | Auth-gated |
| Control Tower | /dashboard/control-tower | Unknown | Systems | Auth-gated |
| Daily Brief | /dashboard/daily-brief | Unknown | Cron output | Auth-gated |
| CEO View | /dashboard/ceo | Unknown | All dimensions | Auth-gated |
| Analytics | /portal/analytics | Unknown | kpi_snapshots | Auth-gated |

---

## KPI SNAPSHOT — DATA ACCURACY AUDIT

**43 kpi_snapshots in DB. All showing zeros. Bug found and fixed today.**

### Pre-fix (all 43 snapshots, June 3-5):
```
total_leads: 0       ← WRONG (contacts table has 28)
total_deals: 0       ← WRONG (deals table has 8)  
total_properties: 0  ← WRONG (properties table has 55)
pipeline_value: 0    ← WRONG (~€7.29M in active deals)
```

### Post-fix (next snapshot ~23:55 tonight):
```
total_leads: 28      ← CORRECT
total_deals: 8       ← CORRECT (demo data)
total_properties: 55 ← CORRECT
pipeline_value: €7.29M ← CORRECT (but demo data)
```

---

## DASHBOARD WIDGET ACCURACY

| Widget | Before Fix | After Fix | Reality |
|--------|-----------|-----------|---------|
| Total leads | 0 ❌ | 28 ✅ | Real (12 real, 16 test) |
| Total deals | 0 ❌ | 8 ✅ | Demo data |
| Pipeline value | 0 ❌ | €7.29M ✅ | Demo data |
| Total properties | 0 ❌ | 55 ✅ | Unverified |
| Revenue | 0 ✅ | 0 ✅ | Correct (€0) |
| capital_profiles | Not tracked | Not tracked | 7,342 contacts |

---

## BROKEN DASHBOARD WIDGETS (MISSING TABLES)

Widgets that reference 404 tables will show errors:
- **Campaigns widget** (campanhas = 404)
- **Seller pipeline** (sellers = 404)
- **Buyer funnel** (buyers = 404)
- **Partner activity** (partners = 404)
- **Investment portfolio** (investment_portfolios = 404)

---

## DASHBOARD SCORE: 55/100

| Component | Score |
|-----------|-------|
| Infrastructure | 85 |
| Data accuracy (post-fix) | 70 (demo data, not real) |
| Broken widgets | 35 (5 widgets reference missing tables) |
| Real-time | 60 (daily cron, not live) |
| **Average** | **55/100** |
