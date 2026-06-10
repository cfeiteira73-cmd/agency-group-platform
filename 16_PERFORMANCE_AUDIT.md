# 16 — PERFORMANCE AUDIT
Agency Group | Final Operating System Audit | 2026-06-11

---

## FRONTEND PERFORMANCE

| Feature | Status |
|---------|--------|
| ISR caching (properties) | ✅ 1h revalidation |
| next/image optimisation | ✅ Used throughout |
| LazySection | ✅ Implemented |
| GSAP lazy load | ✅ Implemented |
| Blog CDN caching | ✅ Static MDX |
| Static generation | ✅ All blog + public pages |

---

## BACKEND PERFORMANCE

| Route | Risk Level | Notes |
|-------|------------|-------|
| /api/properties/public | LOW | Fixed to use DB; ISR cached |
| /api/sofia/chat | MEDIUM | Claude API adds ~1-2s |
| /api/avm | MEDIUM | AI-intensive |
| /api/capital/execute | MEDIUM | Complex operations |
| Cron jobs (*/5 min) | LOW | Short execution |
| /api/cron/kpi-snapshot | LOW | Confirmed < 60s |

---

## DATABASE QUERY RISKS

| Table | Size | Risk |
|-------|------|------|
| capital_profiles | 7,342 rows | MEDIUM — needs indexes on common filters |
| contacts | 28 rows | LOW |
| properties | 55 rows | LOW |
| kpi_snapshots | 47 rows | LOW |

**capital_profiles query risk**: No verified custom indexes on `capital_score`, `country_iso`, `persona_type`, `contact_status`. With 7,342 rows, sequential scans are acceptable but should monitor as it grows.

---

## VERCEL REGIONS

| Config | Value |
|--------|-------|
| Primary region | cdg1 (Paris) — close to Portugal clients |
| Edge runtime | Used for select routes |
| Max function duration | 60s (kpi-snapshot) |

---

## BUNDLE SIZE (estimated)

Not measured in this audit. Key dependencies adding to bundle:
- GSAP (~200KB)
- Leaflet (~300KB)
- Multiple Zustand stores
- next-intl i18n

---

## SCORE: 72/100

| Category | Score | Reason |
|----------|-------|--------|
| Frontend caching | 85/100 | ISR, static, CDN |
| AI route latency | 70/100 | Claude API adds 1-3s |
| DB query efficiency | 65/100 | No custom indexes verified |
| Bundle size | 60/100 | Not measured |
| Vercel region | 90/100 | Paris = good for PT/EU |
