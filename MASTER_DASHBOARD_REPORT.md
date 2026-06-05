# MASTER DASHBOARD REPORT
Agency Group | Wave 60 | Evidence: page.tsx files scanned

---

## DASHBOARD INVENTORY

### 1. Executive Dashboard
| Field | Value |
|-------|-------|
| URL | /dashboard/executive |
| File | app/dashboard/executive/page.tsx |
| Data source | /api/executive/dashboard + /api/executive/copilot |
| Tables used | deals, contacts, properties, analytics |
| Auth | requirePortalAuth (cookie) |
| Status | ✅ LIVE — fetches real API |
| Data reality | Depends on real data in contacts/deals tables |

### 2. Daily Brief
| Field | Value |
|-------|-------|
| URL | /dashboard/daily-brief |
| File | app/dashboard/daily-brief/page.tsx |
| Data source | /api/daily-brief |
| Status | ✅ LIVE — real API call |
| Data reality | AI-generated brief using real CRM data |

### 3. Conversion Command
| Field | Value |
|-------|-------|
| URL | /dashboard/conversion-command |
| File | app/dashboard/conversion-command/page.tsx |
| Purpose | Funnel tracking + conversion rates |
| Status | ✅ LIVE |

### 4. Control Tower Dashboard
| Field | Value |
|-------|-------|
| URL | /control-tower/dashboard |
| File | app/control-tower/dashboard/page.tsx |
| Purpose | Real-time system operations |
| Status | ✅ LIVE |

### 5. Financial Analytics (Portal)
| Field | Value |
|-------|-------|
| URL | /portal/analytics/financial |
| File | app/portal/analytics/financial/page.tsx |
| Data source | /api/analytics/financial?period={period} |
| Status | ✅ LIVE — real API call |
| Data reality | Real if deals/commissions exist in DB |

### 6. Performance Analytics (Portal)
| URL | /portal/analytics/performance |
| Data source | /api/analytics/* |
| Status | ✅ LIVE |

### 7. Growth Analytics
| URL | /portal/analytics/growth |
| Status | ✅ LIVE |

### 8. Win/Loss Analysis
| URL | /portal/analytics/win-loss |
| Status | ✅ LIVE |

### 9. Adoption Analytics
| URL | /portal/analytics/adoption |
| Status | ✅ LIVE |

### 10. System Health Dashboard (API)
| URL | /api/monitoring/dashboard |
| Auth | INTERNAL_API_SECRET |
| Data | Reality monitor (40 checks), service dependency graph |
| Status | ✅ LIVE |

---

## DASHBOARD REALITY ASSESSMENT

| Dashboard | Data source | Real data? | Status |
|-----------|------------|------------|--------|
| Executive | /api/executive/dashboard | Depends on CRM population | ⚠️ PARTIAL |
| Daily Brief | /api/daily-brief | AI-generated from CRM | ⚠️ PARTIAL |
| Financial Analytics | /api/analytics/financial | Needs live deals | ⚠️ PARTIAL |
| System Health | /api/monitoring/reality | Real system checks | ✅ REAL |
| Health Check | /api/system/health | Live connectivity | ✅ REAL |

**Root issue**: All dashboards are technically correct and will show real data. The issue is that the primary data tables (contacts, deals, properties) need real operational data to populate meaningful metrics.

---

## PROPERTY SEARCH DASHBOARD
| URL | /imoveis |
| Type | Public property listings |
| Data | Properties table (pre-Wave-47 data) |
| Status | ✅ LIVE — public access |

---

## AVM DASHBOARD
| URL | /avm |
| Type | Property valuation tool |
| Data source | /api/avm + market-data fallback |
| Status | ✅ LIVE — using static 2026 market data |
| Limitation | Static data until Idealista/Casafari configured |
