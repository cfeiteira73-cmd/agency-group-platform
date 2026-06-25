# 02 — REPOSITORY FORENSIC INVENTORY
**Agency Group | Absolute Master Forensic Audit | 2026-06-25**

---

## Total File Count

| Category | Count |
|----------|-------|
| Total files (excl. node_modules/.git/.next) | **2,935** |
| Source code files (.ts + .tsx) | **2,002** |
| Documentation (.md) | **390** |
| Database migrations (.sql) | **293** |
| Configuration (.json) | **104** |
| Python scripts (.py) | **22** |
| HTML | **20** |
| Spreadsheets (.xlsx) | **18** |
| JavaScript (.js) | **13** |
| Other | **73** |

---

## Lines of Code (TypeScript/TSX)

| Folder | Lines | Purpose |
|--------|-------|---------|
| `lib/` | 227,160 | Business logic, AI, CRM, automation |
| `app/` | 205,174 | Next.js pages + API routes |
| `__tests__/` | 15,939 | Unit/integration tests |
| `tests/` | 3,860 | Chaos + integration tests |
| `types/` | 169 | Type definitions |
| `scripts/` | 158 | Utility scripts |
| **Total TS/TSX** | **~452,460** | — |

---

## File Classification by Top-Level Folder

| Folder | Files | Type | Role |
|--------|-------|------|------|
| `app/` | ~920 | Source | Next.js app router (pages + APIs) |
| `lib/` | ~480 | Source | Business logic, AI, integrations |
| `supabase/migrations/` | 278 | DB | SQL migration files |
| `__tests__/` | ~90 | Tests | vitest unit tests |
| `tests/` | ~15 | Tests | vitest chaos/integration |
| `reverse-engineering/` | 21 | Audit | Forensic reports 2026-06-14 |
| `forensic-inventory/` | 31+ | Audit | Forensic reports 2026-06-~ |
| `revenue-activation/` | 17 | Audit | Revenue sprint reports 2026-06-24 |
| `n8n-workflows/` | 31 | Automation | n8n workflow JSON files + infra |
| `components/` | ~15 | Source | Shared React components |
| `types/` | ~5 | Source | TypeScript type defs |
| `public/` | ~30 | Assets | Static assets |
| `i18n/` | ~20 | Config | Internationalization |
| `infra/` | ~10 | Infra | Terraform/infrastructure |
| `scripts/` | ~5 | Scripts | Utility scripts |
| `_backup/` | ~5 | Backup | Backed-up components |
| `CRM_AUDIT/` | ~10 | Audit | CRM audit reports |
| `OPERATIONAL_MAX/` | ~10 | Audit | Operational maximization |
| `SH-ROS-VAULT/` | ~15 | Audit | Self-healing OS reports |
| `TRUTH_AUDIT/` | ~10 | Audit | Truth audit reports |

---

## Source Code Classification

### Active Production Source

| Layer | Files | Lines |
|-------|-------|-------|
| API routes (`app/api/`) | 542 route.ts files | ~120,000 |
| Frontend pages (`app/**/page.tsx`) | 154 pages | ~60,000 |
| Business logic (`lib/`) | ~480 files | 227,160 |
| Components | ~15 files | 443 |
| Types | ~5 files | 169 |

### Generated / Audit Reports

| Category | Files | Notes |
|----------|-------|-------|
| MD reports (all audit folders) | ~250 | Not deployed |
| XLSX exports | 18 | Spreadsheet exports |
| SQL combined files | 5 | Manual run scripts |
| Log files | ~3 | Generated during audits |

---

## Mission-Critical Files (Highest Risk if Broken)

| File | Why Critical |
|------|-------------|
| `app/api/auth/send/route.ts` | Magic link login — if broken, all logins fail |
| `lib/supabase.ts` | DB connection — if misconfigured, everything breaks |
| `lib/ai/gateway.ts` | Anthropic client — Sofia, AVM, all AI features |
| `lib/constants/pipeline.ts` | Stage probabilities — all commission calculations |
| `app/api/cron/kpi-snapshot/route.ts` | Only confirmed running cron |
| `vercel.json` | 41 crons + deployment config |
| `middleware.ts` | Auth middleware — protects all portal routes |
| `app/api/whatsapp/webhook/route.ts` | WhatsApp webhook — fixed 2026-06-11 |
| `app/api/avm/route.ts` | Property valuation — core product feature |
| `lib/portalAuth.ts` | Portal authentication — all portal routes |

---

## Largest Source Files

| File | Approximate Size |
|------|-----------------|
| `lib/` files (largest) | Multiple 5,000+ line files |
| `app/api/avm/route.ts` | ~500 lines |
| `__tests__/api/` files | 200-400 lines each |

---

## Redundancy Observation

The repository contains **4+ separate audit folder trees** with overlapping coverage:
- `forensic-inventory/` (Wave 59/60 era)
- `reverse-engineering/` (2026-06-14)
- `revenue-activation/` (2026-06-24)
- `CRM_AUDIT/`, `OPERATIONAL_MAX/`, `SH-ROS-VAULT/`, `TRUTH_AUDIT/`

These together represent ~250 .md files and ~18 .xlsx files. **None of this is deployed code.** These are documentation artifacts committed to the main branch.

---

## Code Quality Indicators

| Indicator | Value |
|-----------|-------|
| TypeScript strict errors | 0 |
| Test files | 103 |
| Test count | 2,222 |
| Test pass rate | 100% |
| ESLint configured | Yes (next.config.ts) |

---

*Evidence: PowerShell Get-ChildItem recursive file count 2026-06-25 | git log 472a95e*
