# SH-ROS Causal Graph Model
## Version: 1.0.0 | Created: 2026-05-19

> Full spec in system-bible/SH-ROS_MASTER_BIBLE.md Section 5.

---

## Purpose

Every revenue decision is captured as a node in the causal graph.
This enables post-hoc analysis of why deals close or fail, which AI decisions drove revenue,
and where pipeline leaks occur.

---

## causal_trace Table Schema

```sql
CREATE TABLE causal_trace (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id TEXT NOT NULL,       -- links all steps in one revenue flow
  tenant_id      TEXT NOT NULL,
  step           INTEGER NOT NULL,    -- sequence number within correlation
  agent_id       TEXT,                -- AI agent ID, null = human action
  decision       TEXT NOT NULL,       -- human-readable decision description
  input_hash     TEXT,                -- SHA-256 of decision inputs (for audit)
  output_hash    TEXT,                -- SHA-256 of decision outputs (for audit)
  revenue_impact NUMERIC(12,2),       -- estimated EUR impact of this decision
  confidence     NUMERIC(4,3),        -- 0.000–1.000 (AI confidence score)
  model_used     TEXT,                -- e.g. 'claude-haiku-4-5'
  latency_ms     INTEGER,
  node_type      TEXT NOT NULL,       -- see Node Types below
  metadata       JSONB DEFAULT '{}',  -- additional context
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_causal_trace_correlation ON causal_trace(correlation_id, step);
CREATE INDEX idx_causal_trace_revenue     ON causal_trace(revenue_impact DESC NULLS LAST);
CREATE INDEX idx_causal_trace_agent       ON causal_trace(agent_id, created_at DESC);
CREATE INDEX idx_causal_trace_tenant      ON causal_trace(tenant_id, created_at DESC);
```

---

## Node Types

| Type | Description | Example |
|------|-------------|---------|
| `match_event` | Buyer-property scoring event | "Score 87 for buyer João / Cascais villa" |
| `ai_decision` | AI agent decision point | "sofia-chat recommended 3 properties" |
| `human_action` | Human agent action | "Agent Carlos sent counter-offer" |
| `automation_trigger` | n8n / cron action | "3-day follow-up email sent" |
| `revenue_event` | Financial milestone | "CPCV signed — €25K commission due" |

## Edge Types (in reconstructed graph)

| Type | Description |
|------|-------------|
| `caused_by` | This node directly caused the next |
| `influenced_by` | This node provided context to the next |
| `triggered` | This node activated an automation |
| `blocked_by` | This node prevented a downstream action |

---

## 4 Query Functions

### 1. whyDidDealClose(dealId)
```typescript
async function whyDidDealClose(dealId: string): Promise<{
  nodes: CausalNode[];
  edges: CausalEdge[];
  summary: string;
  keyDecisions: string[];
  totalRevenue: number;
}>
```
Traces all causal_trace rows for deal's correlation_id.
Returns ordered chain with revenue_impact at each step.
API: `POST /api/control-tower/causal-query` `{ query: 'whyDidDealClose', dealId }`

### 2. findRevenueLeak(tenantId, dateRange)
```typescript
async function findRevenueLeak(tenantId: string, dateRange: { from: string; to: string }): Promise<{
  leakPoints: LeakPoint[];
  estimatedLoss: number;
  rootCauses: string[];
}>
```
Finds `deal_lost` events, traces back through causal chain to divergence point.
API: `GET /api/control-tower/revenue-leak?from=2026-05-01&to=2026-05-19`

### 3. traceAgentDecision(agentId, correlationId)
```typescript
async function traceAgentDecision(agentId: string, correlationId: string): Promise<{
  agentDecisions: CausalNode[];
  totalCostTokens: number;
  accuracy: number;             // based on ai_feedback ratings
}>
```
Returns all decisions by a specific agent in a correlation chain with audit hashes.

### 4. reconstructCausalChain(correlationId)
```typescript
async function reconstructCausalChain(correlationId: string): Promise<{
  nodes: CausalNode[];
  edges: CausalEdge[];
  summary: string;
  revenueImpact: number;
}>
```
Full graph reconstruction for replay engine input.
API: `POST /api/control-tower/causal-query` `{ query: 'reconstruct', correlationId }`

---

## Revenue Impact Computation

Revenue impact on each node = estimated marginal contribution to deal close probability × deal value.

Example for a €1M deal:
- `match_created` (score 87): impact = €1M × 5% commission × 0.30 match contribution = **€15,000**
- `deal_pack_sent`: impact = €1M × 5% × 0.20 = **€10,000**
- `call_booked`: impact = €1M × 5% × 0.25 = **€12,500**
- `proposal_sent`: impact = €1M × 5% × 0.15 = **€7,500**
- `cpcv_signed`: impact = €1M × 5% × 0.10 = **€5,000** (remaining probability)

Total causal chain = full €50,000 commission (sum of marginal contributions)
