# SH-ROS Open Risks Register
**Wave 12 — Ground Truth Verification**  
**Updated:** 2026-05-20 | **Status:** PRODUCTION  
**Score:** 96/100

---

## CRITICAL (P0) — Must fix before scaling

None.

---

## HIGH (P1) — Fix within 7 days

### RISK-001: policyEngine budget enforcement absent without Redis
- **File:** `lib/ai/policyEngine.ts`
- **Description:** When Upstash Redis is unavailable, `getTokensUsed()` returns 0 (catch block), meaning budget is never exceeded. All AI calls proceed uncapped.
- **Impact:** Runaway AI spend if Redis goes down during high-traffic period
- **Mitigation:** AGENT_REGISTRY circuit entries have `monthlyTokenBudget` — enforcement kicks in when Redis is available
- **Recommended fix:** Fail-closed in `checkPolicy()` when Redis absent AND budget is defined for the agent

### RISK-003: SYSTEM_ORG_ID env var not set in Vercel
- **File:** `app/control-tower/revenue/page.tsx`, `lib/bootstrap/systemOrgValidator.ts`
- **Description:** `process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001'`. The hardcoded fallback IS the correct UUID (verified in Wave 12 via organizations table). However the env var is not explicitly set, which means any org rename/re-seed would silently break revenue.
- **Verified UUID:** `00000000-0000-0000-0000-000000000001` (agency-group, slug: agency-group)
- **Recommended fix:** Set `SYSTEM_ORG_ID=00000000-0000-0000-0000-000000000001` in Vercel env vars to make it explicit

---

## MEDIUM (P2) — Fix within 30 days

### RISK-004: ai/runtime.ts dead code
- **File:** `lib/ai/runtime.ts`
- **Description:** Full governance implementation, zero routes import it. Parallel layer to `lib/ops/withAI.ts`.
- **Recommended fix:** Delete `lib/ai/runtime.ts` or merge unique logic into `withAI.ts`

### RISK-005: REROUTE verification partially circular
- **File:** `lib/remediation/selfHealingOrchestrator.ts`
- **Description:** REROUTE action sets key AND mode. Verification checks key (tautological for 3600s TTL) AND mode != CRITICAL (independent signal).
- **Recommended fix:** Add error rate comparison pre/post like THROTTLE uses

### RISK-006: deal_packs + matches public-readable
- **Tables:** `deal_packs` (policy `deal_packs_agent_read` USING true for {public}), `matches` (policy `matches_agent_read` USING true for {public})
- **Description:** Any anonymous user can SELECT all deal packs and matches. Not exploited today (empty DB) but will leak data when populated.
- **Recommended fix:** Replace `{public}` with `{authenticated}` and add tenant_id scoping

### RISK-007: WhatsApp PII — message content may be logged
- **File:** `app/api/whatsapp/webhook/route.ts`
- **Description:** `senderName` is now redacted (Wave 11). But message body `text` content may still appear in debug logs.
- **Recommended fix:** Audit all console.log/error in webhook handler — truncate or hash message content

---

## LOW (P3) — Track and fix opportunistically

### RISK-008: contacts.lead_score default 0 until scoring engine runs
- **Description:** `portal_compat_v1` migration adds `lead_score SMALLINT DEFAULT 0`. All existing contacts start at 0 = LOW tier. Revenue dashboard will show 0 hot leads until the lead scoring engine (opportunityScore.ts / lead scoring agent) processes them.
- **Recommended fix:** Wire up lead scoring cron to backfill existing contacts

### RISK-009: CAUSAL_TRACE_ENABLED flag undocumented
- **File:** `lib/observability/distributedTracing.ts`
- **Description:** `CAUSAL_TRACE_ENABLED=false` silently disables all trace writes. Not in env var docs.
- **Recommended fix:** Add to REQUIRED list in instrumentation.ts as WARNING severity

### RISK-010: THROTTLE pre-window edge case
- **File:** `lib/remediation/selfHealingOrchestrator.ts`
- **Description:** If incident was just detected, post-window is empty → `after=0`, `before=N` → reduction=100% → premature true.
- **Recommended fix:** Minimum 2-min wait after action executed before running post-window check

---

## CLOSED — Wave 12

| Risk | Description | Fix |
|------|-------------|-----|
| WAVE12-001 | `deals.deal_value` column never existed in production DB | Applied `portal_compat_v1_deals_contacts` migration — all 6 portal-compat columns now in DB |
| WAVE12-002 | `contacts.lead_score/full_name/clearbit_data` never existed | Same migration |
| WAVE12-003 | `contacts_agent_access` had `OR true` (any anon user could read/write all contacts) | `rls_hardening_remove_or_true` migration — now authenticated + org_members only |
| WAVE12-004 | `deals_agent_access` had `OR true` | Same migration |
| WAVE12-005 | `properties_agent_write` had `OR true` | Same migration |
| WAVE12-006 | schemaVerifier monitored `tenants` table (does not exist) | Updated to monitor `organizations` |
| WAVE12-007 | systemOrgValidator queried `tenants` table | Updated to query `organizations` |
| WAVE12-008 | `businessPrimitiveEngine` used `d.stage` for closed detection | Fixed to `d.fase` (portal-compat column) |
| WAVE12-009 | `proposals_pending` counted `contacts.negotiating` | Fixed to `active deals with probability >= 0.5` |
| WAVE12-010 | `expected_value: clearbit_data.estimated_num_employees ?? 500_000` | Fixed to `0` (no deal association at lead level) |
| WAVE12-011 | `monthly_target = 2_000_000` magic literal | Explicit env var `ORG_MONTHLY_REVENUE_TARGET` with documented fallback |

## CLOSED — Wave 11

| Risk | Description | Fix |
|------|-------------|-----|
| CLOSED-001 | auth/approve scanner bot vulnerability | Two-step GET+POST |
| CLOSED-002 | auth/reject scanner bot vulnerability | Two-step GET+POST |
| CLOSED-003 | 9 routes timing attack via raw === | safeCompare() |
| CLOSED-004 | health/smoke unauthenticated | Fail-closed |
| CLOSED-005 | push/subscribe no auth | requirePortalAuth added |
| CLOSED-006 | 6 economics files returning 0 (column name drift in code) | All corrected to deal_value/tenant_id/fase |
| CLOSED-007 | workflowROI always 0 | tenant_id column added + code fixed |
| CLOSED-008 | control-tower/ceo NaN pipeline value | Changed to deal_value NUMERIC |
| CLOSED-009 | SYSTEM_ORG 'system' text slug (not UUID) | Real UUID via env var |
| CLOSED-010 | 3 AI routes bypassing governance | All wrapped with withAI() |
| CLOSED-011 | AGENT_REGISTRY missing circuit entries | anthropic-opus, haiku, generic added |
| CLOSED-012 | REROUTE/SCALE_UP/DISABLE_FEATURE verifyRemediation always true | Independent verification |
| CLOSED-013 | anomalyMonitoring DLQ unhandled rejection | .catch() added |
| CLOSED-014 | distributedTracing dead import | Removed |
| CLOSED-015 | schemaVerifier not wired into startup | Wired into instrumentation.ts |
| CLOSED-016 | WhatsApp senderName PII in logs | Redacted |
| CLOSED-017 | auth rate limiting fail-open on Redis error | All 3 auth routes fail-closed |
