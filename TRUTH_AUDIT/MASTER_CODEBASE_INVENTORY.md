# MASTER CODEBASE INVENTORY
Agency Group | Final Institutional Audit | 2026-06-05
Evidence: Live codebase scan

---

## PLATFORM DIMENSIONS
| Metric | Count | Evidence |
|--------|-------|---------|
| API Routes | **542** | `find app/api -name "route.ts" \| wc -l` |
| Web Pages | **153** | `find app -name "page.tsx" \| wc -l` |
| Library Modules | **910** | `find lib -name "*.ts" \| wc -l` |
| Database Migrations | **277** | `ls supabase/migrations/*.sql \| wc -l` |
| Cron Jobs | **41** | `vercel.json` |
| TypeScript Errors | **0** | `tsc --noEmit` |
| Git Commits | **717** | `git log --oneline \| wc -l` |
| Security Modules | **46** | `ls lib/security/ \| wc -l` |
| Observability Modules | **31** | `ls lib/observability/ \| wc -l` |
| Waves Built | **60** | Git history |
| console.log remaining | **113** | `grep -rn "console.log"` |
| `as any` casts | **2714** | `grep -rn "\bas any\b"` |

---

## ROUTE DISTRIBUTION (542 total)
| Domain | Count | Purpose |
|--------|-------|---------|
| cron | 37 | Scheduled automation |
| analytics | 36 | Revenue + performance metrics |
| sre | 16 | Site reliability engineering |
| auth | 16 | Authentication (magic link) |
| automation | 15 | Revenue automation loops |
| system | 14 | IOS + health + certification |
| control-tower | 13 | Operational dashboards |
| security | 12 | ASEL + SOC + defense |
| ops | 12 | Operations management |
| investors | 12 | Investor management |
| compliance | 10 | Regulatory + evidence |
| ml | 9 | ML drift + truth |
| incidents | 9 | Incident management |
| sofia | 5 | AI agent OS |
| sofia-agent | 7 | LEGACY — duplicate routes |
| matching | 2 | Capital matching engine |
| acquisition | 1 | Off-market engine |
| + 40 other domains | 277 | Various business functions |

---

## CRON SCHEDULE (41 jobs, 0 orphans)
| Frequency | Jobs | Examples |
|-----------|------|---------|
| Every 5 min | 5 | worker-processor, self-heal, detect-incidents, anomaly-monitor |
| Every 10-15 min | 2 | runtime-recovery, replay-dlq |
| Hourly | 2 | health-check, capture-drift-snapshot |
| Daily | ~28 | followups, avm-compute, investor-alerts, ingest-listings |
| Weekly | 4 | ml-training-sync, weekly-calibration, market-refresh |

---

## KEY LIB DIRECTORIES
| Directory | Modules | Purpose |
|-----------|---------|---------|
| lib/security/ | 46 | ASEL, IOS, RBAC, SOC, encryption, vault |
| lib/observability/ | 31 | Logging, tracing, metrics, anomaly detection |
| lib/capital/ | ~15 | Settlement, escrow, matching, transactions |
| lib/ai/ | ~12 | Sofia OS, agents, contracts |
| lib/resilience/ | ~10 | DR, chaos, failover |
| lib/compliance/ | ~8 | SOC2, GDPR, AML evidence |
| lib/financial/ | ~9 | Finality, reconciliation, ledger |
| lib/ml/ | ~8 | Drift detection, model registry, PSI |

---

## KNOWN ISSUES (evidence-backed)
| Issue | Severity | Evidence |
|-------|----------|---------|
| 113 `console.log` in production | MEDIUM | `grep -rn "console.log"` |
| 2,714 `as any` casts | MEDIUM | `grep -rn "\bas any\b"` |
| Legacy `/api/sofia-agent/` routes | MEDIUM | Duplicate of `/api/sofia/` |
| W54-W60 migrations not applied to prod DB | HIGH | Tables missing from production |
| Stripe in TEST mode | CRITICAL | `sk_test_` in env |
