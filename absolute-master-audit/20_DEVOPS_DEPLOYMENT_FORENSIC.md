# 20 — DEVOPS / DEPLOYMENT FORENSIC
**Agency Group | Absolute Master Forensic Audit | 2026-06-25**

---

## Deployment Reality

| Dimension | Value |
|-----------|-------|
| Primary hosting | **Vercel** (cdg1 Paris) |
| Launch date | **2026-04-24** |
| Days live | **62** |
| Build tool | **pnpm 9.15.4** |
| Framework | **Next.js 16.2.1** App Router |
| Node version | **22.22.0** |
| TypeScript | **0 errors** (strict mode, confirmed PowerShell 2026-06-25) |
| Tests | **2,222/2,222 passing** (vitest) |
| Crons | **41** (all have real route.ts) |
| n8n (Railway) | **NOT DEPLOYED** |

---

## Vercel Deployment

| Feature | Status |
|---------|--------|
| Main deployment | ✅ Live agencygroup.pt |
| Automatic deploys on push | ✅ |
| Edge functions | ✅ Vercel edge config |
| Cron jobs (41) | ✅ Configured in vercel.json |
| Environment variables (64) | ✅ All set in Vercel dashboard |
| Domain(s) | agencygroup.pt + others |
| Region | cdg1 (Paris — closest to Portugal) |
| Build cache | ✅ pnpm-lock.yaml committed |

---

## CI/CD Pipeline

There is **no GitHub Actions CI/CD pipeline** in this repository. Deployment is:

1. `git push` → GitHub
2. Vercel auto-detects push
3. Vercel builds Next.js
4. Deploys to CDN edge

**Quality gates**: None automated. TypeScript is checked manually (`tsc --noEmit`). Tests run manually (`pnpm vitest run`).

**Risk**: No pre-deploy gate preventing broken deployments. A TS error or failing test could deploy to production silently.

---

## Cron Infrastructure

41 cron jobs configured in `vercel.json`.

| Category | Count | Status |
|----------|-------|--------|
| Revenue automation | 8 | ✅ Active, minimal output |
| KPI snapshots | 3 | ✅ Active, producing data |
| Lead management | 6 | ✅ Active, empty queues |
| Property alerts | 4 | ✅ Active, no inventory |
| Analytics | 5 | ✅ Active |
| System health | 5 | ✅ Active |
| Maintenance | 10 | ✅ Active |

Only `kpi-snapshot` cron produces confirmed real data (47+ rows as of 2026-06-11).

---

## Build History

| Event | Commit | Date |
|-------|--------|------|
| Initial production deploy | ~5dfac2a | 2026-04-24 |
| Login hotfix | 95235ec | 2026-04-08 |
| Properties API fix | 1760efe | 2026-06-11 |
| 4 bugs fixed, 20 audit reports | 8aa4f63 | 2026-06-14 |
| Revenue activation sprint | 472a95e | 2026-06-24 |
| HEAD (current) | 472a95e | 2026-06-24 |

---

## Local Development Environment

| Tool | Version | Status |
|------|---------|--------|
| Node.js | 22.22.0 | ✅ |
| pnpm | 9.15.4 | ✅ |
| npm | Corrupted | ❌ (use pnpm) |
| TypeScript | tsc --noEmit = 0 errors | ✅ |
| Supabase local key | 41 chars (corrupted) | ❌ Local DB access broken |
| .env.local | Present, mostly PREENCHER | ⚠️ |

---

## n8n / Railway

Railway deployment is fully configured but not executed.

| File | Purpose | Status |
|------|---------|--------|
| `n8n-workflows/railway.toml` | Railway deployment config | ✅ Present |
| `n8n-workflows/Dockerfile.n8n` | Docker image | ✅ Present |
| `n8n-workflows/docker-compose.yml` | Local testing | ✅ Present |
| Railway account | Required for deploy | ❌ Not created yet |

**Deployment**: 4 hours, €15/month.

---

## Infrastructure Gaps

| Gap | Risk | Fix |
|-----|------|-----|
| No CI/CD pipeline | MEDIUM — manual quality gates | GitHub Actions pre-deploy hook |
| No automated deploy tests | MEDIUM | Add vitest to Vercel build |
| n8n not deployed | HIGH — 21 workflows idle | Deploy to Railway |
| Local .env.local corrupt | LOW (only local dev) | Get real keys from Vercel |
| No staging environment | LOW (solo project) | Add when team grows |
| No rollback procedure | MEDIUM | Document for incidents |

---

## Production Uptime

62 days with no reported outages (no Sentry alerts in DB, no error spikes visible).

The properties API was broken from launch until 2026-06-11 (commit 1760efe) — users would have seen 0 properties. This was a silent failure: no crashes, just empty results.

---

*Evidence: vercel.json cron count | git log --oneline | Node v22.22.0 (PowerShell 2026-06-25) | n8n-workflows/ file inventory | revenue-activation/12_DEPLOYMENT_STATUS.md*
