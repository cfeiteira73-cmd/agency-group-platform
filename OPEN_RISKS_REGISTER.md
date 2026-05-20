# SH-ROS Open Risks Register
**Wave 11 — Absolute Finalization Protocol**
**Generated:** 2026-05-20 | **Status:** PRODUCTION

---

## CRITICAL (P0) — Must fix before scaling

None identified at wave close.

---

## HIGH (P1) — Fix within 7 days

### RISK-001: policyEngine budget enforcement absent without Redis
- **File:** `lib/ai/policyEngine.ts`
- **Description:** When Upstash Redis is unavailable, `getTokensUsed()` returns 0 (catch block), meaning budget is never exceeded. All AI calls proceed uncapped.
- **Impact:** Runaway AI spend if Redis goes down during high-traffic period
- **Mitigation:** AGENT_REGISTRY circuit entries now have `monthlyTokenBudget` — enforcement kicks in when Redis is available
- **Recommended fix:** Fail-closed in `checkPolicy()` when Redis absent AND budget is defined for the agent

### RISK-002: businessPrimitiveEngine column audit pending
- **File:** `lib/product/businessPrimitiveEngine.ts`
- **Description:** Not audited for column drift in Wave 11. Used by revenueOutcomeMapper.buildFunnel() and getDailyTarget(). If it queries `stage`, `value`, `org_id` etc., KPIs will be 0.
- **Impact:** Revenue funnel dashboard shows wrong numbers
- **Recommended fix:** Audit and apply same column mapping as other economics files

### RISK-003: SYSTEM_ORG_ID env var not set in Vercel
- **File:** `app/control-tower/revenue/page.tsx`
- **Description:** Page now uses `process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001'`. If the hardcoded UUID doesn't match the actual tenant UUID in Supabase, all revenue KPIs will be 0.
- **Impact:** Revenue dashboard shows empty state
- **Recommended fix:** Add `SYSTEM_ORG_ID=<actual UUID from tenants table>` to Vercel env vars

---

## MEDIUM (P2) — Fix within 30 days

### RISK-004: ai/runtime.ts dead code
- **File:** `lib/ai/runtime.ts`
- **Description:** Full governance implementation, zero routes import it. Parallel governance layer to `lib/ops/withAI.ts`. Risk of future confusion about which is "real".
- **Recommended fix:** Delete `lib/ai/runtime.ts` or merge its unique logic into `withAI.ts`

### RISK-005: REROUTE verification still partially self-referential
- **File:** `lib/remediation/selfHealingOrchestrator.ts`
- **Description:** REROUTE action sets key AND mode to STRESSED. Verification checks key is set AND mode != CRITICAL. The mode check is independent; the key check is still tautological for the 3600s TTL window.
- **Impact:** Overly optimistic verification for REROUTE actions within 1 hour of execution
- **Recommended fix:** Add error rate comparison (pre/post) like THROTTLE uses

### RISK-006: No runtime_events.tenant_id RLS type mismatch fixed
- **File:** Supabase RLS policy `runtime_events_org_isolation`
- **Description:** Migration 000005 attempted to create an RLS policy on `runtime_events` where `org_id` is UUID and JWT claims return text. The migration script had a conditional cast, but wasn't verified as applied.
- **Recommended fix:** Verify migration 000005 applied correctly, confirm policy exists in Supabase dashboard

### RISK-007: WhatsApp PII — message content logged
- **File:** `app/api/whatsapp/webhook/route.ts`
- **Description:** Message `text` content (the actual WhatsApp message) may be logged in some code paths. Fixed: `senderName` is now redacted. But message content may still appear in debug logs.
- **Recommended fix:** Audit all `console.log/console.error` in webhook handler — truncate or hash message content

---

## LOW (P3) — Track and fix opportunistically

### RISK-008: contacts.source and contacts.status column existence unverified
- **Description:** `revenueLineage.ts` previously selected `source, status` from contacts. Fix removed these from the SELECT. But if other code queries them, it may fail silently.
- **Recommended fix:** Run schema verifier against contacts table with full column list

### RISK-009: distributedTracing CAUSAL_TRACE_ENABLED flag not documented
- **File:** `lib/observability/distributedTracing.ts`
- **Description:** Setting `CAUSAL_TRACE_ENABLED=false` silently disables all trace writes. No documentation of this flag in env var docs.
- **Recommended fix:** Add to REQUIRED list in instrumentation.ts as WARNING severity

### RISK-010: levenShtelynOrchestrator (selfHealingOrchestrator) THROTTLE pre-window
- **File:** `lib/remediation/selfHealingOrchestrator.ts`
- **Description:** THROTTLE verification uses 10-min pre-window and 5-min post-window. Both windows START at `incident.detected_at`. Pre-window actually looks BEFORE detection. Post-window looks AFTER detection. Edge case: if incident was just detected, post-window is empty → `after=0`, `before=N`, reduction=100% → always returns true prematurely.
- **Recommended fix:** Add minimum wait (e.g. 2 min after action executed) before running post-window check

---

## CLOSED RISKS (Fixed Wave 11)

| Risk | Description | Fix |
|------|------------|-----|
| CLOSED-001 | auth/approve GET executed immediately — scanner bot vulnerability | Two-step GET form + POST execution |
| CLOSED-002 | auth/reject same scanner vulnerability | Same GET+POST fix |
| CLOSED-003 | 9 routes using raw === on CRON_SECRET (timing attack) | safeCompare() via background agent |
| CLOSED-004 | health/smoke unauthenticated when CRON_SECRET missing | Fail-closed |
| CLOSED-005 | push/subscribe no auth | requirePortalAuth added |
| CLOSED-006 | 6 economics files all returning 0 (column name drift) | All corrected to deal_value/tenant_id/fase |
| CLOSED-007 | workflowROI always 0 (learning_events.org_id missing) | tenant_id column added + code fixed |
| CLOSED-008 | control-tower/ceo NaN pipeline value (valor text parseFloat) | Changed to deal_value NUMERIC |
| CLOSED-009 | SYSTEM_ORG 'system' text slug (not a UUID) | Real UUID via env var |
| CLOSED-010 | 3 AI routes bypassing governance (withCircuitBreaker direct) | All wrapped with withAI() |
| CLOSED-011 | AGENT_REGISTRY missing circuit name entries | anthropic-opus, haiku, generic added |
| CLOSED-012 | REROUTE/SCALE_UP/DISABLE_FEATURE verifyRemediation always true | Independent verification implemented |
| CLOSED-013 | anomalyMonitoring DLQ .then() unhandled rejection | .catch() added |
| CLOSED-014 | distributedTracing dead import | Removed |
| CLOSED-015 | schemaVerifier not wired into startup | Wired into instrumentation.ts |
| CLOSED-016 | WhatsApp senderName PII in logs | Redacted |
| CLOSED-017 | auth rate limiting fail-open on Redis error | All 3 auth routes fail-closed |
