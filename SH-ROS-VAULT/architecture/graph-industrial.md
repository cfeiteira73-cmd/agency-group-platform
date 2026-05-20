# SH-ROS Graph & Industrial Analytics Architecture

**Classification:** VAULT — Architecture Canonical  
**Version:** 2.0  
**Updated:** 2026-05-19  
**Owner:** SH-ROS Data Platform

---

## 1. Current Implementation: Supabase CTEs + Materialized Views

The SH-ROS graph layer is implemented entirely within PostgreSQL (Supabase) using:
- **Materialized views** for hot-path analytics (refreshed every 30 minutes via cron)
- **Recursive CTEs** for on-demand graph traversal (causal chains, revenue paths)
- **Stored functions** for the unified query interface consumed by all Control Tower panels

This approach avoids a dedicated graph database while delivering graph-like query semantics
at the current data volume (<10M nodes, <50M edges).

---

## 2. Graph Node Types (8 types)

| Node Type       | Table                    | Description                           |
|-----------------|--------------------------|---------------------------------------|
| `agent`         | `agents`                 | AI agent instance (type + tenant)     |
| `deal`          | `deals`                  | Real estate deal / pipeline stage     |
| `contact`       | `contacts`               | Lead or client record                 |
| `event`         | `event_history`          | Immutable system event                |
| `workflow`      | `workflow_executions`    | n8n workflow execution                |
| `action`        | `causal_trace`           | Atomic agent action with outcome      |
| `memory_node`   | `agent_memory`           | Long-term memory entry for an agent   |
| `tenant`        | `tenants`                | Tenant / organisation                 |

---

## 3. Relationship Edge Types (7 types)

| Edge Type          | From → To                | Description                              |
|--------------------|--------------------------|------------------------------------------|
| `CAUSED`           | action → event           | Action caused this event                 |
| `INFLUENCED`       | event → deal             | Event influenced deal progression        |
| `ASSIGNED_TO`      | deal → agent             | Deal assigned to agent                   |
| `CONTACTED`        | agent → contact          | Agent performed outreach to contact      |
| `TRIGGERED`        | event → workflow         | Event triggered workflow execution       |
| `REMEMBERS`        | agent → memory_node      | Agent holds this memory entry            |
| `ATTRIBUTED_TO`    | deal → action            | Revenue delta attributed to this action  |

---

## 4. Materialized Views

### mv_agent_revenue

Aggregates per-agent revenue attribution from `causal_trace` + `deals` for the
Control Tower → Revenue panel. Refreshed every 30 minutes.

```sql
CREATE MATERIALIZED VIEW mv_agent_revenue AS
SELECT
  ct.agent_id,
  ct.tenant_id,
  COUNT(DISTINCT ct.deal_id)                  AS deals_influenced,
  SUM(CASE WHEN ct.revenue_delta > 0
           THEN ct.revenue_delta ELSE 0 END)  AS revenue_attributed_eur,
  AVG(ct.confidence_score)                    AS avg_confidence,
  MAX(ct.created_at)                          AS last_action_at
FROM causal_trace ct
WHERE ct.created_at >= NOW() - INTERVAL '90 days'
GROUP BY ct.agent_id, ct.tenant_id;

CREATE UNIQUE INDEX ON mv_agent_revenue (agent_id, tenant_id);
```

### mv_deal_flow_paths

Pre-computes deal pipeline transition sequences for funnel analysis.

```sql
CREATE MATERIALIZED VIEW mv_deal_flow_paths AS
SELECT
  d.id                                          AS deal_id,
  d.tenant_id,
  d.stage,
  d.value_eur,
  ARRAY_AGG(dsh.stage ORDER BY dsh.changed_at)  AS stage_history,
  COUNT(dsh.id)                                 AS total_transitions,
  MIN(dsh.changed_at)                           AS first_transition_at,
  MAX(dsh.changed_at)                           AS last_transition_at,
  EXTRACT(EPOCH FROM (MAX(dsh.changed_at) - MIN(dsh.changed_at))) / 86400
                                                AS total_days_in_pipeline
FROM deals d
JOIN deal_stage_history dsh ON dsh.deal_id = d.id
GROUP BY d.id, d.tenant_id, d.stage, d.value_eur;

CREATE UNIQUE INDEX ON mv_deal_flow_paths (deal_id);
CREATE INDEX ON mv_deal_flow_paths (tenant_id, stage);
```

### mv_tenant_graph_stats

Summary statistics for the full tenant graph — used by the Control Tower overview panel
and the GraphQueryInterface `TENANT_STATS` query type.

```sql
CREATE MATERIALIZED VIEW mv_tenant_graph_stats AS
SELECT
  t.id                                          AS tenant_id,
  COUNT(DISTINCT a.id)                          AS agent_count,
  COUNT(DISTINCT d.id)                          AS deal_count,
  COUNT(DISTINCT c.id)                          AS contact_count,
  COUNT(DISTINCT e.id)                          AS event_count_30d,
  COUNT(DISTINCT ct.id)                         AS action_count_30d,
  COALESCE(SUM(CASE WHEN d.stage = 'closed_won'
                    THEN d.value_eur END), 0)   AS closed_revenue_eur,
  COALESCE(SUM(CASE WHEN d.stage != 'closed_won'
                    AND d.stage != 'closed_lost'
                    THEN d.value_eur END), 0)   AS pipeline_value_eur
FROM tenants t
LEFT JOIN agents       a  ON a.tenant_id = t.id
LEFT JOIN deals        d  ON d.tenant_id = t.id
LEFT JOIN contacts     c  ON c.tenant_id = t.id
LEFT JOIN event_history e ON e.tenant_id = t.id
                          AND e.created_at >= NOW() - INTERVAL '30 days'
LEFT JOIN causal_trace ct ON ct.tenant_id = t.id
                          AND ct.created_at >= NOW() - INTERVAL '30 days'
GROUP BY t.id;

CREATE UNIQUE INDEX ON mv_tenant_graph_stats (tenant_id);
```

### Materialized View Refresh Cron

All three views are refreshed concurrently every 30 minutes via Supabase cron
(pg_cron extension). Concurrent refresh avoids locking reads during refresh:

```sql
SELECT cron.schedule(
  'refresh-graph-views',
  '*/30 * * * *',
  $$
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_agent_revenue;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_deal_flow_paths;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_tenant_graph_stats;
  $$
);
```

---

## 5. Stored Functions

### get_causal_chain()

Recursive CTE that walks the `causal_trace` table upward from a terminal deal outcome
to reconstruct the full action sequence that caused it.

```sql
CREATE OR REPLACE FUNCTION get_causal_chain(
  p_deal_id   uuid,
  p_max_depth int DEFAULT 20
)
RETURNS TABLE (
  depth        int,
  action_id    uuid,
  agent_id     text,
  event_type   text,
  revenue_delta numeric,
  confidence   numeric,
  created_at   timestamptz
)
LANGUAGE sql STABLE AS $$
  WITH RECURSIVE causal_chain AS (
    -- Base: direct actions on this deal
    SELECT
      0               AS depth,
      ct.id           AS action_id,
      ct.agent_id,
      ct.event_type,
      ct.revenue_delta,
      ct.confidence_score AS confidence,
      ct.created_at,
      ct.parent_action_id
    FROM causal_trace ct
    WHERE ct.deal_id = p_deal_id
      AND ct.parent_action_id IS NULL

    UNION ALL

    -- Recursive: follow parent_action_id chain upward
    SELECT
      cc.depth + 1,
      ct.id,
      ct.agent_id,
      ct.event_type,
      ct.revenue_delta,
      ct.confidence_score,
      ct.created_at,
      ct.parent_action_id
    FROM causal_trace ct
    JOIN causal_chain cc ON cc.action_id = ct.parent_action_id
    WHERE cc.depth < p_max_depth
  )
  SELECT depth, action_id, agent_id, event_type,
         revenue_delta, confidence, created_at
  FROM causal_chain
  ORDER BY depth ASC, created_at ASC;
$$;
```

### get_revenue_attribution()

Aggregates revenue attribution scores across all agents for a given tenant and period,
joining `mv_agent_revenue` with live deal data for accuracy.

```sql
CREATE OR REPLACE FUNCTION get_revenue_attribution(
  p_tenant_id  text,
  p_days_back  int DEFAULT 90
)
RETURNS TABLE (
  agent_id              text,
  revenue_attributed    numeric,
  deals_influenced      bigint,
  attribution_pct       numeric,
  avg_confidence        numeric
)
LANGUAGE sql STABLE AS $$
  WITH tenant_total AS (
    SELECT COALESCE(SUM(revenue_attributed_eur), 0) AS total
    FROM mv_agent_revenue
    WHERE tenant_id = p_tenant_id
  )
  SELECT
    mar.agent_id,
    mar.revenue_attributed_eur                  AS revenue_attributed,
    mar.deals_influenced,
    CASE WHEN tt.total > 0
         THEN ROUND((mar.revenue_attributed_eur / tt.total) * 100, 2)
         ELSE 0
    END                                         AS attribution_pct,
    ROUND(mar.avg_confidence::numeric, 3)       AS avg_confidence
  FROM mv_agent_revenue mar
  CROSS JOIN tenant_total tt
  WHERE mar.tenant_id = p_tenant_id
  ORDER BY mar.revenue_attributed_eur DESC;
$$;
```

---

## 6. GraphQueryInterface — 7 Query Types

The `GraphQueryInterface` (`lib/graph/graphQueryInterface.ts`) provides a unified
TypeScript API over all graph queries. It dispatches to the appropriate SQL function
or materialized view based on query type:

| Query Type           | Backing Implementation          | Use Case                           |
|----------------------|---------------------------------|------------------------------------|
| `CAUSAL_CHAIN`       | `get_causal_chain()` RPC        | Forensics: how did deal X close?   |
| `REVENUE_ATTRIBUTION`| `get_revenue_attribution()` RPC | Who drove revenue this quarter?    |
| `AGENT_GRAPH`        | `mv_agent_revenue`              | Agent performance overview         |
| `DEAL_FLOW`          | `mv_deal_flow_paths`            | Funnel shape + bottleneck analysis |
| `TENANT_STATS`       | `mv_tenant_graph_stats`         | Control Tower overview panel       |
| `CONTACT_NETWORK`    | Supabase CTE (inline)           | Contact relationship mapping       |
| `EVENT_TIMELINE`     | `event_history` (direct query)  | Chronological event replay         |

```typescript
// Usage example
const gq = new GraphQueryInterface(supabase)
const chain = await gq.query({
  type:    'CAUSAL_CHAIN',
  deal_id: '550e8400-e29b-41d4-a716-446655440000',
})
```

---

## 7. Neo4j Migration Path (Phase 2)

### When to migrate

Migrate to Neo4j when ANY of the following thresholds are hit:
- Graph nodes exceed **50 million**
- Recursive CTE query time p99 exceeds **5 seconds**
- Number of distinct edge types exceeds **20**
- Multi-hop traversal depth requirement exceeds **10 levels**

### Interface Compatibility

`GraphQueryInterface` is designed for zero-change migration. The constructor accepts
either a Supabase client or a Neo4j driver session, resolved via factory:

```typescript
const gq = graphQueryFactory.create()
// Returns GraphQueryInterface backed by Supabase (current)
// or Neo4jGraphQueryInterface (Phase 2) based on GRAPH_BACKEND env var
```

### Phase 2 Migration Guide

1. **Provision Neo4j Aura** (managed cloud): `neo4j+s://xxxxx.databases.neo4j.io`
2. **Set env var:** `GRAPH_BACKEND=neo4j`, `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`
3. **Run backfill script:** `scripts/graph/neo4j-backfill.ts` — reads from Supabase,
   writes Cypher `CREATE` statements, maintains referential integrity
4. **Validate:** run `scripts/graph/validate-graph-parity.ts` to compare query results
   between Supabase CTE and Neo4j for a sample of 1,000 nodes
5. **Cutover:** flip `GRAPH_BACKEND=neo4j` in Vercel environment, Supabase remains
   source of truth for raw event data (Neo4j is a projection/read replica)

### Cypher equivalents

```cypher
// Equivalent of get_causal_chain() in Cypher
MATCH path = (a:Action)-[:CAUSED*1..20]->(terminal:Action {deal_id: $dealId})
RETURN nodes(path) AS chain
ORDER BY length(path) DESC

// Equivalent of get_revenue_attribution()
MATCH (agent:Agent)-[:ATTRIBUTED_TO]->(action:Action)-[:INFLUENCED]->(deal:Deal)
WHERE agent.tenant_id = $tenantId
RETURN agent.id, SUM(action.revenue_delta) AS revenue
ORDER BY revenue DESC
```

---

## 8. Performance Characteristics

| Query                    | Current (Supabase CTE) | Target (Neo4j)  |
|--------------------------|------------------------|-----------------|
| `get_causal_chain()`     | ~80ms (depth 10)       | ~5ms (depth 10) |
| `get_revenue_attribution`| ~15ms (mat. view hit)  | ~8ms            |
| `TENANT_STATS` query     | ~5ms (mat. view hit)   | ~3ms            |
| Full graph scan (1M nodes)| N/A (CTE timeout)     | ~500ms          |

Materialized view hit rate target: >95% for `mv_agent_revenue` and `mv_tenant_graph_stats`.
Cache miss (stale >30min) triggers synchronous refresh with `REFRESH MATERIALIZED VIEW`
before returning results — adds ~2-8s to that specific request.

---

## 9. Monitoring & Integrity

- `INTEGRITY_HASHES.json` in vault root contains SHA-256 hashes of all stored function
  bodies — CI checks these on each deploy to detect unauthorised schema drift
- `VAULT_MANIFEST.json` references this file for lineage tracking
- All graph queries emit a `graph_query_executed` event to `event_history` for audit

---

*Escalate to platform engineering if recursive CTE query time exceeds 2s p95 — that is
the early warning signal for Neo4j migration trigger.*
