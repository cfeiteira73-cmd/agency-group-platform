# MASTER CODEBASE MAP
Agency Group — CEO Forensic Audit | Wave 60 | Evidence-only

---

## PLATFORM DIMENSIONS
| Metric | Count | Source |
|--------|-------|--------|
| API Routes | 542 | `find app/api -name "route.ts" \| wc -l` |
| Pages (app/) | 153 | `find app -name "page.tsx" \| wc -l` |
| Lib modules | 910+ | `find lib -name "*.ts" \| wc -l` |
| Supabase migrations | 277 | `ls supabase/migrations/*.sql \| wc -l` |
| Tables referenced in code | 703 | `grep -rh ".from" lib/ app/ \| wc -l` |
| Cron jobs | 41 | `vercel.json` |
| Git commits | 715 | `git log --oneline \| wc -l` |
| Security modules | 45 | `ls lib/security/ \| wc -l` |
| Observability modules | 30 | `ls lib/observability/ \| wc -l` |

---

## LIB DIRECTORY MAP (all modules)

### Capital & Financial (lib/capital/, lib/financial/)
| Module | Purpose | Status |
|--------|---------|--------|
| settlementStateMachine.ts | 8-state immutable settlement | ✅ PRODUCTION |
| escrowLayer.ts | 72h max hold, alert 48h | ✅ PRODUCTION |
| capitalIntake.ts | Capital ingestion | ✅ PRODUCTION |
| transactionPipeline.ts | Transaction orchestration | ✅ PRODUCTION |
| capitalExecutionHardening.ts | W51 hardening | ✅ PRODUCTION |
| capitalLatencyTracker.ts | Latency monitoring | ✅ PRODUCTION |
| financialFinalityEngine.ts | Bank confirmation guard | ✅ PRODUCTION |
| liveMoneyRealityEngine.ts | Real money validation | ✅ PRODUCTION |
| liveSettlementRealityEngine.ts | Settlement reality check | ✅ PRODUCTION |
| safeArithmetic.ts | Arithmetic without float errors | ✅ PRODUCTION |
| cashflowForecaster.ts | Cashflow projections | ✅ PRODUCTION |
| revenuePipelineMonitor.ts | Revenue tracking | ✅ PRODUCTION |

### AI Systems (lib/ai/, lib/agents/)
| Module | Purpose | Status |
|--------|---------|--------|
| ai/sofia/sofiaOS.ts | 7-role Sofia OS (W54) | ✅ PRODUCTION |
| agents/base.ts | BaseAgent class (Upstash rate-limited, W55) | ✅ PRODUCTION |
| ai/contracts.ts | Agent output contracts | ✅ PRODUCTION |

### Security (lib/security/) — 45 modules
| Module Category | Count | Key modules |
|----------------|-------|------------|
| Zero Trust | 2 | zeroTrustAccess.ts, zeroTrustEngine.ts |
| RBAC | 2 | rbac.ts, rbacEngine.ts |
| SOC | 4 | liveOperationalSocReality.ts, siem.ts, siemPipeline.ts, siemIntegration.ts |
| Vault/Secrets | 6 | secretsVault.ts, secretsRotation.ts, kmsEnvelopeEncryption.ts, ... |
| Threat Detection | 3 | threatDetectionEngine.ts, intrusionDetectionEngine.ts, runtimeThreatEngine.ts |
| Session | 2 | sessionRecorder.ts, requestFingerprintEngine.ts |
| ASEL (W58) | 1 | asel.ts |
| Global OS (W57) | 1 | globalSecurityOS.ts |
| Institutional OS (W56) | 1 | (in lib/system/) |

### Observability (lib/observability/) — 30 modules
| Module | Purpose |
|--------|---------|
| correlation.ts | Correlation ID propagation |
| distributedTracer.ts | Distributed tracing |
| anomalyDetectionEngine.ts | Anomaly detection |
| rootCauseInferenceEngine.ts | Root cause analysis |
| systemHealthDashboard.ts | Unified health view |
| alertRouter.ts | Alert routing |
| logger.ts | Structured logging |
| metricsRegistry.ts | Metrics collection |
| latencyHeatmap.ts | Latency analysis |
| unifiedTimeline.ts | Event timeline |

### Resilience & DR (lib/resilience/, lib/dr/, lib/backup/)
| Module | Purpose |
|--------|---------|
| drChaosTruth.ts | DR chaos validation (W51) |
| absoluteResilienceTruth.ts | 11-scenario resilience (W52) |
| liveFailureRealityGrid.ts | Failure grid (W50) |
| disasterRecoveryEngine.ts | DR orchestration |
| backupOrchestrator.ts | Backup management |

### Matching & Intelligence (lib/matching/, lib/investors/, lib/intelligence/)
| Module | Purpose |
|--------|---------|
| capitalMatchingEngine.ts | 6-dimension capital matching (W54) |
| matchEngine.ts | Investor-property matching |
| matchingWorker.ts | Async matching worker |

### Monitoring & System (lib/monitoring/, lib/system/)
| Module | Purpose |
|--------|---------|
| realityMonitor.ts | 40-check reality monitor (W54) |
| criticalHealthMonitor.ts | P0/P1 health checks (W53) |
| institutionalOS.ts | Institutional OS (W56) |

### Acquisition (lib/acquisition/)
| Module | Purpose |
|--------|---------|
| offMarketAcquisitionEngine.ts | 12 sources PT+ES (W54) |

---

## APP DIRECTORY MAP

### Pages by section
| Section | Pages | Purpose |
|---------|-------|---------|
| / (homepage) | 1 | Marketing homepage |
| /portal/* | ~40 | Agent portal (CRM, analytics, operations) |
| /dashboard/* | ~15 | Executive + operational dashboards |
| /control-tower/* | ~10 | Control tower + monitoring |
| /imoveis/* | ~20 | Property listings + search |
| /blog/* | ~15 | SEO content (52 articles) |
| /investidores/* | ~5 | Investor section |
| /legal/* | ~5 | Legal pages |
| /api/* | 542 routes | All API routes |

### Portal dashboards (app/portal/)
- analytics/adoption — User adoption metrics
- analytics/financial — Financial analytics
- analytics/growth — Growth metrics
- analytics/moat — Competitive moat analysis
- analytics/performance — Agent performance
- analytics/win-loss — Win/loss analysis
- ops/brand, ops/playbooks — Operations

### Executive dashboards (app/dashboard/)
- executive — Executive KPIs
- daily-brief — Daily operational brief
- conversion-command — Conversion tracking
- actions — Action items
- properties — Property management
- simulations — Scenario simulations

---

## CRON JOB SCHEDULE (41 active)

### Every 5 minutes (always on)
- `/api/cron/worker-processor` — Queue worker
- `/api/cron/detect-incidents` — Incident detection
- `/api/cron/self-heal` — Self-healing engine
- `/api/cron/anomaly-monitor` — Anomaly monitoring
- `/api/sre/self-heal` — SRE self-heal

### Every 10-15 minutes
- `/api/cron/runtime-recovery` — Runtime recovery
- `/api/cron/replay-dlq` — Dead letter queue replay

### Every 30 minutes
- `/api/cron/refresh-graph-views` — Graph refresh

### Hourly
- `/api/cron/health-check` — System health
- `/api/cron/capture-drift-snapshot` — ML drift

### Daily (business hours)
- 05:00 `/api/cron/ingest-listings` — Property ingestion
- 06:00 `/api/cron/sync-listings` — Listing sync
- 06:00 `/api/cron/data-quality-score` — Data quality
- 07:00 `/api/cron/avm-compute` — AVM computation
- 07:00 `/api/offmarket-leads/score` — Lead scoring (weekdays)
- 07:00 `/api/contact-enrichment/run` — Contact enrichment
- 07:30 `/api/cron/revenue-leakage` — Revenue leak detection
- 08:00 `/api/cron/investor-alerts` — Investor alerts
- 08:15 `/api/alerts/push` — Push notifications
- 08:30 `/api/reporting/daily` — Daily reports
- 09:00 `/api/cron/followups` — Follow-up sequences
- 23:55 `/api/cron/kpi-snapshot` — KPI snapshot

### Weekly/Monthly
- Sunday 01:00 `/api/cron/ml-training-sync`
- Monday 02:00 `/api/cron/weekly-calibration`
- Monday 06:00 `/api/market-data/refresh`

---

## STRIPE ROUTES (3 routes — TEST MODE)
| Route | Purpose | Mode |
|-------|---------|------|
| /api/stripe/checkout | Create checkout session | ⚠️ TEST |
| /api/stripe/portal | Billing portal | ⚠️ TEST |
| /api/stripe/webhook | Webhook handler | ⚠️ TEST |
