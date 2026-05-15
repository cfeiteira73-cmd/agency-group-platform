# FAILURE_MODE_REPORT — SH-ROS Ω∞∞
**Agency Group | Institutional Autonomous Revenue OS**
**Report Date:** 2026-05-15 | **Auditor:** SH-ROS Internal Audit Engine v1.0
**Classification:** Engineering Truth — No Optimism Bias

---

## Executive Summary

This report applies Failure Mode and Effects Analysis (FMEA) to the SH-ROS Omega platform. Every autonomous revenue system has failure modes — the question is whether those failures are detected quickly, contained to bounded blast radii, and recoverable within acceptable time windows. SH-ROS has strong recovery infrastructure: `orphanRecovery`, `reconciliationEngine`, `distributedLockManager`, `splitBrainProtector`, and `deadLetterQueue` collectively form a resilient failure containment layer. However, three architectural conditions create elevated risk: Supabase is the sole source of truth with no secondary database; n8n runs as a single instance; and the absence of monitoring dashboards means failures may be silent for extended periods before detection.

This report documents 10 failure modes in FMEA format, 5 top revenue-impact scenarios, recovery time objectives, and single points of failure.

---

## FMEA Table

| # | Component | Failure Mode | Detection Method | Mitigation | Severity (1-5) | Likelihood (1-5) |
|---|---|---|---|---|---|---|
| 1 | Supabase DB | Connection pool exhaustion | Alert engine spike in write errors | DB queue backpressure → in-memory buffer; auto-retry with exponential backoff | 5 | 2 |
| 2 | n8n Worker | Process crash / OOM | Orphan detection (5-min window) | `orphanRecovery` claims orphaned leases; incomplete workflows requeued | 4 | 3 |
| 3 | Queue DLQ overflow | Unprocessable events accumulate | DLQ depth monitoring (if configured) | Manual review required; events older than 72h purged automatically | 3 | 3 |
| 4 | Redis (when active) | Cache eviction / OOM | Queue fallback to DB triggers | Graceful degrade to DB queue; latency increases; no data loss | 2 | 2 |
| 5 | Kafka (when active) | Broker leader election | Consumer lag metric spike | Consumer reconnect; at-least-once delivery guarantees replay; dedup guard prevents double-processing | 3 | 2 |
| 6 | Distributed lock manager | Lock not released (crash during critical section) | Lease TTL expiration | `executionLeaseManager` TTL forces release after configured timeout | 4 | 2 |
| 7 | Learning engine | Weight update produces scoring regression | Score distribution drift detection (15% threshold) | Tier 5 governance freeze; manual rollback via `scoringEvolutionTracker` | 4 | 1 |
| 8 | Ingestion pipeline | Provider API rate limit hit | HTTP 429 response code | Exponential backoff; alternative provider fallback (Idealista → Imovirtual → Casafari) | 2 | 4 |
| 9 | Split-brain scenario | Two workers claim same execution simultaneously | `splitBrainProtector` detects duplicate lease claims | Lock arbitration; one worker wins; other requeues | 4 | 1 |
| 10 | Analytics route | Unauthenticated access to pipeline metrics | No current alert (gap identified in Security Report) | Auth guard application (remediation pending) | 3 | 2 |

**Severity Scale:** 1 = Cosmetic | 2 = Degraded UX | 3 = Feature unavailable | 4 = Data integrity risk | 5 = Revenue loss / data breach
**Likelihood Scale:** 1 = Rare (<1/year) | 2 = Occasional (1-4/year) | 3 = Monthly | 4 = Weekly | 5 = Daily

---

## Top 5 Failure Scenarios With Revenue Impact

### Scenario 1: Supabase Outage (>30 minute duration)
**Probability:** ~2-3x per year (based on Supabase historical SLA data)
**What happens:** All event processing halts. The queue backpressure controller rejects new events after the in-memory buffer fills. Agent workflows cannot persist state. New leads are not scored. Pipeline stalls are not detected.
**Revenue impact:** Every hour of outage during business hours has a proportional impact on deal pipeline velocity. For a pipeline with €2M in active deal value and a 30-day average close time, each hour of processing downtime costs approximately 0.14% of pipeline velocity. A 2-hour outage equates to ~€2,800 in lost pipeline velocity on a €2M pipeline.
**Recovery path:** Supabase auto-recovery; no manual action required for <30 minute outages. Orphan recovery cleans up in-flight events within 5 minutes of reconnection.
**Mitigation gap:** No secondary database. If Supabase suffers an extended regional outage (rare but documented), there is no failover. **Recommendation:** Evaluate Supabase read replica or a periodic export to a standby database.

### Scenario 2: n8n Worker Crash During CPCV Workflow
**Probability:** ~3-4x per year (OOM, deploy restart, infrastructure maintenance)
**What happens:** A CPCV_signed event is being processed by a workflow that triggers commission tracking, Notion update, and Resend email notification. If n8n crashes mid-execution, the workflow is orphaned.
**Revenue impact:** If the commission tracking step did not complete, the deal may not appear in the financial reconciliation. For a €15,000 commission deal, a missed tracking event could delay or prevent commission collection.
**Recovery path:** `orphanRecovery` detects the orphaned lease within 5 minutes and requeues the CPCV event. The workflow replays. If the Notion/Resend steps are idempotent (update on duplicate), replay is safe. If they are not idempotent, duplicate notifications may be sent.
**Mitigation gap:** Idempotency of n8n workflow steps is not systematically guaranteed. CPCV workflows should be audited for idempotency before relying on orphan recovery as the sole protection.

### Scenario 3: Learning Engine Scoring Regression
**Probability:** ~1x per year (novel market conditions, data quality issue in outcome events)
**What happens:** A batch of outcome events with corrupted attribution data triggers weight updates that shift the scoring model away from true conversion predictors. Lead qualification starts rejecting high-quality leads and accepting low-quality ones.
**Revenue impact:** Difficult to quantify precisely, but a 10% degradation in lead qualification accuracy on 100 qualified leads/month would mean 10 additional low-quality leads consuming agent time and 10 fewer high-quality leads in the pipeline. At a 15% visit-to-offer conversion rate and €25,000 average commission, this represents ~€37,500/month in opportunity cost.
**Recovery path:** Drift detector triggers Tier 5 governance. Engineering reviews `scoringEvolutionTracker` history and rolls back to last known-good weights. Time to detection: minutes (if drift threshold crossed) to weeks (if drift is gradual). Time to recovery: 1–4 hours after detection.
**Mitigation gap:** Drift detection is at 15% threshold — a gradual 14% drift over several months would not trigger an alert. **Recommendation:** Add a secondary check: if deal conversion rate drops >10% month-over-month, trigger a learning governance review regardless of weight drift.

### Scenario 4: Ingestion Pipeline Provider Rate Limit (All Providers Simultaneously)
**Probability:** ~5-10x per year (holidays, provider maintenance windows)
**What happens:** Idealista, Imovirtual, and Casafari all return 429 (rate limited) simultaneously. The ingestion pipeline stops receiving new property data. The opportunity detection system has stale data.
**Revenue impact:** If the outage lasts >24 hours, new pre-market opportunities may be missed. The Portuguese luxury market moves fast — a €2M property listed Monday morning that goes under offer by Tuesday could be missed entirely.
**Recovery path:** Exponential backoff retries; automatic recovery when rate limit window resets (typically 1 hour). No data loss — events simply aren't created for the outage window.
**Mitigation gap:** Bank listings provider (`bankListings.ts`) is a fallback, but its coverage of the luxury segment is limited. **Recommendation:** Add a monitoring alert when all three primary providers are simultaneously rate-limited, triggering manual sourcing fallback.

### Scenario 5: Distributed Lock Deadlock
**Probability:** ~1-2x per year (abnormal network partition scenario)
**What happens:** Two worker processes each hold a lock that the other needs. Neither can proceed. Lock TTLs will eventually force both to release, but during the deadlock window, critical sections (CPCV processing, commission recording) are blocked.
**Revenue impact:** Dependent on the TTL configuration. If the TTL is set to 30 minutes, a deadlock could block commission recording for up to 30 minutes. No data loss — events replay after lock release.
**Recovery path:** Lease TTL expires; both locks release; workers requeue their events; `reconciliationEngine` detects the gap and replays.
**Mitigation gap:** TTL duration is not documented in this report — it should be verified in `executionLeaseManager.ts`. If TTL is set too high (>5 minutes), the blast radius of a deadlock is unnecessarily large.

---

## Recovery Time Objectives

| Component | Failure Mode | RTO | Notes |
|---|---|---|---|
| DB Queue | Supabase connection failure | 30 seconds | Auto-retry with backoff; in-memory buffer holds events |
| Redis Queue | Redis instance failure | 5 seconds | Graceful fallback to DB queue |
| Kafka | Broker failure | Graceful degrade | Consumer reconnect; no data loss with replication factor ≥ 2 |
| Worker crash | n8n process crash | 5 minutes | orphanRecovery detects and requeues; 5-min detection window |
| Distributed lock | Deadlock | Lock TTL duration | Must verify TTL in executionLeaseManager.ts |
| Learning regression | Scoring drift | Hours to days | Detection is automated; rollback is manual |
| Ingestion outage | Provider rate limit | 1 hour (rate limit reset) | Automatic recovery |

**RPO (Recovery Point Objective):** All events that reach the queue before failure are recoverable. Events in-transit at exact failure moment may be lost if they did not persist before the crash. Estimated max data loss per failure: <10 seconds of events.

---

## Single Points of Failure

### SPOF 1: Supabase as Sole Source of Truth
**Description:** Supabase is the single authoritative database. All runtime state, learning data, deal records, and queue events are stored in Supabase only. There is no read replica for query offload, no write replica for failover, and no cold backup mechanism documented in the codebase.
**Risk Level:** HIGH
**Mitigation Status:** None beyond Supabase's own internal redundancy (documented at 99.9% uptime SLA)
**Recommendation:** Implement daily Supabase export to S3/GCS as a cold backup. Evaluate Supabase read replica for analytics query offload.

### SPOF 2: n8n Single Instance
**Description:** The workflow execution engine runs as a single n8n instance (Railway or equivalent). There is no n8n clustering or hot standby.
**Risk Level:** MEDIUM
**Mitigation Status:** Orphan recovery handles crash recovery within 5 minutes
**Recommendation:** Evaluate n8n queue mode (multiple worker processes) for production hardening. This is supported natively in n8n v1.x.

### SPOF 3: OTEL Exporter Not Configured
**Description:** Observability data (traces, metrics, logs) is generated but has nowhere to go. Silent failures may go undetected for extended periods.
**Risk Level:** MEDIUM
**Mitigation Status:** Alert engine exists but has no external notification channel confirmed
**Recommendation:** Configure OTEL exporter endpoint as P1 action. Minimum: Grafana Cloud free tier with OTEL ingest.

---

## Recommended Circuit Breakers

| Location | Trigger | Action |
|---|---|---|
| DB queue provider | Write error rate >5% over 60 seconds | Open circuit; buffer to in-memory; alert |
| Ingestion pipeline | All providers 429 for >15 minutes | Pause ingestion; alert operator; resume on next scheduled run |
| Learning engine | Weight update batch fails validation | Reject batch; preserve current weights; trigger Tier 4 governance |
| API route auth | >10 unauthenticated requests/second on protected routes | Rate limit + alert (possible scanning attack) |
| Worker execution | Single workflow exceeds 10x average execution time | Kill and requeue; classify as execution anomaly in DLQ |

---

*This report was generated by the SH-ROS Internal Audit Engine. FMEA severity and likelihood ratings are based on architectural analysis and industry benchmarks for comparable systems — not empirical production incident data, which is not available at the time of this report.*
