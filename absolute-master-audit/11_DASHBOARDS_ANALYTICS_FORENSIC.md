# 11 — DASHBOARDS / ANALYTICS / KPI FORENSIC
**Agency Group | Absolute Master Forensic Audit | 2026-06-25**

---

## Dashboard Inventory

| Dashboard | Route | Data Status |
|-----------|-------|------------|
| Main Portal Dashboard | `/dashboard` | ⚠️ Real but sparse |
| Executive Dashboard | `/dashboard/executive` | ⚠️ Real but sparse |
| Daily Brief (AI) | `/dashboard/daily-brief` | ✅ AI-powered |
| Properties Dashboard | `/dashboard/properties` | ✅ 55 demo properties |
| Simulations | `/dashboard/simulations` | ✅ Works with any data |
| Conversion Command | `/dashboard/conversion-command` | ⚠️ Near-zero data |
| Actions | `/dashboard/actions` | ⚠️ Near-zero |
| Portal Analytics | `/portal/analytics/*` | ⚠️ 6 sub-pages, sparse data |
| Control Tower CEO | `/control-tower/ceo` | ⚠️ Near-zero |
| Control Tower Revenue | `/control-tower/revenue` | ⚠️ Near-zero |
| Control Tower Events | `/control-tower/events` | ⚠️ Near-zero |

---

## KPI Snapshots (Real Data)

The `kpi-snapshot` cron runs daily at 23:55.

**Confirmed**: 47+ rows in `kpi_snapshots` table (verified 2026-06-11).

| Metric | Values (from earlier audit) |
|--------|---------------------------|
| Snapshot count | 47+ (daily since launch 2026-04-24) |
| contacts | 28 |
| deals | 8 |
| properties | 55 |
| pipeline_value | €9.44M (calculated, not real) |
| revenue_recognized | €0 |

The €9.44M "pipeline value" is calculated as `sum(deal_value * stage_probability)` across 8 demo deals. It is NOT real committed revenue.

---

## Analytics Events

The platform captures analytics events via `analytics_events` table (migration 20260519000001). These track:
- Page views
- CTA clicks
- Form submissions
- Sofia interactions

**Status**: Table exists. Row count unknown (session auth blocked). Real events are being captured from actual website visitors.

---

## Portal Analytics (6 Sub-pages)

| Page | Purpose | Data Reality |
|------|---------|-------------|
| `/portal/analytics/adoption` | Feature adoption tracking | Near-zero (1 user) |
| `/portal/analytics/financial` | Financial performance | 8 demo deals |
| `/portal/analytics/growth` | Growth metrics | Near-zero |
| `/portal/analytics/moat` | Competitive advantage | Static/calculated |
| `/portal/analytics/performance` | Agent performance | 0 agents |
| `/portal/analytics/win-loss` | Deal outcomes | No real deals |

---

## Control Tower (25+ Pages)

The Control Tower is the most complex dashboard system. It includes pages for:
- Real-time agent monitoring
- Infrastructure observability
- Compliance tracking
- Incident management
- ML learning curves
- Event replay
- Governance workflows

**Data reality**: Most Control Tower pages show operational data but with minimal real-world traffic. The system is ready for scale but currently shows mostly demo/seed data.

---

## Dashboard Technical Stack

| Component | Technology | Status |
|-----------|-----------|--------|
| Charts | Recharts / D3 | ✅ |
| Real-time updates | SWR/polling | ✅ |
| Export | CSV/XLSX | ✅ |
| Mobile responsive | Tailwind | ✅ |
| Dark mode | Tailwind dark | ✅ |
| Data source | Supabase REST + RPCs | ✅ |
| KPI cron | Vercel cron (kpi-snapshot) | ✅ Running |

---

## KPI Snapshot Reconciliation

**Previous false claim (master-audit session 2026-06-23)**: "kpi_snapshots: 0 rows"
**Actual truth (verified 2026-06-11)**: "kpi_snapshots: 47+ rows"

Root cause: An earlier audit session queried the table before the cron had run. The kpi-snapshot cron runs at 23:55 UTC. If queried at 10:00 UTC, only previously generated snapshots exist. Since verified at 47 rows (June 11), there are now likely **62+ rows** (62 days since launch).

---

*Evidence: reverse-engineering/11_AUTOMATION_GENOME.md | master-audit/11_DASHBOARDS_ANALYTICS_FORENSIC.md | kpi_snapshots=47 verified 2026-06-11*
