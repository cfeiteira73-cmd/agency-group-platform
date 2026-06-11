# 10 — DASHBOARD MAP
**Agency Group | Nano Detail Forensic Inventory | 2026-06-11**

---

## DASHBOARD SYSTEMS

Agency Group has 4 dashboard systems:
1. **Main Dashboard** (/dashboard) — Day-to-day ops
2. **Portal** (/portal) — Analytics and brand ops
3. **Control Tower** (/control-tower) — Infrastructure ops
4. **Experience Views** (/experience) — Role-based UX

---

## MAIN DASHBOARD (/dashboard)

### Sub-pages

| Page | Purpose | Data Source | Status |
|------|---------|-------------|--------|
| /dashboard | Main overview | /api/executive/dashboard | Live |
| /dashboard/actions | Priority actions | /api/priority | Live |
| /dashboard/conversion-command | Conversion funnel | /api/conversion/funnel | Live |
| /dashboard/daily-brief | Daily intelligence | /api/automation/daily-brief | Live |
| /dashboard/executive | Executive summary | /api/analytics/executive | Live |
| /dashboard/onboarding | Setup checklist | Local state | Live |
| /dashboard/properties | Properties list | /api/properties | Live (FIXED) |
| /dashboard/properties/[id] | Property detail | /api/properties/[id] | Live |
| /dashboard/properties/new | Add property | /api/properties | Live |
| /dashboard/simulations | What-if | /api/analytics/business-simulation | Live |

### Dashboard API Routes
```
GET  /api/dashboard/health-map      — System health map
GET  /api/dashboard/performance     — Performance metrics
GET  /api/dashboard/security-audit  — Security overview
GET  /api/dashboard/system-status   — System status
GET  /api/dashboard/truth           — Reality audit
POST /api/dashboard/hardening       — Apply hardening
```

### KPIs Shown
```
Total leads: 28 (real)
Active deals: 8 (demo)
Properties: 55 (seeded)
Pipeline value: €9,440,000 (demo)
```

---

## PORTAL ANALYTICS (/portal/analytics)

| Page | Data Source | KPIs |
|------|-------------|------|
| /portal/analytics/adoption | /api/analytics/adoption | User adoption, feature usage |
| /portal/analytics/financial | /api/analytics/financial | Revenue, margins, costs |
| /portal/analytics/growth | /api/analytics/growth | Lead growth, conversion |
| /portal/analytics/moat | /api/analytics/moat | Data advantage metrics |
| /portal/analytics/performance | /api/analytics/scoring-performance | Scoring accuracy |
| /portal/analytics/win-loss | /api/analytics/win-loss | Win/loss analysis |

---

## CONTROL TOWER (/control-tower — 29 pages)

### Category: Operations
| Page | Purpose |
|------|---------|
| /control-tower/dashboard | Overview dashboard |
| /control-tower/ceo | CEO executive view |
| /control-tower/observability | System observability |
| /control-tower/infra | Infrastructure status |
| /control-tower/settings | Platform settings |

### Category: AI & Learning
| Page | Purpose |
|------|---------|
| /control-tower/agents | AI agent management |
| /control-tower/agents/[id] | Individual agent status |
| /control-tower/ai-timeline | AI decision history |
| /control-tower/learning | ML learning status |
| /control-tower/memory | AI memory vault |
| /control-tower/orchestration | Workflow orchestration |

### Category: Data & Economics
| Page | Purpose |
|------|---------|
| /control-tower/economics | Financial P&L |
| /control-tower/economics/[tenant_id] | Tenant economics |
| /control-tower/events | Event stream viewer |
| /control-tower/events/[id] | Event detail |
| /control-tower/graph | Network graph |
| /control-tower/revenue | Revenue dashboard |

### Category: Reliability & Security
| Page | Purpose |
|------|---------|
| /control-tower/incidents | Incident tracker |
| /control-tower/security | Security ops center |
| /control-tower/forensics | Forensic analysis |
| /control-tower/compliance | Compliance status |
| /control-tower/governance | Governance rules |

### Category: Recovery
| Page | Purpose |
|------|---------|
| /control-tower/recovery | DR recovery status |
| /control-tower/replay | Event replay |
| /control-tower/queue | Job queue viewer |
| /control-tower/self-healing | Auto-healing status |
| /control-tower/distributed | Distributed system health |

### Category: Multi-tenant
| Page | Purpose |
|------|---------|
| /control-tower/tenants | Tenant management |
| /control-tower/workflows | Workflow viewer |

---

## EXPERIENCE VIEWS (/experience)

| View | Audience | Features |
|------|---------|---------|
| /experience/broker | Co-agency brokers | Shared inventory, commissions |
| /experience/digest | All users | Daily briefing |
| /experience/executive | C-suite | Revenue, pipeline, forecasts |
| /experience/operator | Operations | System health, tasks |

---

## KPI TRACKING (CONFIRMED WORKING)

### kpi_snapshots table (48 rows)
The only fully confirmed running system. Evidence:
```
Date             Leads  Deals  Properties  Pipeline
2026-06-10 23:55   28     8       55      €9,440,000
2026-06-09 23:55   28     8       55      €9,440,000
2026-06-08 23:55   28     8       55      €9,440,000
2026-06-07 23:55   28     8       55      €9,440,000
2026-06-06 23:55   28     8       55      €9,440,000
```

Cron: `/api/cron/kpi-snapshot` at 23:55 UTC daily ✅

---

## WIDGETS AND COMPONENTS

| Component | Location | Purpose |
|-----------|---------|---------|
| PortalDashboard.tsx | components/portal/ | Main portal view |
| PortalKPICards | components/ | KPI display cards |
| PortalStatusBadge.tsx | components/ | Status indicators |
| ErrorBoundary.tsx | components/ | Error handling |
| SkeletonLoader.tsx | components/ | Loading states |
| StaleDataWarning.tsx | components/ | Data freshness |
| ReconnectBanner.tsx | components/ | Connection status |

---

## REAL-TIME FEATURES

| Feature | Implementation | Status |
|---------|---------------|--------|
| Live KPIs | Polling every 30s | Active |
| Sofia chat | WebSocket | Active |
| Event stream | SSE (/api/runtime/events) | Configured |
| Push notifications | VAPID + /api/push/subscribe | Configured |

---

*Evidence: app/ directory scan, components/ scan, Supabase REST API — 2026-06-11*
