# Final Deep Audit Report
## Agency Group — Wave 45 Pre-Live Hardening
**Date**: 2026-05-26
**Status**: COMPLETED
**Auditor**: Wave 45 Multi-Agent System
**TypeScript Errors (pre-fix)**: 0 | **TypeScript Errors (post-fix)**: 0

---

## Executive Summary

The Agency Group SH-ROS codebase is in strong overall health after 44 waves of iterative hardening. TypeScript strict mode passes with 0 errors across all ~150+ lib files and ~130 API routes. Security headers, portal auth, rate limiting, and the structured logger are all properly wired. The primary remaining risks are infrastructure-level (in-memory Maps for rate limiting that reset on cold starts) and medium-severity patterns (Math.random for ID generation in non-security contexts, console.log usage in API routes that have a structured logger available). Three fix files were auto-created to address the most actionable issues.

**Overall Health Score**: 82/100
**Critical Issues**: 0
**High Issues**: 4
**Medium Issues**: 6
**Low Issues**: 5
**Auto-Fixed**: 3 (new files created)

---

## CRITICAL Issues

None found. The codebase has no TypeScript compilation errors, the portal auth is properly guarded, the double-entry ledger uses bigint cents (no float arithmetic in financial storage), and Stripe webhooks use typed casting with proper Stripe SDK types.

---

## HIGH Issues

| # | Location | Issue | Root Cause | Status |
|---|----------|-------|------------|--------|
| H-1 | `app/api/draft-offer/route.ts:48` | In-memory `rateMap` resets on cold starts — AI endpoint (~€0.015/call) can be budget-drained on every new serverless instance | `Map<string, ...>` is process-local; Vercel spawns new instances on each cold start; parallel burst bypasses all rate limiting | MANUAL_REQUIRED — replace with `persistentRateLimit()` from `lib/rateLimit/persistentRateLimit.ts` (AUTO_FIXED helper created) |
| H-2 | `app/api/market-data/route.ts:92` | 7-day Idealista scrape cache resets on cold starts — may trigger scraper bans from repeated scraping per instance | Same in-process `Map` pattern; defeats the 7-day TTL; each instance will re-scrape on first request | MANUAL_REQUIRED — replace `marketCache` with Upstash `SETEX 604800` using `persistentRateLimit.ts` Redis helpers |
| H-3 | `lib/agents/base.ts:21` | Per-agent rate limiter `_callLog` is per-instance only; agent call throttles can be bypassed under concurrent load | In-memory `Map<AgentId, number[]>` in Base Agent; parallel requests across instances bypass agent throttles entirely | MANUAL_REQUIRED — migrate to Supabase or Upstash as noted in TODO #INFRA-011 |
| H-4 | `next.config.ts:50` | `typescript: { ignoreBuildErrors: true }` — TypeScript compilation errors are silently ignored during Vercel builds | Set to allow CI builds without all env vars; however this masks any future type regressions from reaching production | MANUAL_REQUIRED — remove after verifying build passes cleanly in CI with full env vars set; use `SKIP_TYPE_CHECK` env var pattern instead |

---

## MEDIUM Issues

| # | Location | Issue | Root Cause | Status |
|---|----------|-------|------------|--------|
| M-1 | `lib/capital/escrowLayer.ts:60`, `lib/campaigns/channelRouter.ts:45`, `lib/campaigns/campaignOrchestrator.ts:83,165`, `lib/control-plane/autoCorrector.ts:58,102,164,228,289`, and 10+ other files | `Math.random()` used for ID generation in job IDs, action IDs, campaign IDs, reference codes | PRNG is predictable; IDs built with `Math.random().toString(36)` can be guessed or collide in high-throughput scenarios | MANUAL_REQUIRED — migrate to `secureNanoId()` / `secureId()` from `lib/ids/secureId.ts` (AUTO_FIXED helper created) |
| M-2 | `lib/ml-reality/retrainingOrchestrator.ts:177-178` | `Math.random()` used to simulate ML accuracy improvements in production code path | Simulation code left in production — accuracy metrics will be non-deterministic and misleading in telemetry | MANUAL_REQUIRED — replace with real ML API call or use deterministic seed for reproducible test data |
| M-3 | `lib/market/liquidityFeedbackLoop.ts:323` | `Math.random() < 0.30` used as a probability gate in business simulation affecting demand-shift calculations | Stochastic business logic produces different results on every run, making backtesting unreliable | MANUAL_REQUIRED — replace with `safeRandomFloat()` from `lib/ids/secureId.ts` or use a seeded PRNG for reproducibility |
| M-4 | ~30 API routes use `console.log/error/warn` instead of structured `log` | Inconsistent logging; `console.*` calls bypass Sentry breadcrumb integration, correlation IDs, and Vercel log drain structured parsing | Most routes use the structured logger; a subset (notably `app/api/alerts/route.ts`, `app/api/buyers/*.ts`, `app/api/stripe/checkout/route.ts`) still use raw `console.*` | MANUAL_REQUIRED — replace with `import log from '@/lib/logger'`; all files already have the correct logger available |
| M-5 | `lib/commercial/revenueAttribution.ts:62-65,86` | Commission calculations use `parseFloat(x.toFixed(2))` — sufficient for display but not ledger-grade | Float arithmetic: `parseFloat((1500000 * 0.05).toFixed(2))` can produce off-by-1-cent results on edge cases | MANUAL_REQUIRED — use `computeCommissionCents()` from `lib/financial/safeArithmetic.ts` (AUTO_FIXED helper created) for payment-processing paths |
| M-6 | `lib/trackLearningEvent.ts:96-98` | In-memory dedup cache for learning events is per-process only; cross-instance duplicate events can corrupt ML training data | `_recentKeys` Map is process-local; concurrent Vercel instances will each allow the same event through independently | MANUAL_REQUIRED — requires DB idempotency constraint verification (migration `20260430_002_event_idempotency.sql`) or Redis-backed dedup |

---

## LOW Issues

| # | Location | Issue | Root Cause | Status |
|---|----------|-------|------------|--------|
| L-1 | `lib/platform/config.ts:88` | 5-minute in-process config cache not shared across Vercel instances; config updates take up to 5 min × N instances to propagate | By-design in-memory TTL; documented in code | INFORMATIONAL — add Redis invalidation if config changes need to propagate immediately |
| L-2 | `middleware.ts:8-9` | TODO comment in production code documents in-memory fallback rate store as a critical bypass risk | Already partially mitigated (Upstash path active when configured); the comment is accurate but alarming in code review | LOW — remove comment and store once migration to Upstash is confirmed in all environments |
| L-3 | `@types/ioredis: ^5.0.0` in `devDependencies` | ioredis is a production dependency but its types are in devDependencies only | Types should be in devDependencies for type-only packages; this is correct but worth noting as ioredis itself should be audited for actual usage | INFORMATIONAL |
| L-4 | `lib/security/encryptionLayer.ts:48` | `console.warn` used instead of structured logger when `ENCRYPTION_NOT_CONFIGURED` sentinel is returned | Inconsistent logging path; encryption config warnings bypass Sentry | LOW — replace with `log.warn` |
| L-5 | `lib/ops/withRetry.ts:68` | `Math.random()` used for jitter in retry delays | Jitter is non-security-critical; however PRNG jitter could theoretically cause thundering herd if many instances hit the same seed state simultaneously | LOW — replace with `safeRandomFloat()` from `lib/ids/secureId.ts` for consistency |

---

## Auto-Fixed (Wave 45)

| # | New File | Fixes | TypeScript |
|---|----------|-------|------------|
| AF-1 | `lib/ids/secureId.ts` | Provides `secureNanoId()`, `secureId()`, `secureReferenceCode()`, `safeRandomFloat()`, `randomBool()` as CSPRNG-backed replacements for `Math.random()` ID generation patterns found in 15+ files | 0 errors |
| AF-2 | `lib/rateLimit/persistentRateLimit.ts` | Provides `persistentRateLimit()` and `persistentRateLimitWithMeta()` — Upstash Redis-backed, cold-start-safe rate limiting to replace in-memory Maps in `draft-offer/route.ts`, `market-data/route.ts`, and `base.ts` | 0 errors |
| AF-3 | `lib/financial/safeArithmetic.ts` | Provides `computeCommissionCents()`, `validateCommissionSplit()`, `eurosToCents()`, `centsToEuros()`, `roundCurrency()` — integer-cents arithmetic helpers for financial calculations, eliminating float accumulation risk in commission/split paths | 0 errors |

---

## Dependency Audit

| Package | Version in use | Notes | Risk | Action |
|---------|---------------|-------|------|--------|
| `next` | 16.2.1 | Very recent (2026 release); `eslint-config-next` matches | LOW | None |
| `react` / `react-dom` | 19.2.4 | React 19 — latest stable; concurrent features available | LOW | None |
| `@anthropic-ai/sdk` | ^0.80.0 | Recent SDK version | LOW | None |
| `stripe` | ^22.0.2 | API version `2026-03-25.dahlia` set in `lib/stripe.ts` | LOW | Verify dahlia API version is stable/released |
| `next-auth` | ^5.0.0-beta.25 | Still in beta; breaking changes possible before stable release | MEDIUM | Monitor for stable release; pin to specific beta if instability observed |
| `@supabase/ssr` | ^0.5.2 | Stable | LOW | None |
| `kafkajs` | ^2.2.4 | Listed as production dependency; no visible Kafka usage in API routes | MEDIUM | Audit actual usage; move to devDependencies or remove if unused |
| `@temporalio/client`, `@temporalio/workflow` | ^1.11.0 | In devDependencies; Temporal workflow engine — no visible production usage found | MEDIUM | Confirm whether Temporal is in active use; remove if not |
| `@types/ioredis` | ^5.0.0 | In devDependencies (correct for type-only) | LOW | None |
| `bcryptjs` | ^2.4.3 | Pure JS bcrypt; slower than native bcrypt | LOW | Acceptable for current usage volume |
| `ioredis` | ^5.10.1 | Production dependency; may be used by kafkajs or directly | LOW | Verify usage paths |

---

## Architecture Assessment

### Security Layer
**Score: 88/100**
Strong implementation. Portal auth (`lib/portalAuth.ts`) checks three auth paths (CRON_SECRET, NextAuth session, ag-auth-token cookie) with constant-time comparison. Middleware applies security headers, bot blacklist, HMAC token verification, and Upstash rate limiting. CSP is well-configured with explicit allowlists. Missing: `X-Frame-Options: DENY` in middleware differs from `SAMEORIGIN` in `next.config.ts` — middleware sets DENY (stricter), which is correct.

### Ledger & Financial
**Score: 91/100**
Double-entry ledger correctly uses bigint cents throughout (`lib/ledger/`). Transaction fee engine uses bigint constants. The display/reporting layer (`lib/commercial/revenueAttribution.ts`) uses float + `toFixed(2)` which is adequate for display but not payment processing. New `lib/financial/safeArithmetic.ts` provides the integer-cents path for any payment flows.

### AI Gateway & Token Governance
**Score: 85/100**
Central `withAI()` wrapper enforces circuit breaker + retry + budget pre-check + audit trail. Token governor uses Upstash Redis for cross-instance budget tracking. Budget enforcer provides plan-level hard limits. Rate limiting for AI routes is in middleware (Upstash-backed). Weakness: `draft-offer` has a redundant in-memory rate check that bypasses the central system.

### Observability
**Score: 78/100**
Structured logger (`lib/logger.ts`) is well-designed: newline-delimited JSON, Sentry integration, correlation IDs, named levels. `lib/observability/telemetry.ts` provides OpenTelemetry hooks. Weakness: ~30 API routes still use `console.*` instead of the structured logger, creating blind spots in log drain and Sentry breadcrumb coverage.

### Compliance & GDPR
**Score: 80/100**
Extensive compliance layer: `lib/compliance/` has 26 files covering GDPR, AML/KYC, SOC2, investor segmentation, retention policies, breach notification, and legal hold. Production readiness gate has 8 blocking conditions. Gap: Production readiness gate checks reference DB tables (e.g., `capital_execution_pipelines`) that may not be populated yet.

### Disaster Recovery
**Score: 75/100**
`lib/dr/` covers backup orchestration, DR testing, and event replay. Circuit breaker persists state in Upstash. Weakness: ML retraining orchestrator uses `Math.random()` for accuracy simulation — this mixes simulation code with production paths.

### Rate Limiting
**Score: 72/100**
Middleware provides Upstash-backed rate limiting for 25+ routes. `lib/rateLimit.ts` provides an Upstash-backed helper for API-level calls. Weakness: three identified locations (`draft-offer`, `market-data`, `base.ts` agent throttle) use in-memory Maps that are cold-start-vulnerable.

---

## Recommendations

Ordered by impact:

1. **[HIGH] Remove `typescript: { ignoreBuildErrors: true }` from `next.config.ts`** — This is the single highest-risk configuration item. It silently allows TypeScript errors to reach Vercel builds. Since the codebase currently has 0 TS errors, this should be removable now.

2. **[HIGH] Migrate `draft-offer/route.ts` in-memory `rateMap` to `persistentRateLimit()`** — AI endpoint at ~€0.015/call is budget-exposed on cold starts. The fix file `lib/rateLimit/persistentRateLimit.ts` is ready; the migration is a 5-line change.

3. **[HIGH] Migrate `market-data/route.ts` cache to Upstash** — Prevents repeated Idealista scraping on cold starts which may trigger IP bans from the scraping provider.

4. **[MEDIUM] Replace `console.*` calls in API routes with structured `log.*`** — ~30 routes identified. Affects Sentry coverage and log drain quality. The logger is already imported in many of these files.

5. **[MEDIUM] Replace `Math.random()` IDs with `secureNanoId()`/`secureId()`** — 15+ files identified. Particularly important in `lib/campaigns/` (job_id, campaign_id, execution_id) and `lib/control-plane/` (action_id). The fix helper `lib/ids/secureId.ts` is ready.

6. **[MEDIUM] Pin `next-auth` to a specific beta version** — `^5.0.0-beta.25` allows auto-upgrade to breaking beta releases. Use `5.0.0-beta.25` without the caret.

7. **[MEDIUM] Audit `kafkajs` and `@temporalio/*`** — Both are heavy dependencies with unclear usage in current production routes. Remove if unused to reduce bundle size and attack surface.

8. **[LOW] Fix `lib/security/encryptionLayer.ts` to use structured logger** — Replace `console.warn` with `log.warn` for consistent observability.

9. **[LOW] Verify DB idempotency constraint for `trackLearningEvent`** — Confirm migration `20260430_002_event_idempotency.sql` is applied in production. If not, duplicate learning events will corrupt ML training data.

10. **[LOW] Replace `Math.random()` in `lib/ops/withRetry.ts` jitter** — Low security impact but creates consistency with the secure-ID pattern being adopted across the codebase.

---

## Production Readiness Verdict

**CONDITIONALLY_READY**

The codebase is architecturally sound and passes strict TypeScript compilation with 0 errors. Security fundamentals (portal auth, HMAC tokens, rate limiting, security headers, CSP) are correctly implemented. The ledger uses bigint cents. Circuit breakers and retry logic are in place.

**Blocking conditions before go-live**:
1. Remove `typescript: { ignoreBuildErrors: true }` — this flag means type regressions can silently reach production
2. Migrate `draft-offer` AI rate limit to `persistentRateLimit()` — real financial exposure on cold starts
3. Confirm Upstash Redis is configured in Vercel production environment (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN) — without these, all rate limiting and circuit breaker state is ephemeral per-instance

**Non-blocking but recommended before launch**:
- Replace console.* with structured logger in ~30 API routes
- Pin next-auth beta version

Once the 3 blocking conditions above are addressed, the platform is production-ready.
