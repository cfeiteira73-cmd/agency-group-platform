# 00 — PRE-FLIGHT VERIFICATION
**Agency Group | Absolute Master Forensic Audit | 2026-06-25**

---

## Environment

| Item | Value |
|------|-------|
| Working Directory | `C:\Users\Carlos\agency-group` |
| Platform | Windows 11 / PowerShell |
| Node.js | v22.22.0 |
| Package Manager | pnpm 9.15.4 |
| npm | CORRUPT (npm-cli.js missing — known issue) |
| Git Branch | main |
| HEAD Commit | `472a95e` |
| HEAD Message | Revenue Activation Sprint 2026-06-24 — 17 phases complete |
| HEAD Date | 2026-06-24 20:20:46 +0100 |

---

## TypeScript State

```
Command: node_modules\.bin\tsc.CMD --noEmit
Result:  0 ERRORS
Exit code: 0
```

**STATUS: PASS — TypeScript strict mode, 0 errors.**

---

## Repository Snapshot

| Metric | Count |
|--------|-------|
| Total files (excl. node_modules/.git/.next) | 2,935 |
| TypeScript files (.ts) | 1,612 |
| TypeScript React files (.tsx) | 390 |
| Markdown files (.md) | 390 |
| SQL migration files (.sql) | 293 |
| JSON files (.json) | 104 |
| Python scripts (.py) | 22 |
| HTML files (.html) | 20 |
| XLSX files (.xlsx) | 18 |
| JavaScript files (.js) | 13 |

---

## Key Counts (Verified by file scan)

| Component | Count |
|-----------|-------|
| API route files (route.ts in app/api/) | **542** |
| Frontend pages (page.tsx) | **154** |
| Frontend layouts (layout.tsx) | **9** |
| Supabase migration files | **278** |
| n8n workflow JSON files | **21** |
| Blog article pages | **56** |
| Test files (__tests__/ + tests/) | **103** |
| Vercel crons (vercel.json) | **41** |

---

## Lines of Code (TypeScript/TSX only)

| Folder | Lines |
|--------|-------|
| app/ | 205,174 |
| lib/ | 227,160 |
| __tests__/ | 15,939 |
| tests/ | 3,860 |
| types/ | 169 |
| scripts/ | 158 |
| **Total TS/TSX** | **~452,000+** |

---

## Supabase Connectivity

**STATUS: LIVE DB NOT DIRECTLY QUERYABLE FROM LOCAL ENV**

Reason: `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` is 41 characters (corrupted/placeholder). Real key is in Vercel production environment. Supabase MCP also returned 403 permission errors for this project in this session.

**Resolution**: Using last verified DB snapshot from revenue-activation/02_DATABASE_REALITY_CHECK.md (date: 2026-06-24).

---

## Build Presence

| File | Present |
|------|---------|
| `vercel.json` | ✅ Yes |
| `package.json` | ✅ Yes |
| `tsconfig.json` | ✅ Yes |
| `next.config.ts` | ✅ Yes |
| `.env.local` | ✅ Yes (64 env vars, service key corrupt) |
| `n8n-workflows/railway.toml` | ✅ Yes |
| `n8n-workflows/docker-compose.yml` | ✅ Yes |
| `n8n-workflows/Dockerfile.n8n` | ✅ Yes |

---

## Untracked Files (not committed)

```
?? RUN_CRM_IMPORT.sql
?? RUN_WAVE52_SUPABASE.sql
?? RUN_WAVE56_SUPABASE.sql
?? logs/
?? master-audit/
?? ts-check-new.txt
```

---

## Existing Audit Folders (in repo)

| Folder | Committed | Reports |
|--------|-----------|---------|
| `forensic-inventory/` | ✅ (commit 6d8a959) | 31 files |
| `reverse-engineering/` | ✅ (commit 8aa4f63) | 21 files |
| `revenue-activation/` | ✅ (commit 472a95e) | 17 files |
| `master-audit/` | ❌ UNTRACKED (empty) | 0 files |
| `CRM_AUDIT/` | ✅ | — |
| `OPERATIONAL_MAX/` | ✅ | — |
| `SH-ROS-VAULT/` | ✅ | — |
| `TRUTH_AUDIT/` | ✅ | — |

---

*Generated: 2026-06-25 | Audit session: Absolute Master Forensic Audit*
