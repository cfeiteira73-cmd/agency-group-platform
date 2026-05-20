# SH-ROS Architecture — 7 Layers
## Version: 1.0.0 | Created: 2026-05-19

> Full detail in system-bible/SH-ROS_MASTER_BIBLE.md Section 1.
> This document provides a quick-reference per-layer breakdown.

---

## Layer 0 — Infrastructure

**Responsibility**: External services and persistent storage.
**Files**: `lib/supabase/client.ts`, `lib/redis/client.ts`, `next.config.ts`, `vercel.json`
**Services**:
- Supabase (PostgreSQL 17, pgvector, RLS, 28 tables) — project `isbfiofwpxqqpgxoftph`
- Vercel (serverless compute, edge middleware, 29 cron jobs)
- n8n Cloud (agencygroup.app.n8n.cloud) — 29 active automation workflows
- Upstash Redis — circuit breaker state, rate limits, dedup keys, token budgets

---

## Layer 1 — Event Bus

**Responsibility**: Reliable, tenant-scoped, deduplicated event delivery.
**Files**: `lib/events/eventBus.ts`, `lib/events/eventTypes.ts`, `lib/events/eventPersistence.ts`
**Pattern**: Publish → Redis dedup check → in-memory fan-out → Supabase persist (async)
**Key tables**: `event_history`
**Key Redis keys**: `{tenant_id}:ev_dedup:{hash}` (TTL 24h)

---

## Layer 2 — AI Control Plane

**Responsibility**: Gate, wrap, audit, and budget all AI calls.
**Files**:
- `lib/ai/policyEngine.ts` — ALLOW/DENY/ESCALATE decisions
- `lib/ai/agentRegistry.ts` — agent → model + budget mapping
- `lib/ai/contracts.ts` — AgentExecutionEnvelope type
- `lib/ai/withAI.ts` — circuit-breaker wrapped AI call
- `lib/ai/withAIStream.ts` — streaming variant (no retry)
- `lib/ai/withRetry.ts` — exponential backoff (1s→2s→4s, 3 attempts)
- `lib/ai/feedbackEngine.ts` — human rating collection
- `lib/ai/memory.ts` — per-agent persistent memory
- `lib/ai/policyTuning.ts` — rule change history
**Key tables**: `ai_audit_log`, `agent_memory`, `ai_feedback`, `policy_tuning_log`

---

## Layer 3 — Revenue Engine

**Responsibility**: Match scoring, deal lifecycle, commission tracking.
**Files**:
- `lib/revenue/matchScorer.ts` — weighted 5-factor scoring (0–100)
- `lib/revenue/dealPackGenerator.ts` — auto deal pack assembly
- `lib/revenue/pipelineManager.ts` — stage transitions
- `lib/revenue/commissionCalculator.ts` — CPCV + Escritura splits
- `app/api/matches/` — match CRUD + compute endpoints
- `app/api/deals/` — deal CRUD + stage endpoints
- `app/api/deal-packs/` — generation + send endpoints
**Key tables**: `matches`, `deals`, `deal_packs`, `priority_items`
**Thresholds**: HIGH ≥ 80 (auto-trigger), MEDIUM 60–79 (queue), LOW < 60 (log only)

---

## Layer 4 — Automation

**Responsibility**: Scheduled tasks, background jobs, n8n workflows.
**Files**:
- `vercel.json` — 29 cron job definitions (02:00, 07:00, hourly schedules)
- `app/api/automation/` — webhook receivers and job dispatchers
- `lib/queue/` — job queue adapter (Supabase-backed)
- `lib/queue/workers/` — DLQ processor, match processor, followup worker
- n8n workflow JSONs in `n8n-workflows/`
**Key tables**: `job_queue`
**Cron examples**: daily-brief (07:00 UTC), vault-integrity (02:00 UTC), GDPR purge (03:00 UTC)

---

## Layer 5 — Observability

**Responsibility**: Full auditability of every AI decision and revenue action.
**Files**:
- `lib/observability/auditLogger.ts` — ai_audit_log writer
- `lib/observability/causalTrace.ts` — causal graph builder
- `lib/observability/correlationId.ts` — ID generation + header propagation
- `middleware.ts` — injects X-Correlation-ID on every request
- `instrumentation.ts` — OpenTelemetry / Sentry init
**Key tables**: `ai_audit_log`, `causal_trace`, `event_history`, `usage_events`
**Query API**: `/api/control-tower/causal-query`, `/api/control-tower/revenue-leak`

---

## Layer 6 — Security

**Responsibility**: Authentication, authorization, threat detection, secrets management.
**Files**:
- `lib/auth/rbac.ts` — role-permission matrix + requiresRole guard
- `lib/security/siem.ts` — 4-sink structured security event logger
- `lib/security/intrusionDetection.ts` — 4 threat pattern detectors
- `lib/security/secretsRotation.ts` — rotation audit + expiry alerts
- `lib/security/rateLimiter.ts` — Upstash Redis sliding window rate limits
- `auth.ts` — NextAuth configuration (magic link)
**Key tables**: `security_events`, `secret_rotation_log`, `used_magic_tokens`
**Key Redis keys**: `rate:{route}:{tenantId}:{userId}` (sliding window)

---

## Layer 7 — Resilience

**Responsibility**: Prevent cascade failures, recover automatically from transient errors.
**Files**:
- `lib/resilience/circuitBreaker.ts` — Redis-backed 3-state breaker
- `lib/resilience/withRetry.ts` — exponential backoff + AbortController timeout
- `lib/resilience/dlqProcessor.ts` — dead letter queue recovery worker
- `lib/resilience/healthCheck.ts` — multi-layer system health endpoint
**States**: CLOSED (normal) → OPEN (5 failures) → [60s] → HALF_OPEN → [3 success] → CLOSED
**Key Redis keys**: `cb:{circuitName}:state`, `cb:{circuitName}:failures`, `cb:{circuitName}:lastFailure`
**Health endpoint**: `GET /api/health` — returns per-layer status (DB, Redis, AI, n8n, SIEM)
