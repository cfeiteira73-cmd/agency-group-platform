# Architecture Truth Report
AGENCY GROUP SH-ROS · Audit Date: 2026-05-17

---

## Executive Summary

SH-ROS is an architecturally ambitious autonomous revenue OS built on Next.js 14 with a well-defined event-driven runtime core, strong type contracts, and a real multi-agent dispatch system. However, the system has accumulated 8–10 parallel versioned modules (v2/v3 suffixed directories) that duplicate functionality already present in the primary modules, and at least 12 lib directories that contain only a single `index.ts` file and are never imported by any app route or other lib module, pointing to speculative/aspirational code that was built but never wired. The operational risk is moderate-to-high because several infrastructure adapters (Kafka, Redis Streams, Temporal, multi-region routing) are conditionally activated by env vars that are not set in production, meaning the system silently falls back to DB-backed stubs.

---

## Scores (0–100)

| Dimension | Score | Reason |
|---|---|---|
| Architecture Coherence | 62/100 | The runtime core (orchestrator → queue → learning → feedback) is coherent and well-layered. The outer shell has fragmented into parallel versioned modules and orphan lib directories that blur responsibility boundaries. |
| Simplicity | 41/100 | 66 lib directories, 279 API routes, and 94K lines for what is functionally a real-estate CRM + AI agent dispatcher. Multiple modules solve the same problem (economic closed loop v1 vs v2, ops vs operations, intelligence vs agents). |
| Scalability | 55/100 | Multi-region routing, Kafka, Redis Streams, and Temporal are all stubbed with fallback adapters — the architecture supports scale on paper, but none of the scaling infrastructure is wired to production. DB-backed fallbacks will not scale past ~500 concurrent events. |
| Maintainability | 48/100 | 679 raw `any` occurrences across 122 files, 350 `eslint-disable no-explicit-any` suppressions, 53 files with bare `console.*` calls instead of the custom logger, and 10+ stub modules. New engineers will struggle to determine which version of a module is canonical. |
| Operational Risk | 44/100 (100=low risk) | The fake `rateLimitHeaders()` in `app/api/deals/route.ts` always returns `X-RateLimit-Remaining: 99` regardless of actual state. Hard-coded defaults in the economic closed-loop catch-up (`match_score: 50`, `predicted_close_days: 210`, `ev_at_creation: 0`) corrupt learning signals. Infrastructure env-var gates with silent fallback mean capability differences between dev and production are invisible. |
| Technical Debt | 39/100 (100=clean) | Extremely high. Two parallel naming conventions (`ops/` vs `operations/`), v1/v2/v3 module proliferation without deletion of v1, 12+ single-file stub modules, and `eslint-disable` comments used as a permanent solution instead of proper typing. |

---

## What Is World-Class

1. **Runtime type system** (`lib/runtime/types.ts`): The `RuntimeEvent` contract with `schema_version: 'vFINAL'`, discriminated union payload types, and the `EVENT_AGENT_ROUTING` lookup matrix is institutional-grade. Immutable event design with explicit idempotency keys is correct.

2. **Orchestrator design** (`lib/runtime/orchestrator.ts`): The 12-step persist-before-execute pipeline with named FIX comments documenting prior audit findings shows genuine iteration. Custom `RuntimeValidationError` / `RuntimePersistError` hierarchy is production-correct.

3. **Economic Closed Loop V2** (`lib/economic-closed-loop-v2/index.ts`): Pure TypeScript, no DB side-effects in the module itself, caller handles persistence. The funnel stage weighting system with `STAGE_WEIGHTS` calibrated to Portugal 2026 market data (`210 days`, `5% commission`) is a genuinely differentiated data asset.

4. **OpportunityScoreV2** (`lib/scoring/opportunityScoreV2.ts`): Cleanly extends V1 without breaking it. Confidence penalty mechanism and `OpportunityGrade` enum are textbook scoring architecture.

5. **Agent implementation structure** (`lib/agents/implementations/`): 16 named agents each covering a distinct business domain (pipeline-stall, revenue-leak, forecasting, etc.) with a shared `BaseAgent` base class and `AgentOutputContract` type. Registry-based dispatch is correct.

6. **Property type system** (`lib/property-ai/types.ts`): Complete, domain-accurate type coverage with discriminated enums for Portuguese market specifics (EnergyClass, ZoneClassification, ArchitectureStyle). Zero optional-everything laziness.

7. **Workflow engine abstraction** (`lib/runtime/workflows/workflowEngine.ts`): Clean `IWorkflowEngine` interface with a DB-backed default and optional Temporal wiring via env var. The abstraction boundary is correct even if the Temporal side is not yet live.

8. **Zod validation on public endpoints** (`app/api/properties/route.ts`): `PartnerSubmissionSchema` with field-level constraints, `safeParse`, and structured error responses. Correct pattern applied consistently on intake routes.

---

## Critical Risks

### RISK-1 (CRITICAL): Fake Rate-Limit Headers in Deals API
**File:** `app/api/deals/route.ts` lines 27–34  
`rateLimitHeaders()` always returns `X-RateLimit-Remaining: 99`. There is no actual rate limiting applied to the deals write path. Any client inspecting the header will believe limits exist; they do not. The `rateLimit` utility (`lib/rateLimit.ts`) exists and is used in `app/api/properties/route.ts` but is not wired to the deals route.

### RISK-2 (CRITICAL): Corrupted Learning Signals in Catch-Up Run
**File:** `lib/runtime/economicClosedLoop.ts` lines 241–246  
`runCatchUp()` feeds synthetic defaults into `processOutcome()` for all closed deals: `match_score: 50`, `predicted_close_days: 210`, `ev_at_creation: 0`. This means every catch-up run generates learning events where the prediction was "50% match, 210 days" regardless of reality, systematically poisoning the reinforcement weight store for all agents that had these deals.

### RISK-3 (HIGH): Infrastructure Silent Fallback
**Files:** `lib/runtime/workflows/workflowEngine.ts` line 348, `lib/runtime/queue/queueProvider.ts`, `lib/runtime/distributed/multiRegionRouter.ts`  
Kafka, Redis Streams, Temporal, and multi-region routing are all conditionally activated. When `TEMPORAL_ADDRESS`, `KAFKA_BROKERS`, or `REDIS_STREAM_URL` are unset, the system silently uses DB-backed stubs. There is no startup warning, no health check surface for this degraded mode, and no documentation of what the production stack actually uses.

### RISK-4 (HIGH): Supabase `any` Casting Pattern in Core Files
**Files:** `lib/runtime/economicClosedLoop.ts` lines 129–132, `app/api/deals/route.ts` line 67  
The pattern `supabaseAdmin as unknown as { from: (t: string) => unknown }` followed by chained casts to `any` bypasses all type safety on DB interactions. An incorrect table name or column mismatch fails at runtime with no TypeScript warning.

### RISK-5 (HIGH): `console.error` in Production Path
**File:** `app/api/properties/route.ts` line 75  
Direct `console.error` in a POST handler that runs on every partner submission. 53 lib files use bare `console.*` instead of `lib/logger.ts`. These produce unstructured log output that bypasses Sentry/observability correlation.

### RISK-6 (MEDIUM): Duplicate Module Registration Risk
**Files:** `lib/ops/` vs `lib/operations/`  
Two separate directories cover operational concerns: `ops/` (alertEngine, cronLock, featureFlags, governance, incidentLog, jobQueue, operatorTasks) and `operations/` (bottleneckPredictor, frictionDetector, operationalAnomaly, operatorEfficiency, workflowOptimizer). No clear boundary separates them, and neither is referenced from app routes.

### RISK-7 (MEDIUM): Partial Auth Pattern in Deals API
**File:** `app/api/deals/route.ts` lines 48–50  
Auth check uses `auth() || isPortalAuth(req)` — if `auth()` returns a non-null session for a completely invalid/expired token (depending on NextAuth adapter behavior), `isPortalAuth` is never called. The safer pattern would be `const session = await auth(); const portal = await isPortalAuth(req); if (!session?.user && !portal)`.

---

## Module Duplication / Redundancy

| Canonical Module | Duplicate / Overlap | Nature of Overlap |
|---|---|---|
| `lib/runtime/economicClosedLoop.ts` | `lib/economic-closed-loop-v2/index.ts` | V1 tracks deal outcomes → DB. V2 is pure funnel graph builder. Different concerns but same conceptual domain. V1 is wired in runtime; V2 is wired only in `simulations` routes. No shared abstraction. |
| `lib/autonomy/` (5 files) | `lib/agent-autonomy-v2/index.ts` (1 file) | V2 contains only an action simulation engine. V1 has confidence gates and rollback. Different capabilities, same namespace. V2 is wired only in `app/api/simulations/route.ts`. |
| `lib/economics/` (7 files) | `lib/executive-revenue-v2/index.ts` (types only) | Revenue snapshot types in v2 overlap with `lib/economics/revenueAttribution.ts`. V2 is wired only in `app/api/executive/dashboard/route.ts`. |
| `lib/product/` (7 files) | `lib/product-simplification-v2/index.ts` (1 file) | V2 is not imported anywhere. |
| `lib/intelligence/` (20 files) | `lib/market-learning-v2/index.ts` (1 file) | V2 contains MarketState type and zone defaults. `lib/intelligence/marketSegments.ts` and `lib/intelligence/marketMicrostructure.ts` cover overlapping concepts. V2 is wired only via simulations. |
| `lib/ops/` (9 files) | `lib/operations/` (6 files) | Both cover operational monitoring with no clear boundary. Neither is referenced by app routes. |
| `lib/scoring/opportunityScore.ts` | `lib/scoring/opportunityScoreV2.ts` | V2 correctly wraps V1 — this is the right pattern. Not a redundancy risk. |
| `lib/go-to-market/pricingEngine.ts` | `lib/pricing-intelligence/index.ts` | GTM pricingEngine handles SaaS tier pricing (PricingTier, ROIEstimate for platform sales). Pricing intelligence handles property AVM-based pricing cards. Different domains, confusingly similar naming. |
| `lib/commercial/moat.ts` | `lib/moat/` (5 files) | Both compute competitive defensibility scores. `commercial/moat.ts` is a single function. `lib/moat/` is a full module with MoatScore aggregation. Neither is imported from app routes. |

---

## Dead Code / Orphan Logic

The following directories contain code that has zero import references from any `app/` route or any other `lib/` module (confirmed by grepping):

- `lib/agent-autonomy-v2/index.ts` — wired only from `app/api/simulations/route.ts` (simulation endpoint, not production flow)
- `lib/product-simplification-v2/index.ts` — zero imports found anywhere
- `lib/discovery-v2/index.ts` — zero imports found anywhere
- `lib/distribution-v2/index.ts` — zero imports found anywhere
- `lib/ranking-engine-v3/index.ts` — zero imports found anywhere
- `lib/ops/` entire directory — zero app route imports
- `lib/operations/` entire directory — zero app route imports
- `lib/forensics/` entire directory — zero app route imports
- `lib/commercial/` entire directory — zero app route imports
- `lib/enterprise/` entire directory — zero app route imports
- `lib/moat/` entire directory — zero app route imports
- `lib/platform/` — zero imports found
- `lib/autonomous-marketing/` — zero imports found
- `lib/buyer-intelligence/` — wired only in `app/api/conversion/funnel/route.ts`
- `lib/runtime/distributed/` entire directory — exported from `lib/runtime/index.ts` but no app route calls distributed functions directly

---

## Technical Debt Register

| ID | File | Issue |
|---|---|---|
| TD-01 | `app/api/deals/route.ts:27–34` | Fake rate-limit headers. Wire `rateLimit()` or remove misleading headers. |
| TD-02 | `lib/runtime/economicClosedLoop.ts:241–246` | Hardcoded synthetic defaults in `runCatchUp()` corrupt RL signal store. |
| TD-03 | `lib/runtime/economicClosedLoop.ts:129–132` | `supabaseAdmin as unknown as {...}` pattern — replace with generated Supabase types. |
| TD-04 | 350 locations | `eslint-disable @typescript-eslint/no-explicit-any` used as permanent fix. Budget one sprint to replace with proper Supabase generated types. |
| TD-05 | 53 lib files | `console.log/warn/error` instead of `lib/logger.ts`. Breaks Sentry correlation. |
| TD-06 | `app/api/radar/search/route.ts:2212` | `TODO: implementar com Idealista API Oficial` — critical data dependency left as TODO. |
| TD-07 | `lib/product-simplification-v2/`, `lib/discovery-v2/`, `lib/distribution-v2/`, `lib/ranking-engine-v3/` | Single-file modules never imported. Delete or wire. |
| TD-08 | `lib/ops/` and `lib/operations/` | Duplicate operational monitoring namespaces. Merge into one. |
| TD-09 | `lib/commercial/` and `lib/moat/` | Duplicate moat/defensibility scoring. Merge. |
| TD-10 | `app/api/crm/email-draft/route.ts:40,49` | Placeholder `+351 XXX XXX XXX` phone number in email signature sent to real contacts. |

---

## Architectural Recommendations

**Priority 1 — Fix corrupted learning signals (TD-02)**  
Before the economic closed-loop produces meaningful insights, `runCatchUp()` must either store real prediction data at deal creation time and join it here, or skip deals where no prediction was recorded rather than using synthetic defaults.

**Priority 2 — Wire real rate limiting to deals API (TD-01)**  
Copy the `rateLimit()` call pattern from `app/api/properties/route.ts` into the deals POST/PUT/DELETE handlers.

**Priority 3 — Generate and use Supabase types**  
Run `supabase gen types typescript` and replace the `supabaseAdmin as unknown as any` casting pattern. This eliminates the largest category of runtime risk and the largest source of `any` usage simultaneously.

**Priority 4 — Establish a module deprecation policy**  
Create a `DEPRECATED.md` listing all v1 modules that have a v2 replacement. For modules where v2 is wired and v1 is not, delete v1. For modules where neither is wired, delete both. Currently there is no signal about what is canonical.

**Priority 5 — Replace `console.*` with `logger` across the 53 offending files**  
The custom logger (`lib/logger.ts`) exists and is used in the runtime core. It needs to be adopted uniformly.

**Priority 6 — Document infrastructure mode**  
Add a startup check that logs (at `warn` level) whether the system is running in DB-fallback mode vs. Kafka/Redis/Temporal mode. Currently there is no observability into which infrastructure tier is active.

**Priority 7 — Consolidate `ops/` and `operations/`**  
Merge the 15 files across these two directories into one `lib/ops/` with a clear sub-namespace split (runtime-ops vs. process-ops). Remove the orphan `operations/` directory.

**Priority 8 — Delete or wire the five single-file orphan v2/v3 modules**  
`lib/product-simplification-v2/`, `lib/discovery-v2/`, `lib/distribution-v2/`, `lib/ranking-engine-v3/` should each either be imported by a real route or deleted. Their presence creates confusion about the canonical module path.

**Priority 9 — Fix email signature placeholder (TD-10)**  
`app/api/crm/email-draft/route.ts` sends real emails to real contacts with `+351 XXX XXX XXX` as the phone number.

**Priority 10 — Idealista API integration (TD-06)**  
`app/api/radar/search/route.ts` has `return 0 // TODO: implementar com Idealista API Oficial`. This is a core data source for deal radar. A hard timeline is needed.

---

## What Must NOT Be Changed

- **`lib/runtime/types.ts`** — the `RuntimeEvent` contract is the single source of truth. Do not split or refactor without extreme caution; it is the contract between all agents, the orchestrator, and the DB.
- **`lib/runtime/orchestrator.ts`** — the 12-step pipeline is correct. The FIX comments are evidence of deliberate iteration. Do not simplify this file; the order of steps matters for idempotency guarantees.
- **`lib/agents/implementations/`** — the 16-agent structure is well-scoped. Do not merge agents to reduce file count; the separation is a feature, not fragmentation.
- **`lib/property-ai/types.ts`** — complete, domain-accurate type definitions. Changing field names or types here has downstream impact on all AI pipeline output parsing.
- **`lib/scoring/opportunityScoreV2.ts`** and the V1/V2 wrapper pattern — the decision to extend rather than replace V1 was correct. Preserve this pattern for future scoring iterations.
- **The Zod validation pattern on intake routes** — `PartnerSubmissionSchema` and similar schemas are the only defense against malformed data at the boundary. Do not remove them in favor of manual parsing.
