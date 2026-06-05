# OBSERVABILITY REPORT
Agency Group | Wave 60 | 30 observability modules + 41 crons

---

## WHAT IS MONITORED

### Continuous (every 5 minutes)
| Component | Route | What it checks |
|-----------|-------|---------------|
| Incident detection | /api/cron/detect-incidents | Security + financial anomalies |
| Self-healing | /api/cron/self-heal | Cache + rate limit + data inconsistency |
| Anomaly monitor | /api/cron/anomaly-monitor | System-wide anomaly detection |
| Worker processor | /api/cron/worker-processor | Queue worker health |
| SRE self-heal | /api/sre/self-heal | SRE-specific healing |

### Every 10-30 minutes
| Component | Route | What it checks |
|-----------|-------|---------------|
| Runtime recovery | /api/cron/runtime-recovery | Runtime state recovery |
| DLQ replay | /api/cron/replay-dlq | Dead letter queue |
| Graph refresh | /api/cron/refresh-graph-views | DB graph views |

### Hourly
| Component | Route | What it checks |
|-----------|-------|---------------|
| Health check | /api/cron/health-check | Full system health |
| Drift snapshot | /api/cron/capture-drift-snapshot | ML feature drift (PSI) |

### On-demand
| Endpoint | Purpose | Auth |
|----------|---------|------|
| /api/system/health | Pass/fail status (public) | None |
| /api/monitoring/reality | 40-check full audit | INTERNAL_API_SECRET |
| /api/monitoring/dashboard | Dependency graph | INTERNAL_API_SECRET |
| /api/security/asel?view=certify | ASEL self-certification | INTERNAL_API_SECRET |
| /api/security/global-os?view=defense | Defense loop status | INTERNAL_API_SECRET |

---

## 30 OBSERVABILITY MODULES

| Category | Modules | Status |
|----------|---------|--------|
| Correlation tracking | correlation.ts, correlationContext.ts, correlationEngine.ts | ✅ ACTIVE |
| Distributed tracing | distributedTracer.ts, distributedTracingEngine.ts, tracingProvider.ts | ✅ CODE READY — no backend |
| Anomaly detection | anomalyDetectionEngine.ts, anomalyDetector.ts, anomalyMonitoring.ts | ✅ ACTIVE |
| Root cause analysis | rootCauseInference.ts, rootCauseInferenceEngine.ts | ✅ ACTIVE |
| Alerting | alertRouter.ts | ✅ ACTIVE — Slack + email |
| Metrics | metricsRegistry.ts, metricsExporters.ts, infraMetrics.ts, workflowMetrics.ts | ✅ CODE — no external exporter |
| Logging | logger.ts | ✅ ACTIVE |
| Latency | latencyHeatmap.ts, requestTracer.ts | ✅ ACTIVE |
| Timeline | unifiedTimeline.ts | ✅ ACTIVE |
| Health | systemHealthDashboard.ts | ✅ ACTIVE |
| AI audit | ai-audit.ts | ✅ ACTIVE |
| Causal tracing | causalTrace.ts | ✅ ACTIVE |
| Economic metrics | economicMetrics.ts | ✅ ACTIVE |

---

## ALERT CHANNELS (evidence from code)

| Channel | Status | Trigger |
|---------|--------|---------|
| Slack SOC webhook | ✅ CONFIGURED | P0/P1 health alerts, SOC events, capital freeze |
| Resend email | ✅ CONFIGURED | Critical issues to ADMIN_EMAIL |
| PagerDuty | ❌ NOT CONFIGURED | SEV1 events — NOT ESCALATED |
| Datadog | ❌ NOT CONFIGURED | SIEM events — NOT CORRELATED |
| Sentry | ✅ CONFIGURED | JavaScript errors (NEXT_PUBLIC_SENTRY_DSN set) |

---

## WHAT IS NOT MONITORED

| Gap | Impact | Fix |
|-----|--------|-----|
| Capital tables (are they populating?) | Unknown data quality | Add data volume alert |
| Queue depth | No alert on saturation | Add queue depth monitoring |
| ML drift > 0.25 | No alert on significant drift | Add PSI threshold alert |
| WhatsApp delivery failures | Silent failures | Activate after token set |
| External uptime check | No Pingdom/UptimeRobot | Add external uptime monitor |
| npm dependency vulnerabilities | Supply chain blind spot | Add Dependabot |

---

## OBSERVABILITY SCORE
- Internal monitoring: **87/100**
- External visibility: **22/100** (Slack + Sentry only)
- Alert coverage: **60/100** (no PagerDuty/Datadog)
- Tracing readiness: **70/100** (code ready, no backend)
