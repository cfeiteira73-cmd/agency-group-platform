# CRM DASHBOARD REPORT
Agency Group | 2026-06-05

---

## EXISTING DASHBOARDS
| Dashboard | Route | CRM Data? | Status |
|-----------|-------|----------|--------|
| Executive Dashboard | /dashboard/executive | Yes — /api/executive/dashboard | ✅ LIVE (shows DB contacts) |
| Daily Brief | /dashboard/daily-brief | Yes — /api/daily-brief | ✅ LIVE |
| Financial Analytics | /portal/analytics/financial | Yes — /api/analytics/financial | ✅ LIVE |
| System Health | /api/monitoring/dashboard | No — system metrics | ✅ LIVE |
| Revenue War Room | PHASE19/REVENUE_WAR_ROOM.xlsx | Local Excel only | ❌ NOT IN APP |
| Meeting Pipeline | PHASE19/MEETING_PIPELINE.xlsx | Local Excel only | ❌ NOT IN APP |

## WHAT DASHBOARDS SHOW FROM CRM
The executive dashboard and analytics dashboards show data from the Supabase contacts/deals tables (pre-W47 data, unknown population).

They do NOT show:
- The 7,342 leads from the Excel database
- Capital scores, tiers, personas (these fields don't exist in Supabase contacts)
- Founder 25 pipeline status
- Sofia sequence tracking

## GAP
The Revenue War Room and Meeting Pipeline exist as Excel files but not as app dashboards.
To see CRM capital network data in dashboards:
1. Import leads to capital_profiles (Phase 10)
2. Build or update dashboard to query capital_profiles + capital_matches
