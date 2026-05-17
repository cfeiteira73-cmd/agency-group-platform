# Codebase Integrity Report
AGENCY GROUP SH-ROS · 2026-05-17

---

## Stats

| Metric | Value |
|---|---|
| Total TypeScript files | 1,107 |
| Total lines | 94,813 |
| API routes | 279 |
| Lib module directories | 66 |
| TypeScript compiler errors | 0 |
| Raw `any` keyword occurrences (lib/) | 679 across 122 files |
| `eslint-disable no-explicit-any` suppressions | 350 across 100 files |
| Files with bare `console.*` calls (lib/) | 53 |
| Confirmed tech-debt markers (TODO/FIXME/HACK/XXX) | ~10 in lib/ + app/api/ |

---

## Type Safety Analysis

### Raw Numbers
- 679 occurrences of the `any` keyword across 122 lib files
- 350 `eslint-disable @typescript-eslint/no-explicit-any` comment suppressions across 100 files

### Acceptable vs. Risky Usage

**Acceptable (annotated and justified):**
- `lib/runtime/economicClosedLoop.ts:164` — `// eslint-disable-next-line @typescript-eslint/no-explicit-any` before a Supabase query result where the shape is unknown at compile time. Single-line suppression with explicit justification context.
- `lib/runtime/workflows/workflowEngine.ts:90` — same pattern for DB result casting at one callsite.
- `lib/runtime/incidentGovernance.ts` — ~18 occurrences all in DB read paths where the shape is not yet typed by generated types.

**Risky (structural, not incidental):**
- `lib/runtime/economicClosedLoop.ts:129–132` — the compound cast `supabaseAdmin as unknown as { from: (t: string) => unknown }` is dangerous. This is not a "I don't know the shape" pattern but a deliberate bypass of the admin client's type system. A wrong table name silently succeeds TypeScript compilation and fails at runtime.
- `lib/runtime/realityConsistency.ts` — 24 occurrences. This is among the highest-concentration files. At this density, the file's type safety is effectively nil.
- `lib/intelligence/modelVersioning.ts` — 21 occurrences. A model versioning module with no reliable types is a reliability risk: version comparison logic based on unchecked shapes can silently misroute.
- `lib/ops/operatorTasks.ts` and `lib/ops/jobQueue.ts` — 7 occurrences each. Both are operational queue files where incorrect types could cause silent data loss.
- `lib/security/tenantIsolationLayer.ts` — 16 occurrences. Any `any` in tenant isolation is a cross-contamination risk. This file specifically needs proper typing.

### Root Cause
The root cause of the `any` density is the absence of generated Supabase TypeScript types. The `lib/database.types.ts` file exists but its adoption is incomplete — most files cast around it rather than importing from it. One sprint of replacing the casting pattern with proper `Database['public']['Tables']['tablename']['Row']` types would eliminate the majority of risky `any` occurrences.

---

## Tech Debt Markers

**Confirmed markers (actual debt, not string literals):**

| File | Line | Marker | Content |
|---|---|---|---|
| `app/api/radar/search/route.ts` | 2212 | TODO | `TODO: implementar com Idealista API Oficial (developers.idealista.com)` — returns hardcoded 0 |
| `app/api/radar/route.ts` | 522 | TODO | `TODO: substituir por lib/idealista-api.ts quando IDEALISTA_API_KEY configurado` |
| `app/api/crm/email-draft/route.ts` | 40, 49 | XXX | `+351 XXX XXX XXX` in live email signatures sent to real contacts |

**Apparent but context-specific (template literals, not code debt):**
- `app/api/deal/draft-offer/route.ts:66` — `AG-2026-XXX` is an example reference in a prompt template, not a real code TODO.
- `app/api/sofia-agent/chat/route.ts:63` — `€X,XXX/m²` inside an AI prompt string, not code.
- `app/api/content/route.ts:411` — Portuguese prompt instruction containing the word "TODOS" (= "all" in Portuguese), not an English TODO marker.

**Summary:** 3 genuine tech-debt markers. The Idealista API TODO is the most impactful — two separate route files return stub values for deal radar data that should be live market data.

---

## Console / Debug Leaks

53 lib files contain bare `console.log`, `console.warn`, or `console.error` calls. These bypass the custom structured logger at `lib/logger.ts` and produce unstructured output that does not carry Sentry correlation IDs, trace IDs, or org_id context.

**Highest-risk files (by concern level):**

| File | Risk |
|---|---|
| `lib/runtime/orchestrator.ts` | Uses logger — compliant |
| `lib/runtime/recovery/distributedLocks.ts` | console.* — lock acquisition/release events lost to structured log |
| `lib/runtime/queue/kafkaProvider.ts` | console.* — Kafka connection events not observable in Sentry |
| `lib/compliance/gdprEngine.ts` | console.* — GDPR deletion events must be in structured audit trail |
| `lib/compliance/immutableAudit.ts` | console.* — audit events logged via console are not immutable |
| `lib/agents/base.ts` | console.* — agent execution events partially unstructured |
| `lib/push/notifications.ts` | console.* — push notification failures not in structured log |
| `lib/rateLimit.ts` | console.* — rate limit enforcement events not observable |

**The compliance files are the most critical.** `lib/compliance/gdprEngine.ts` and `lib/compliance/immutableAudit.ts` using `console.*` means GDPR deletion confirmations and audit chain entries may not appear in the observable log pipeline. This is a compliance documentation risk.

---

## Naming Consistency

### Consistent (good)
- All `app/api/` route files consistently export named HTTP method handlers (`GET`, `POST`, `PUT`, `DELETE`) with `NextRequest` / `NextResponse` types.
- All lib barrel files use `index.ts` as the barrel export entry point.
- All runtime types use `snake_case` for property names consistently (`event_id`, `org_id`, `created_at`).
- Agent IDs are consistently kebab-case string literals (`'follow-up'`, `'pipeline-stall'`, `'kpi-intelligence'`).
- Environment variable access uses `process.env.VAR_NAME` consistently (not `process.env['VAR_NAME']` in most places, with some exceptions in `lib/runtime/workflows/temporalProvider.ts` which uses bracket notation).

### Inconsistent (bad)
- **Module naming: word separator style.** Some directories use kebab-case (`buyer-to-conversion`, `go-to-market`, `pricing-intelligence`, `agent-autonomy-v2`) while others use camelCase path components (`property-ai` consistent, but `lib/propertyAI` would be different). The majority is kebab-case — this is fine, but mixed within the same namespace level.
- **v1/v2/v3 versioning has no convention.** Some modules append `-v2` to the directory name (`economic-closed-loop-v2`, `market-learning-v2`) while others use V2 suffix inline (`opportunityScoreV2.ts`). No convention exists for when a version bump warrants a new directory vs. a new file vs. extending the existing file.
- **`ops/` vs `operations/`:** Two directories for operational concerns with no convention distinguishing them.
- **Auth patterns differ across routes.** `app/api/deals/route.ts` uses `auth() + isPortalAuth()`. `app/api/matches/route.ts` uses `portalAuthGate()`. `app/api/properties/route.ts` uses both `auth() + isPortalAuth()` on GET and just `rateLimit()` (no auth at all) on POST for public partner submission. The inconsistency is partially intentional (public vs. private) but not documented.
- **Supabase client instantiation:** `app/api/matches/route.ts` creates a new `createClient()` inline. Most other routes import `supabaseAdmin` from `lib/supabase`. The inline creation in matches skips the shared admin client, which may have different connection pool behavior.

---

## Import Pattern Analysis

### `@/` alias usage
The `@/` alias for the project root is used consistently across all lib and app files. No relative `../../` import paths were found in app or lib code. The alias is configured in `tsconfig.json` and respected uniformly.

### Circular import risk
No confirmed circular imports were detected in the examined files. The dependency direction is:
```
app/api → lib/agents → lib/runtime → lib/supabase
                     → lib/economics (no upward imports)
lib/product → (no lib/runtime imports found)
lib/autonomy → (no lib/product imports found)
```
The major risk vector would be `lib/runtime → lib/agents → lib/runtime` (orchestrator calls agent registry; agent base might call orchestrator for follow-up events). This was not confirmed as a cycle because `lib/agents/base.ts` was only sampled to 2 lines. Manual verification recommended.

### Barrel re-export depth
`lib/runtime/index.ts` re-exports from 7 sub-directories and 3 top-level files. This is the deepest barrel. Deep barrels can cause slow cold-start times in serverless environments. The runtime module should be considered for tree-shaking verification.

---

## Duplicate Functionality

| Functionality | File A | File B | Notes |
|---|---|---|---|
| Economic closed loop | `lib/runtime/economicClosedLoop.ts` | `lib/economic-closed-loop-v2/index.ts` | V1: DB-write, deal outcome RL. V2: pure funnel graph. Different enough to coexist but naming is confusing. |
| Moat / defensibility scoring | `lib/commercial/moat.ts` | `lib/moat/` (5 files) | `commercial/moat.ts` is a single `computeMoatScore()` function. `lib/moat/` has a full multi-dimensional engine. The simpler one is redundant. |
| Revenue attribution | `lib/economics/revenueAttribution.ts` | `lib/commercial/revenueAttribution.ts` | Two separate revenue attribution modules. Neither appears to be imported from app routes. Names are identical, paths differ. |
| Operational anomaly detection | `lib/ops/alertEngine.ts` | `lib/operations/operationalAnomaly.ts` | Both detect and alert on system anomalies. `ops/` is older; `operations/` appears to be a newer rewrite. |
| Workflow optimization | `lib/ops/governance.ts` | `lib/operations/workflowOptimizer.ts` | Both optimize workflow execution. |
| Pricing | `lib/go-to-market/pricingEngine.ts` | `lib/pricing-intelligence/index.ts` | Different domains (SaaS tier pricing vs. property AVM), similar naming. Low confusion risk if engineers read the files, high confusion risk at directory scan level. |

---

## Dead / Unreferenced Modules

Modules confirmed to have zero imports from any `app/` route (not counting the `simulations` demo endpoint):

| Module | Directory | Files | Fate Recommendation |
|---|---|---|---|
| Product Simplification V2 | `lib/product-simplification-v2/` | 1 (index.ts) | Delete or document as roadmap item |
| Discovery V2 | `lib/discovery-v2/` | 1 (index.ts) | Delete or document |
| Distribution V2 | `lib/distribution-v2/` | 1 (index.ts) | Delete or document |
| Ranking Engine V3 | `lib/ranking-engine-v3/` | 1 (index.ts) | Delete or document |
| Autonomous Marketing | `lib/autonomous-marketing/` | 1 (index.ts) | Delete or document |
| Platform | `lib/platform/` | 1 (index.ts) | Delete or document |
| Ops | `lib/ops/` | 9 files | Merge into lib/runtime or app/api/cron routes |
| Operations | `lib/operations/` | 6 files | Merge with ops/ |
| Forensics | `lib/forensics/` | 5 files | Wire to observability API or delete |
| Commercial | `lib/commercial/` | 7 files | Wire to executive dashboard or delete |
| Enterprise | `lib/enterprise/` | 8 files | Wire to tenant provisioning API or delete |
| Moat | `lib/moat/` | 5 files | Merge with commercial/moat.ts |

**Total dead code estimate: ~12 directories, ~45 TypeScript files, ~3,000–4,000 lines.**

---

## Recommended Immediate Fixes

**Fix 1 — Remove fake rate-limit headers from deals API (30 min)**  
`app/api/deals/route.ts`: Remove `rateLimitHeaders()` function and its usage, or replace with actual `rateLimit()` call. A misleading security header is worse than no header.

**Fix 2 — Replace inline Supabase client in matches route (15 min)**  
`app/api/matches/route.ts` lines 14–17: Replace `createClient(process.env..., process.env...)` with `import { supabaseAdmin } from '@/lib/supabase'`. The inline client bypasses the shared admin connection pool.

**Fix 3 — Replace `console.error` with `logger.error` in properties route (5 min)**  
`app/api/properties/route.ts` line 75: Replace `console.error('[properties POST] contacts upsert error:', e)` with `logger.error('[properties POST] contacts upsert error', { error: String(e) })`.

**Fix 4 — Fix email signature placeholder (10 min)**  
`app/api/crm/email-draft/route.ts` lines 40, 49: Replace `+351 XXX XXX XXX` with the real Agency Group phone number or an environment variable `process.env.AGENCY_PHONE`.

**Fix 5 — Guard `runCatchUp()` against synthetic signal poisoning (1 hour)**  
`lib/runtime/economicClosedLoop.ts:runCatchUp()`: Add a check — if `deal.match_score` is null/undefined in the DB record, skip calling `processOutcome()` for that deal rather than using default 50. Only process deals that have real stored predictions. Add a counter for skipped deals in the return value.

---

## Recommended Deferred Work

**Deferred 1 — Generate Supabase TypeScript types and adopt across lib/ (1–2 sprints)**  
Run `supabase gen types typescript --local > lib/database.types.ts`. Then systematically replace the `as any` DB query patterns with typed table accessors. Start with `lib/security/tenantIsolationLayer.ts` (16 occurrences), `lib/runtime/realityConsistency.ts` (24 occurrences), and `lib/intelligence/modelVersioning.ts` (21 occurrences).

**Deferred 2 — Replace console.* with lib/logger across 53 files (1 sprint)**  
Focus first on the compliance files: `lib/compliance/gdprEngine.ts`, `lib/compliance/immutableAudit.ts`. These have regulatory implications. Then runtime files: `lib/runtime/recovery/`, `lib/runtime/queue/`.

**Deferred 3 — Audit and delete the 12 dead lib directories (1 sprint)**  
For each directory: grep for all imports, confirm zero wiring, move any genuinely useful logic into the canonical module, delete the rest. Target: reduce lib/ from 66 directories to ~45.

**Deferred 4 — Merge ops/ and operations/ into a single lib/ops/ (0.5 sprint)**  
Establish the boundary: runtime-ops (cronLock, jobQueue, featureFlags, alertEngine) vs. process-ops (workflowOptimizer, frictionDetector). Both can live in `lib/ops/runtime/` and `lib/ops/process/`.

**Deferred 5 — Wire Idealista API (depends on API key)**  
`app/api/radar/search/route.ts` and `app/api/radar/route.ts` both have stubs waiting for `IDEALISTA_API_KEY`. `lib/idealista-api.ts` already exists with the client implementation. Once the API key is available, the integration is a 2–4 hour wiring task.

**Deferred 6 — Clarify infrastructure mode at startup**  
Add a startup log in `instrumentation.ts` that checks for `TEMPORAL_ADDRESS`, `KAFKA_BROKERS`, and `REDIS_STREAM_URL` and logs the active provider for each subsystem. This surfaces the "DB fallback" state visibly in deployment logs.

**Deferred 7 — Verify no circular import between runtime and agents**  
Trace the import path: `lib/runtime/orchestrator.ts → lib/agents/registry.ts → lib/agents/base.ts → ?`. If `base.ts` calls anything from `lib/runtime/`, a circular dependency exists. This should be verified with a bundler analysis (`next build --profile` or `madge`).
