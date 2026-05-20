# SH-ROS MASTER SYSTEM BIBLE
## Version: 1.0.0 | Created: 2026-05-19 | Status: IMMUTABLE
## Project: agencygroup.pt | AMI: 22506 | Tenant: agency-group

> IMMUTABILITY NOTICE: This document is append-only. Never overwrite existing sections.
> Amendments must be added as versioned addenda at the bottom. Track all changes in decisions/decision-log.md.

---

## 0. Mission

**SH-ROS** = Self-Healing Revenue Operating System for luxury real estate.

Agency Group operates in the Portuguese luxury property market with reach across Portugal mainland,
Madeira, Açores, and Spain. The system's purpose is to autonomously identify high-value buyer-property
matches, generate deal packs, orchestrate follow-up, and close transactions — with full auditability,
causal tracing, and self-healing under failure.

- **AMI**: 22506
- **Commission**: 5% (50% at CPCV signing + 50% at Escritura)
- **Segment**: €100K–€100M | Core sweet spot €500K–€3M
- **Geography**: Portugal (Lisboa, Porto, Algarve, Madeira, Açores) + Spain
- **Primary buyer nationalities**:
  - €500K–€3M: North Americans 16%, French 13%, British 9%, Chinese 8%, Brazilians 6%, Germans 5%, Middle East
  - €100K–€500K: Portuguese, Brazilians #1, Angolans, French
  - €3M+: Family offices, Global HNWI, Middle East, Asian investors
- **Market 2026**: €3,076/m² median · +17.6% YoY · 169,812 transactions · 210 days avg on market
  - Lisboa €5,000/m² | Cascais €4,713 | Algarve €3,941 | Porto €3,643 | Madeira €3,760 | Açores €1,952

---

## 1. System Architecture — 7 Layers

The SH-ROS is organized as 7 vertical layers, each with a clear responsibility boundary.
All layers communicate through events (Layer 1) and are observable via Layer 5.

### Layer 0 — Infrastructure
**Components**: Supabase (PostgreSQL 17), Vercel (Next.js hosting), n8n Cloud (automation), Upstash Redis
**Responsibilities**:
- Persistent storage (Supabase: 28 tables, pgvector, RLS)
- Serverless compute (Vercel: API routes, cron jobs, edge middleware)
- Workflow automation (n8n: 29 active workflows)
- Ephemeral state, circuit breakers, rate limits, token budgets (Upstash Redis)
**Key config**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_REDIS_REST_URL`

### Layer 1 — Event Bus
**Location**: `lib/events/`
**Files**: `eventBus.ts`, `eventTypes.ts`, `eventPersistence.ts`, `eventDedup.ts`
**Responsibilities**:
- In-memory pub/sub with typed subscribers
- Tenant-scoped events (every event carries `tenant_id`)
- Redis dedup (key: `{tenant_id}:ev_dedup:{sha256(payload)}`, TTL 24h)
- Supabase persistence to `event_history` table (fire-and-forget, non-blocking)
- Correlation ID propagation across all downstream handlers
**Contract**: Every event implements `BaseEvent` (see Section 4)

### Layer 2 — AI Control Plane
**Location**: `lib/ai/`
**Files**: `policyEngine.ts`, `agentRegistry.ts`, `contracts.ts`, `feedbackEngine.ts`,
          `memory.ts`, `policyTuning.ts`, `withAI.ts`, `withAIStream.ts`, `withRetry.ts`
**Responsibilities**:
- `checkPolicy()`: gate every AI call — returns ALLOW | DENY | ESCALATE
- `withAI()`: wraps Anthropic/OpenAI calls with circuit breaker + retry + audit logging
- `withAIStream()`: streaming variant (no retry — stream cannot be replayed mid-flight)
- Agent registry: maps agent IDs to models, budgets, risk levels
- Feedback engine: collects human ratings, updates policy tuning log
- Memory: agent_memory table — per-agent, per-tenant persistent context
**Fail-safe**: if `checkPolicy()` throws → default ALLOW (fail-open to prevent blocking revenue ops)

### Layer 3 — Revenue Engine
**Location**: `lib/revenue/`, `app/api/matches/`, `app/api/deals/`, `app/api/deal-packs/`
**Tables**: `matches`, `deals`, `deal_packs`, `priority_items`
**Responsibilities**:
- Match scoring: buyer ↔ property compatibility (0–100 score)
- Automatic deal pack generation for HIGH matches (score ≥ 80)
- Pipeline stage management: MATCH → DECISION → DEAL_PACK → SEND → FOLLOWUP → CLOSE
- Commission calculation and CPCV tracking
- Priority queue: `priority_items` table drives daily agent task list

### Layer 4 — Automation
**Location**: `app/api/automation/`, `vercel.json` (cron section), n8n workflows
**Responsibilities**:
- 29 cron jobs defined in `vercel.json` (daily briefs, integrity checks, GDPR purge, etc.)
- n8n webhooks: inbound lead processing, WhatsApp routing, email sequences
- Scheduled follow-up sequences (3-day, 7-day, 14-day, 30-day)
- Background job workers: `lib/queue/workers/` (DLQ processor, match processor)

### Layer 5 — Observability
**Location**: `lib/observability/`, tables: `ai_audit_log`, `causal_trace`, `event_history`
**Responsibilities**:
- Every AI call logged to `ai_audit_log` (agent_id, model, tokens, latency, cost, output_hash)
- Causal trace: every revenue decision linked in `causal_trace` (see Section 5)
- Correlation ID: generated at request entry (middleware.ts), propagated to all downstream
- Sentry: error tracking + performance monitoring
- Token budget tracking: per-agent monthly spend vs. budget

### Layer 6 — Security
**Location**: `lib/auth/rbac.ts`, `lib/security/`
**Files**: `siem.ts`, `intrusionDetection.ts`, `secretsRotation.ts`, `rateLimiter.ts`
**Responsibilities**:
- RBAC: 7 roles × 16 permissions (see Section 9)
- SIEM: structured security event logging to 4 sinks (console, Sentry, Datadog, Supabase)
- Intrusion detection: 4 threat patterns (replay storm, webhook flood, prompt injection, unusual AI spend)
- Secrets rotation: tracked in `secret_rotation_log`, alerts on certificates approaching expiry
- Rate limiting: Upstash Redis sliding window (per route, per tenant, per user)

### Layer 7 — Resilience
**Location**: `lib/resilience/`
**Files**: `circuitBreaker.ts`, `withRetry.ts`, `dlqProcessor.ts`, `healthCheck.ts`
**Responsibilities**:
- Circuit breaker: 5 failures → OPEN, 60s cooldown, 3 successes → CLOSE (Redis-backed state)
- `withRetry`: 3 attempts, exponential backoff (1s → 2s → 4s), 30s timeout per attempt
- Dead Letter Queue: failed `job_queue` items → `dlq-processor` worker retries with backoff
- Health check: `/api/health` exposes layer-by-layer status (DB, Redis, AI, n8n)
- All Supabase writes: fire-and-forget (void) to prevent I/O blocking request pipeline

---

## 2. Technology Stack

| Service | Provider | Purpose | Key Env Var |
|---------|----------|---------|-------------|
| Runtime | Next.js 15 (App Router) | Web + API | — |
| Language | TypeScript strict | All code | — |
| Database | Supabase (PostgreSQL 17) | Persistent data | `SUPABASE_URL` |
| DB Project | isbfiofwpxqqpgxoftph | eu-west region | `SUPABASE_SERVICE_ROLE_KEY` |
| Cache/State | Upstash Redis | Circuit breakers, rate limits, dedup, quotas | `UPSTASH_REDIS_REST_URL` |
| AI Primary | Anthropic Claude | claude-haiku-4-5 (fast), claude-opus-4-6 (reasoning) | `ANTHROPIC_API_KEY` |
| AI Embeddings | OpenAI | text-embedding-3-small (pgvector) | `OPENAI_API_KEY` |
| AI Transcription | OpenAI Whisper | Call transcription | `OPENAI_API_KEY` |
| Automation | n8n Cloud | Workflows, webhooks | `N8N_WEBHOOK_URL` |
| n8n URL | agencygroup.app.n8n.cloud | — | `N8N_API_KEY` |
| Email | Resend | Transactional email | `RESEND_API_KEY` |
| Email From | geral@agencygroup.pt | Default sender | — |
| WhatsApp | Meta Cloud API | +351 919948986 | `WHATSAPP_TOKEN` |
| Video AI | HeyGen | Sophia avatar videos | `HEYGEN_API_KEY` |
| Push | VAPID (web push) | Browser push notifications | `VAPID_PRIVATE_KEY` |
| Payments | Stripe (test mode) | Billing/subscriptions | `STRIPE_SECRET_KEY` |
| Monitoring | Sentry | Error tracking + performance | `SENTRY_DSN` |
| Deployment | Vercel | Hosting, crons, edge | `VERCEL_TOKEN` |
| Vercel Team | carlos-feiteiras-projects | — | — |
| Images | Stability AI | Virtual staging | `STABILITY_API_KEY` |
| Web Scraping | Apify | Lead enrichment | `APIFY_API_TOKEN` |
| Auth | NextAuth / magic link | Passwordless login | `AUTH_SECRET` |

---

## 3. Full Database Schema — 28 Tables

### Core Business Tables

| Table | Purpose | RLS | Key Indexes |
|-------|---------|-----|-------------|
| `contacts` | Buyers, sellers, investors — all people | Yes | email, tenant_id, nationality, budget_range |
| `deals` | Active transactions and pipeline | Yes | tenant_id, stage, assigned_agent, created_at |
| `properties` | Property listings | Yes | tenant_id, price, location, status |
| `matches` | Buyer-property match scores | Yes | contact_id, property_id, score, tenant_id |
| `deal_packs` | Generated deal packages sent to buyers | Yes | deal_id, contact_id, sent_at, opened_at |
| `priority_items` | Agent daily task queue | Yes | tenant_id, agent_id, due_date, priority |

### AI & Intelligence Tables

| Table | Purpose | RLS | Key Indexes |
|-------|---------|-----|-------------|
| `learning_events` | Training signals for model fine-tuning | No | event_type, outcome, created_at |
| `ai_audit_log` | Every AI call logged (model, tokens, cost, output_hash) | No | agent_id, tenant_id, created_at, correlation_id |
| `causal_trace` | Revenue decision causal graph nodes | No | correlation_id, step, revenue_impact, created_at |
| `agent_memory` | Per-agent persistent context/memory | Yes | agent_id, tenant_id, key, updated_at |
| `ai_feedback` | Human ratings on AI outputs | Yes | audit_log_id, rating, created_at |
| `policy_tuning_log` | Policy engine rule change history | No | rule_id, changed_by, created_at |

### CRM & Engagement Tables

| Table | Purpose | RLS | Key Indexes |
|-------|---------|-----|-------------|
| `investidores` | Investor profiles with portfolio data | Yes | tenant_id, budget_min, budget_max |
| `campanhas` | Email/WhatsApp campaign definitions | Yes | tenant_id, status, scheduled_at |
| `sofia_conversations` | Sofia chat history (WhatsApp + web) | Yes | contact_id, tenant_id, channel, created_at |
| `property_collections` | Saved property lists per contact | Yes | contact_id, tenant_id |
| `used_magic_tokens` | One-time magic login tokens (SHA-256) | No | token_hash, used_at, expires_at |

### Infrastructure Tables

| Table | Purpose | RLS | Key Indexes |
|-------|---------|-----|-------------|
| `event_history` | Full event payload store (replay source) | No | correlation_id, tenant_id, event_type, created_at |
| `usage_events` | Token/API usage tracking per tenant | No | tenant_id, service, created_at |
| `job_queue` | Background job queue (Supabase-backed) | No | status, scheduled_at, attempts, tenant_id |
| `secret_rotation_log` | Secrets rotation audit trail | No | secret_name, rotated_at, rotated_by |
| `security_events` | SIEM event sink | No | event_type, severity, tenant_id, created_at |
| `embeddings` | pgvector embeddings for semantic search | No | embedding (ivfflat), content_id, content_type |

### Vault Tables

| Table | Purpose | RLS | Key Indexes |
|-------|---------|-----|-------------|
| `vault_events` | Vault change audit log | No | vault_path, action, created_at |
| `vault_file_hashes` | SHA-256 checksums for vault files | No | file_path, hash, updated_at |
| `vault_snapshots` | Daily snapshot metadata | No | snapshot_date, status, file_count |
| `vault_integrity_scores` | Daily integrity score history | No | score, checked_at, violations |

---

## 4. Event System Design

### BaseEvent Interface

```typescript
interface BaseEvent {
  id: string;                    // UUID v4, globally unique
  type: EventType;               // enum — see mandatory events below
  correlation_id: string;        // propagated from HTTP header X-Correlation-ID
  tenant_id: string;             // default: 'agency-group'
  timestamp: string;             // ISO 8601 UTC
  payload: Record<string, unknown>; // event-specific data
  source?: string;               // originating service/route
  version?: string;              // schema version, default '1.0'
}
```

### EventBus Implementation

1. **In-memory pub/sub**: Map of `EventType → Set<EventHandler>`. Synchronous fan-out.
2. **Redis dedup**: Before publishing, check key `{tenant_id}:ev_dedup:{sha256(id+type+payload)}`.
   If exists → drop (already processed). If not → set with TTL 24h, then publish.
3. **Supabase persistence**: After publish, insert into `event_history` (fire-and-forget, void).
4. **Error isolation**: Each subscriber runs in try/catch. One failing subscriber does not block others.

### Tenant Scoping

All events carry `tenant_id`. Subscribers should filter by tenant if needed.
Multi-tenant: `TENANT_ISOLATION_ENABLED=true` enforces strict tenant boundary in Redis and DB queries.

### Mandatory Event Types

| Event | Trigger | Revenue Impact |
|-------|---------|----------------|
| `match_created` | New buyer-property score computed | Potential pipeline entry |
| `deal_pack_generated` | Deal pack auto-created (score ≥ 80) | Direct revenue signal |
| `deal_pack_sent` | Deal pack delivered to buyer | Engagement start |
| `response_received` | Buyer replies (email/WhatsApp) | Intent signal |
| `call_booked` | Property viewing scheduled | High-intent signal |
| `proposal_sent` | Formal offer submitted | Near-close signal |
| `cpcv_signed` | CPCV document signed | 50% commission due |
| `escritura_signed` | Deed signed | 50% commission due |
| `deal_closed` | Full transaction complete | 100% commission recognized |
| `deal_lost` | Deal fell through | Revenue leak — triggers causal analysis |

---

## 5. Causal Graph Model

Every revenue decision is stored as a node in the causal graph, enabling post-hoc analysis of
why deals close or fail.

### causal_trace Table Schema

```sql
CREATE TABLE causal_trace (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id TEXT NOT NULL,      -- links all steps in one flow
  tenant_id     TEXT NOT NULL,
  step          INTEGER NOT NULL,    -- sequence number within correlation
  agent_id      TEXT,                -- which AI agent made this decision
  decision      TEXT NOT NULL,       -- human-readable decision description
  input_hash    TEXT,                -- SHA-256 of decision inputs
  output_hash   TEXT,                -- SHA-256 of decision outputs
  revenue_impact NUMERIC(12,2),      -- estimated € impact of this decision
  confidence    NUMERIC(4,3),        -- 0.000–1.000
  model_used    TEXT,                -- e.g. 'claude-haiku-4-5'
  latency_ms    INTEGER,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_causal_trace_correlation ON causal_trace(correlation_id);
CREATE INDEX idx_causal_trace_revenue ON causal_trace(revenue_impact DESC);
```

### 4 Query Functions

1. **`whyDidDealClose(dealId)`**
   - Traces all `causal_trace` rows for deal's correlation_id
   - Returns ordered decision chain with revenue_impact at each step
   - Output: `{ nodes, edges, summary, keyDecisions[], totalRevenue }`

2. **`findRevenueLeak(tenantId, dateRange)`**
   - Finds `deal_lost` events and traces back through causal chain
   - Identifies the decision node where the deal diverged toward failure
   - Output: `{ leakPoints[], estimatedLoss, rootCauses[] }`

3. **`traceAgentDecision(agentId, correlationId)`**
   - Returns all decisions made by a specific agent in a correlation chain
   - Includes input/output hashes for audit
   - Output: `{ agentDecisions[], totalCost, accuracy }`

4. **`reconstructCausalChain(correlationId)`**
   - Full graph reconstruction: all nodes + edges for a correlation
   - Used by replay engine to re-run from any step
   - Output: `{ nodes: CausalNode[], edges: CausalEdge[], summary }`

### Graph Node/Edge Types

- **Node types**: `match_event`, `ai_decision`, `human_action`, `automation_trigger`, `revenue_event`
- **Edge types**: `caused_by`, `influenced_by`, `triggered`, `blocked_by`
- **Revenue attribution**: Each edge carries a `revenue_attribution` weight (0.0–1.0)

---

## 6. AI Control Plane Spec

### Policy Engine

```typescript
type PolicyDecision = 'ALLOW' | 'DENY' | 'ESCALATE';

interface PolicyContext {
  agentId: string;
  tenantId: string;
  action: string;
  estimatedTokens?: number;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

async function checkPolicy(ctx: PolicyContext): Promise<PolicyDecision>
```

**Rule priority** (first match wins):
1. If `agentId` not in registry → `ALLOW` (fail-open, see DECISION-2026-05-19-001)
2. If agent `riskLevel === 'CRITICAL'` → `ESCALATE`
3. If monthly token spend > 90% of budget → `ESCALATE`
4. If monthly token spend > 100% of budget → `DENY`
5. If `TENANT_ISOLATION_ENABLED` and tenant mismatch → `DENY`
6. Default → `ALLOW`

### withAI Wrapper

```typescript
async function withAI<T>(
  circuitName: string,
  fn: () => Promise<T>,
  fallback?: T
): Promise<T>
```

- Checks circuit breaker state (Redis key: `cb:{circuitName}`)
- If OPEN → return fallback immediately (no AI call)
- If CLOSED/HALF_OPEN → call fn(), record success/failure to circuit
- Logs to `ai_audit_log` on completion (non-blocking)

### withAIStream Wrapper

Same as `withAI` but wraps streaming responses. No retry (cannot replay mid-stream).
Circuit breaker still applies. Logs start event; end event logged by caller.

### AgentExecutionEnvelope

```typescript
interface AgentExecutionEnvelope {
  correlation_id: string;
  agent_id: string;
  tenant_id: string;
  decision: string;
  confidence: number;           // 0.000–1.000
  fallback_used: boolean;
  cost_tokens: number;
  latency_ms: number;
  revenue_impact?: number;      // estimated € impact
  output: unknown;              // agent's output (any type)
  created_at: string;           // ISO 8601 UTC
}
```

---

## 7. Revenue Engine Logic

### Match Scoring Formula

Score = weighted sum of:
- Budget alignment: 30% weight (buyer max ≥ property price AND buyer min ≤ price × 1.2)
- Location match: 25% weight (buyer preferred zones vs. property zone)
- Property type match: 20% weight (apartment/villa/commercial etc.)
- Feature match: 15% weight (pool, garage, views, etc.)
- Timeline urgency: 10% weight (buyer urgency score × recency of listing)

**Score thresholds**:
- **HIGH** (≥ 80): Auto-trigger deal pack generation. Notify agent immediately.
- **MEDIUM** (60–79): Queue for agent review within 24h.
- **LOW** (< 60): Log only. No automatic action.

### Pipeline Stages

| Stage | Description | Auto-action |
|-------|-------------|-------------|
| `MATCH` | Score computed, ≥ 80 trigger | Auto-generate deal pack |
| `DECISION` | Agent reviews match | None (human gate) |
| `DEAL_PACK` | Deal pack created and ready | Auto-send if agent approves |
| `SEND` | Deal pack sent to buyer | Start 3-day follow-up timer |
| `FOLLOWUP` | Waiting for buyer response | Auto follow-up at 3/7/14/30 days |
| `VIEWING` | Property viewing scheduled | Send viewing prep pack |
| `PROPOSAL` | Formal offer submitted | Alert legal team |
| `NEGOTIATION` | Counter-offer in progress | Flag for agent attention |
| `CPCV` | CPCV signed | Record 50% commission due date |
| `ESCRITURA` | Deed signed | Record final 50% commission |
| `CLOSED` | Transaction complete | Trigger investor relations update |
| `LOST` | Deal fell through | Trigger causal analysis |

### Commission Model

- **Rate**: 5% of transaction value
- **Structure**: 50% at CPCV signing + 50% at Escritura
- **Split** (agent/company): defined per-deal in `deals.commission_split`
- **Example**: €1M property → €50K commission → €25K at CPCV + €25K at Escritura

### Deal Pack Auto-Generation

Trigger: `match_created` event with `score ≥ 80`
Contents of deal pack:
1. Property PDF (photos, specs, location map)
2. AVM valuation report (6-month forecast)
3. Neighborhood intelligence brief
4. Personalized buyer letter (Sofia-generated, Claude haiku)
5. Legal document checklist
6. Comparable sales data

---

## 8. Tenant Model

- **Default tenant**: `'agency-group'`
- **Header**: `x-tenant-id` — set by `middleware.ts`, propagated to all API handlers
- **Redis namespace**: All Redis keys prefixed `{tenant_id}:` (e.g., `agency-group:ev_dedup:abc123`)
- **Supabase**: All 28 tables have `tenant_id TEXT NOT NULL` column
- **RLS policies**: `tenant_id = current_setting('app.tenant_id')` on relevant tables
- **Env var**: `TENANT_ISOLATION_ENABLED` — `'true'` enables strict cross-tenant blocking
- **Multi-tenant future**: Architecture is ready; current deployment is single-tenant

---

## 9. Security Model

### 7 Roles

| Role | Description | Typical User |
|------|-------------|-------------|
| `super_admin` | All permissions, cross-tenant | CTO / System owner |
| `admin` | All permissions within tenant | Business owner |
| `agent` | Deals, contacts, matches, automations | Real estate agent |
| `partner` | View-only + limited contact creation | Referral partner |
| `readonly` | View only, no mutations | Investors / observers |
| `api_service` | Programmatic access, no UI | n8n, webhooks, crons |
| `system` | Internal service calls only | Background workers |

### 16 Permissions Matrix

| Permission | super_admin | admin | agent | partner | readonly | api_service | system |
|-----------|-------------|-------|-------|---------|----------|-------------|--------|
| view_deals | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| create_deals | ✓ | ✓ | ✓ | — | — | ✓ | ✓ |
| delete_deals | ✓ | ✓ | — | — | — | — | — |
| view_contacts | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| create_contacts | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ |
| manage_agents | ✓ | ✓ | — | — | — | — | ✓ |
| view_analytics | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| manage_integrations | ✓ | ✓ | — | — | — | — | — |
| view_billing | ✓ | ✓ | — | — | — | — | — |
| manage_billing | ✓ | ✓ | — | — | — | — | — |
| manage_security | ✓ | — | — | — | — | — | — |
| view_audit | ✓ | ✓ | — | — | — | ✓ | ✓ |
| trigger_automation | ✓ | ✓ | ✓ | — | — | ✓ | ✓ |
| manage_vault | ✓ | ✓ | — | — | — | — | ✓ |
| replay_events | ✓ | — | — | — | — | — | ✓ |
| manage_secrets | ✓ | — | — | — | — | — | — |

### Route Guard Usage

```typescript
// In API route:
const check = requiresRole('admin', 'agent')(userId, tenantId);
if (!check.allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
```

### SIEM Integration

4 event sinks (all receive every security event):
1. **Console**: structured JSON log (always enabled)
2. **Sentry**: `captureEvent()` with security context
3. **Datadog**: HTTP log ingest (if `DATADOG_API_KEY` set)
4. **Supabase**: insert into `security_events` table (fire-and-forget)

### Intrusion Detection Rules

| Pattern | Threshold | Action |
|---------|-----------|--------|
| Replay storm | >50 replay attempts/5min | Block IP, SIEM alert CRITICAL |
| Webhook flood | >200 webhook calls/min | Rate limit 429, SIEM alert HIGH |
| Prompt injection | Known injection patterns in input | Sanitize + SIEM alert MEDIUM |
| Unusual AI spend | >3× daily average in 1h | ESCALATE + SIEM alert HIGH |

---

## 10. Failure Model & Self-Healing

### Circuit Breaker States

```
CLOSED (normal) → [5 failures] → OPEN (blocking) → [60s timeout] → HALF_OPEN → [3 successes] → CLOSED
                                                                       ↓
                                                              [any failure] → OPEN
```

- State stored in Upstash Redis: `cb:{circuitName}:state`, `cb:{circuitName}:failures`
- Each circuit is named by service: `anthropic-haiku`, `anthropic-opus`, `supabase`, `n8n`, `resend`

### Retry Policy (withRetry)

- **Max attempts**: 3
- **Backoff**: 1s → 2s → 4s (exponential with jitter ±10%)
- **Timeout per attempt**: 30s (hard timeout via AbortController)
- **Non-retryable errors**: 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found
- **Retryable errors**: 429 Rate Limited, 500/502/503/504 Server Errors, network timeouts

### Dead Letter Queue

- Failed `job_queue` items (attempts ≥ max_attempts) → status = 'dlq'
- `dlq-processor` worker runs every 5 minutes via cron
- DLQ retry: exponential backoff starting at 15m, max 3 DLQ retries, then status = 'dead'
- Dead jobs alert Sentry with full context for manual review

### Supabase Write Strategy

All non-critical writes (event_history, ai_audit_log, causal_trace, usage_events):
```typescript
// Fire-and-forget — do NOT await
supabase.from('ai_audit_log').insert(record).then(() => {}).catch(() => {});
```
Critical writes (deals, contacts, matches): awaited with try/catch + Sentry capture on error.

---

## 11. Replay Engine Spec

### Overview

The replay engine allows re-processing of any past event or causal chain. This supports:
- Bug fixes (replay after deploying a fix)
- Audit verification (confirm events were processed correctly)
- State reconstruction (rebuild derived state from event log)

### Trigger

```
POST /api/events/replay?eventId={uuid}
Authorization: Bearer {token}
Required permission: MANAGE_VAULT or REPLAY_EVENTS
```

### Process

1. Load event from `event_history` by ID
2. Check Redis dedup key — if still active (< 24h old), refuse replay (idempotency protection)
3. If `force=true` query param AND role = `super_admin` → bypass dedup check
4. Re-publish event to EventBus (in-memory only — no re-persistence to event_history)
5. Downstream handlers process as if event just occurred
6. All AI calls during replay are tagged `replay: true` in audit log

### Partial Replay (from correlationId)

```
POST /api/events/replay?correlationId={id}&fromStep={n}
```
- Loads all `causal_trace` rows for correlationId with step ≥ n
- Re-runs decisions from that step forward
- Used for: "replay from the point where the deal went wrong"

---

## 12. Vault System

### Location

```
/SH-ROS-VAULT/
├── system-bible/       ← IMMUTABLE core docs
├── architecture/       ← Layer specs, event system, causal graph
├── agents/             ← Agent registry and prompts
├── prompts/            ← System prompts, versioned
├── events/             ← Event type catalog
├── decisions/          ← Architecture decision log
├── schemas/            ← DB schema dumps
├── revenue-engine/     ← Deal flow, scoring, commission
├── security-model/     ← RBAC, SIEM, intrusion detection
├── infra/              ← Stack, env vars, cron schedule
├── replay-snapshots/   ← Point-in-time state snapshots
├── ai-memory/          ← Agent memory exports
└── backups/            ← Daily vault snapshots
```

### Immutability Rules

- `system-bible/SH-ROS_MASTER_BIBLE.md`: append-only, never overwrite
- `VAULT_MANIFEST.json`: version-controlled only
- `decisions/decision-log.md`: append-only
- All vault changes must be reflected in `vault_events` table (Supabase)

### Integrity System

- **Daily cron**: `02:00 UTC` via `/api/cron/vault-integrity`
- **Hash check**: SHA-256 of each file vs. stored hash in `INTEGRITY_HASHES.json`
- **Score computation**: `(unchanged_files / total_files) × 100`
- **Alert threshold**: score < 95 → SIEM alert + Sentry capture
- **Snapshot trigger**: on every vault write operation

---

## 13. Agent Registry — Key Agents

| Agent ID | Model | Purpose | Risk Level | Monthly Token Budget |
|----------|-------|---------|------------|----------------------|
| `sofia-chat` | claude-haiku-4-5 | Customer-facing chat (WhatsApp + web) | MEDIUM | 5M tokens |
| `crm-orchestrator` | claude-opus-4-6 | 8-tool deal orchestration loop | HIGH | 2M tokens |
| `avm-engine` | claude-haiku-4-5 | Property valuation + 6-month forecast | MEDIUM | 1M tokens |
| `lead-scorer` | claude-haiku-4-5 | Buyer qualification + match scoring | LOW | 2M tokens |
| `followup-generator` | claude-haiku-4-5 | Personalized follow-up message drafting | LOW | 3M tokens |
| `deal-risk` | claude-opus-4-6 | Deal risk assessment + red flag detection | HIGH | 500K tokens |
| `legal-advisor` | claude-opus-4-6 | 10-area Portuguese real estate law | CRITICAL | 1M tokens |
| `daily-brief` | claude-haiku-4-5 | Morning briefing generation | LOW | 500K tokens |
| `photo-scorer` | claude-haiku-4-5 | Listing photo quality assessment | LOW | 1M tokens |
| `heygen-script` | claude-haiku-4-5 | HeyGen video script generation | LOW | 500K tokens |

---

## 14. API Surface — Key Routes

### Revenue API

| Route | Method | Description |
|-------|--------|-------------|
| `/api/matches` | GET | List matches with filters |
| `/api/matches/compute` | POST | Compute new match scores |
| `/api/deals` | GET/POST | Deal CRUD |
| `/api/deals/[id]/stage` | PATCH | Advance deal pipeline stage |
| `/api/deal-packs/generate` | POST | Auto-generate deal pack |
| `/api/deal-packs/[id]/send` | POST | Send deal pack to buyer |

### AI API

| Route | Method | Description |
|-------|--------|-------------|
| `/api/sofia-agent/chat` | POST | Sofia streaming chat (SSE) |
| `/api/automation/agent` | POST | CRM orchestrator 8-tool loop |
| `/api/avm/estimate` | POST | Property valuation |
| `/api/legal/query` | POST | Legal advisor query |

### Communication API

| Route | Method | Description |
|-------|--------|-------------|
| `/api/whatsapp/webhook` | POST | WhatsApp inbound/outbound |
| `/api/campanhas/send` | POST | Campaign dispatch |
| `/api/notifications/push` | POST | Web push notification |

### Observability API

| Route | Method | Description |
|-------|--------|-------------|
| `/api/control-tower/causal-query` | POST | Causal graph query |
| `/api/control-tower/revenue-leak` | GET | Revenue leak analysis |
| `/api/events/replay` | POST | Event replay |
| `/api/health` | GET | System health check |

### Vault API

| Route | Method | Description |
|-------|--------|-------------|
| `/api/vault/integrity` | GET | Get current integrity scores |
| `/api/vault/snapshot` | POST | Trigger manual snapshot |
| `/api/cron/vault-integrity` | GET | Daily integrity cron (cron only) |

---

## 15. Reconstruction Guarantee

**Promise**: Rebuild SH-ROS from zero in <48 hours.

### Required Assets

| Asset | Location | Contains |
|-------|---------|---------|
| This bible | `/SH-ROS-VAULT/system-bible/` | Complete architecture + all decisions |
| Event logs | `event_history` (Supabase) | Full event replay history |
| Agent memory | `agent_memory` (Supabase) + `/SH-ROS-VAULT/ai-memory/` | Agent context |
| Schema dump | `/SH-ROS-VAULT/schemas/` + Supabase | All 28 table definitions |
| Prompt library | `/SH-ROS-VAULT/prompts/` | All system prompts versioned |
| Infra config | `/SH-ROS-VAULT/infra/` + Vercel env vars | All environment variables |
| Decision log | `/SH-ROS-VAULT/decisions/` | All architecture decisions |
| Agent registry | `/SH-ROS-VAULT/agents/` | All agent configs + budgets |

### Reconstruction Steps (48h runbook)

1. **Hour 0–2**: Provision Supabase project, run schema migrations, restore from latest dump
2. **Hour 2–4**: Configure Vercel project, set all env vars from infra/stack.md
3. **Hour 4–8**: Deploy Next.js app, verify all 28 tables accessible, run health check
4. **Hour 8–12**: Connect n8n Cloud, import workflows, verify webhooks
5. **Hour 12–16**: Validate AI agents (test Sofia chat, CRM orchestrator)
6. **Hour 16–20**: Restore agent memory from ai-memory/ exports
7. **Hour 20–24**: Replay last 7 days of events from event_history
8. **Hour 24–48**: Full integration test — end-to-end deal pack generation + commission tracking

### Verification Checklist

- [ ] `/api/health` returns all systems GREEN
- [ ] Sofia chat responds correctly in Portuguese and English
- [ ] Match scoring produces correct scores for 5 test pairs
- [ ] Deal pack generation completes in < 30s
- [ ] WhatsApp webhook receives and routes correctly
- [ ] RBAC blocks unauthorized access on all protected routes
- [ ] Vault integrity score ≥ 95
- [ ] Causal trace correctly links events for last 3 closed deals

---

## Addenda

*Append new sections below this line. Never modify sections above.*

---
*End of SH-ROS Master System Bible v1.0.0 — 2026-05-19*
