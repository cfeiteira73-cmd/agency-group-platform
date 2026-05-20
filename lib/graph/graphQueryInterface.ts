// =============================================================================
// Agency Group — Unified Graph Query Interface
// lib/graph/graphQueryInterface.ts
//
// JSON-based "ask the graph" API for SH-ROS.
// Abstracts over materialized views, causal CTEs, and entity queries.
//
// Supported query types:
//   WHY_DID_DEAL_CLOSE    → causal chain for a correlation_id
//   REVENUE_LEAK          → deals with negative revenue delta
//   AGENT_CONTRIBUTION    → agent revenue + success rate graph
//   FULL_TENANT_PATH      → complete revenue path for tenant
//   CONVERSION_PATTERNS   → top deal flow patterns
//   ENTITY_ONTOLOGY       → full connected graph for an entity
//
// TypeScript strict — 0 errors
// =============================================================================

import { getCausalChainRecursive, getRevenueAttribution } from './recursiveCTE'
import { getGraphIntelligenceReport, getAgentRevenueMV, getTopDealPatterns } from './materializedViews'
import { getBuyerSimilarityCluster, getAgentRevenueGraph, getEntityOntology } from './intelligence'
import { buildGraphCacheKey, withGraphCache, COLD_TTL_SECONDS } from './adjacencyCache'

export type GraphQueryType =
  | 'WHY_DID_DEAL_CLOSE'
  | 'REVENUE_LEAK'
  | 'AGENT_CONTRIBUTION'
  | 'FULL_TENANT_PATH'
  | 'CONVERSION_PATTERNS'
  | 'ENTITY_ONTOLOGY'
  | 'BUYER_CLUSTER'

export interface GraphQueryRequest {
  type:          GraphQueryType
  tenant_id:     string
  correlation_id?: string     // WHY_DID_DEAL_CLOSE, ENTITY_ONTOLOGY
  entity_id?:    string       // ENTITY_ONTOLOGY, BUYER_CLUSTER
  entity_type?:  string       // ENTITY_ONTOLOGY
  agent_id?:     string       // AGENT_CONTRIBUTION (optional filter)
  from_date?:    string       // REVENUE_LEAK, AGENT_CONTRIBUTION
  to_date?:      string
  limit?:        number
}

export interface GraphQueryResponse {
  query_type:    GraphQueryType
  tenant_id:     string
  executed_at:   string
  latency_ms:    number
  data:          unknown
  insights:      string[]
  error?:        string
}

// ─── Formal Graph Model ───────────────────────────────────────────────────────
// Neo4j-compatible node/edge model for all graph query results

export type GraphNodeType =
  | 'Tenant'
  | 'Lead'
  | 'Deal'
  | 'Agent'
  | 'AiDecision'
  | 'Event'
  | 'RevenueOutcome'

export type GraphEdgeType =
  | 'CAUSED_BY'
  | 'INFLUENCED_BY'
  | 'CREATED_BY'
  | 'CONVERTED_TO'
  | 'LOST_TO'
  | 'EXECUTED_BY'
  | 'RESULTED_IN'
  | 'BELONGS_TO'

export interface GraphNode {
  id: string
  type: GraphNodeType
  label: string
  properties: Record<string, unknown>
  created_at?: string
  tenant_id?: string
}

export interface GraphEdge {
  id: string
  from_node_id: string
  to_node_id: string
  type: GraphEdgeType
  properties?: Record<string, unknown>
  weight?: number          // 0-1 causal strength
  created_at?: string
}

export interface FormalGraphResult {
  nodes:            GraphNode[]
  edges:            GraphEdge[]
  causal_chain:     string[]          // ordered list of node IDs in causal sequence
  revenue_delta:    number
  confidence:       number            // 0-1
  /** Human-readable causal reasoning: ["Lead created → Agent scored 82 → Deal pack sent → CPCV signed → Closed"] */
  explanation_path: string[]
  query_type:       GraphQueryType
  tenant_id:        string
  executed_at:      string
  latency_ms:       number
  /** Performance classification: 'hot' (<50ms), 'warm' (50–200ms), 'cold' (>200ms) */
  perf_class:       'hot' | 'warm' | 'cold'
}

export function toFormalGraphResult(
  response: GraphQueryResponse,
  opts?: { revenue_delta?: number; confidence?: number }
): FormalGraphResult {
  // Extract nodes and edges from response.data if it has them
  const data = response.data as Record<string, unknown> | null | undefined

  const rawNodes = (data?.['nodes'] as unknown[] | undefined) ?? []
  const rawEdges = (data?.['edges'] as unknown[] | undefined) ?? []
  const rawChain = (data?.['causal_chain'] as string[] | undefined)
    ?? (data?.['agents'] as string[] | undefined)
    ?? []

  const nodes: GraphNode[] = rawNodes.map((n) => {
    const node = n as Record<string, unknown>
    return {
      id:         String(node['id'] ?? node['agent_id'] ?? node['entity_id'] ?? ''),
      type:       (node['type'] ?? 'Event') as GraphNodeType,
      label:      String(node['label'] ?? node['id'] ?? ''),
      properties: (node['metadata'] ?? node['properties'] ?? {}) as Record<string, unknown>,
      created_at: node['created_at'] as string | undefined,
      tenant_id:  response.tenant_id,
    }
  })

  const edges: GraphEdge[] = rawEdges.map((e, i) => {
    const edge = e as Record<string, unknown>
    return {
      id:           String(edge['id'] ?? `edge_${i}`),
      from_node_id: String(edge['from'] ?? edge['from_node_id'] ?? ''),
      to_node_id:   String(edge['to']   ?? edge['to_node_id']   ?? ''),
      type:         (edge['type'] ?? 'CAUSED_BY') as GraphEdgeType,
      properties:   (edge['properties'] ?? {}) as Record<string, unknown>,
      weight:       typeof edge['weight'] === 'number' ? edge['weight'] : undefined,
    }
  })

  const insights = response.insights ?? []

  // Build explanation_path from insights + causal chain + node labels
  const explanationPath: string[] = insights.length > 0
    ? insights
    : rawChain.length > 0
      ? rawChain.map((id, i) => {
          const node = nodes.find(n => n.id === id)
          const label = node ? `${node.type}: ${node.label}` : id
          return i === 0 ? label : `→ ${label}`
        })
      : data?.['summary'] ? [String(data['summary'])] : []

  const latencyMs = response.latency_ms
  const perfClass: 'hot' | 'warm' | 'cold' =
    latencyMs < 50   ? 'hot'
    : latencyMs < 200 ? 'warm'
    : 'cold'

  return {
    nodes,
    edges,
    causal_chain:     rawChain,
    revenue_delta:    opts?.revenue_delta ?? (data?.['revenue_delta'] as number | undefined) ?? 0,
    confidence:       opts?.confidence    ?? (data?.['confidence']    as number | undefined) ?? 0.5,
    explanation_path: explanationPath,
    query_type:       response.query_type,
    tenant_id:        response.tenant_id,
    executed_at:      response.executed_at,
    latency_ms:       latencyMs,
    perf_class:       perfClass,
  }
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────

export async function executeGraphQuery(req: GraphQueryRequest): Promise<GraphQueryResponse> {
  const start = Date.now()
  const base: Omit<GraphQueryResponse, 'data' | 'insights' | 'error'> = {
    query_type:  req.type,
    tenant_id:   req.tenant_id,
    executed_at: new Date().toISOString(),
    latency_ms:  0,
  }

  // Build cache key once; used by withGraphCache below.
  const cacheKey = buildGraphCacheKey(
    req.tenant_id,
    req.type,
    req as unknown as Record<string, unknown>,
  )

  // Classify TTL: hot paths (single-entity lookups) use 30s,
  // cold paths (tenant-wide aggregations) use 5 minutes.
  const isHotPath = req.type === 'WHY_DID_DEAL_CLOSE'
    || req.type === 'ENTITY_ONTOLOGY'
    || req.type === 'BUYER_CLUSTER'
  const ttl = isHotPath ? undefined : COLD_TTL_SECONDS

  try {
    let data: unknown
    let insights: string[] = []

    switch (req.type) {
      case 'WHY_DID_DEAL_CLOSE': {
        if (!req.correlation_id) throw new Error('correlation_id required')
        const result = await withGraphCache(
          cacheKey,
          async () => {
            const chain = await getCausalChainRecursive(req.correlation_id!, req.tenant_id)
            return {
              ...base,
              latency_ms: Date.now() - start,
              data:    chain,
              insights: [chain.summary, `Agents involved: ${chain.agents.join(', ') || 'none'}`],
            }
          },
          ttl,
        )
        data     = result.data
        insights = result.insights
        break
      }

      case 'REVENUE_LEAK': {
        const result = await withGraphCache(
          cacheKey,
          async () => {
            const attribution = await getRevenueAttribution(req.tenant_id, req.from_date, req.to_date)
            const leakers = attribution.filter(a => a.total_revenue < 0)
            return {
              ...base,
              latency_ms: Date.now() - start,
              data: { leakers, all_agents: attribution },
              insights: [
                `${leakers.length} agents with negative revenue attribution`,
                leakers.length > 0
                  ? `Worst: ${leakers[0]?.agent_id} at €${leakers[0]?.total_revenue.toFixed(2)}`
                  : 'No revenue leaks detected',
              ],
            }
          },
          ttl,
        )
        data     = result.data
        insights = result.insights
        break
      }

      case 'AGENT_CONTRIBUTION': {
        const result = await withGraphCache(
          cacheKey,
          async () => {
            const [mvData, graphData] = await Promise.all([
              getAgentRevenueMV(req.tenant_id, req.limit ?? 20),
              getAgentRevenueGraph(req.tenant_id, req.agent_id),
            ])
            return {
              ...base,
              latency_ms: Date.now() - start,
              data:     { materialized: mvData, graph: graphData },
              insights: graphData.insights,
            }
          },
          ttl,
        )
        data     = result.data
        insights = result.insights
        break
      }

      case 'FULL_TENANT_PATH': {
        const result = await withGraphCache(
          cacheKey,
          async () => {
            const report = await getGraphIntelligenceReport(req.tenant_id)
            return {
              ...base,
              latency_ms: Date.now() - start,
              data:     report,
              insights: report.insights,
            }
          },
          ttl,
        )
        data     = result.data
        insights = result.insights
        break
      }

      case 'CONVERSION_PATTERNS': {
        const result = await withGraphCache(
          cacheKey,
          async () => {
            const patterns = await getTopDealPatterns(req.tenant_id, req.limit ?? 5)
            return {
              ...base,
              latency_ms: Date.now() - start,
              data:     patterns,
              insights: [
                `${patterns.length} distinct deal paths identified`,
                patterns[0] ? `Most common: "${patterns[0].flow_path}" (${patterns[0].count}x)` : 'No patterns yet',
              ],
            }
          },
          ttl,
        )
        data     = result.data
        insights = result.insights
        break
      }

      case 'ENTITY_ONTOLOGY': {
        if (!req.entity_id) throw new Error('entity_id required')
        const result = await withGraphCache(
          cacheKey,
          async () => {
            const entityType = (req.entity_type ?? 'deal') as Parameters<typeof getEntityOntology>[1]
            const ontology = await getEntityOntology(req.entity_id!, entityType, req.tenant_id)
            return {
              ...base,
              latency_ms: Date.now() - start,
              data:     ontology,
              insights: [(ontology as { insights: string[] }).insights?.[0] ?? 'Entity graph built'],
            }
          },
          ttl,
        )
        data     = result.data
        insights = result.insights
        break
      }

      case 'BUYER_CLUSTER': {
        if (!req.entity_id) throw new Error('entity_id (buyer_id) required')
        const result = await withGraphCache(
          cacheKey,
          async () => {
            const cluster = await getBuyerSimilarityCluster(req.entity_id!, req.tenant_id, req.limit ?? 10)
            return {
              ...base,
              latency_ms: Date.now() - start,
              data:     cluster,
              insights: [(cluster as { insights: string[] }).insights?.[0] ?? 'Cluster built'],
            }
          },
          ttl,
        )
        data     = result.data
        insights = result.insights
        break
      }

      default: {
        const exhaustive: never = req.type
        throw new Error(`Unknown query type: ${String(exhaustive)}`)
      }
    }

    return { ...base, latency_ms: Date.now() - start, data, insights }
  } catch (err) {
    return {
      ...base,
      latency_ms: Date.now() - start,
      data:       null,
      insights:   [],
      error:      String(err),
    }
  }
}
