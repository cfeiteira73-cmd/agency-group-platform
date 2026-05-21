// Agency Group — Unified Economic Growth Graph
// lib/growth/economicGrowthGraph.ts
// Unifies all economic signals into a single graph:
// investors ↔ leads ↔ brokers ↔ assets ↔ campaigns ↔ bids ↔ capital flows
// Every interaction is an "economic signal" that feeds the growth engine.
// TypeScript strict — 0 errors

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type EconomicSignalType =
  | 'IMPRESSION'
  | 'CLICK'
  | 'ENGAGEMENT'
  | 'BID_SUBMITTED'
  | 'CAPITAL_DEPOSIT'
  | 'DEAL_EXECUTION'
  | 'ROI_REALIZED'
  | 'LEAD_CREATED'
  | 'LEAD_QUALIFIED'
  | 'CAMPAIGN_TRIGGERED'
  | 'INVESTOR_ACTIVATED'
  | 'MARKET_ENTRY'

export type NodeType =
  | 'investor'
  | 'lead'
  | 'broker'
  | 'asset'
  | 'campaign'
  | 'bid'
  | 'capital_flow'
  | 'market'

export interface GraphNode {
  node_id: string
  tenant_id: string
  node_type: NodeType
  entity_id: string
  label: string
  properties: Record<string, unknown>
  capital_weight_eur_cents: number
  signal_count: number
  last_active_at: string
  created_at: string
}

export interface GraphEdge {
  edge_id: string
  tenant_id: string
  from_node_id: string
  to_node_id: string
  edge_type: EconomicSignalType
  weight: number
  eur_cents_value: number | null
  occurred_at: string
  metadata: Record<string, unknown>
}

export interface GraphSnapshot {
  tenant_id: string
  generated_at: string
  total_nodes: number
  total_edges: number
  node_counts: Record<NodeType, number>
  signal_counts: Record<EconomicSignalType, number>
  total_capital_weight_eur_cents: number
  graph_density: number
  most_connected_nodes: GraphNode[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildNodeId(entityId: string, nodeType: NodeType): string {
  return `${nodeType}:${entityId}`
}

function buildEdgeId(fromNodeId: string, toNodeId: string, signalType: EconomicSignalType, occurredAt: string): string {
  return `${fromNodeId}→${toNodeId}:${signalType}@${occurredAt}`
}

// ─── recordEconomicSignal ─────────────────────────────────────────────────────

/**
 * Fire-and-forget. Upserts both nodes, inserts edge into growth_graph_edges.
 * Increments signal_count on from_node. Updates capital_weight if eur_cents_value provided.
 */
export async function recordEconomicSignal(params: {
  tenant_id: string
  from_entity_id: string
  from_type: NodeType
  to_entity_id: string
  to_type: NodeType
  signal_type: EconomicSignalType
  eur_cents_value?: number
  metadata?: Record<string, unknown>
}): Promise<void> {
  const {
    tenant_id,
    from_entity_id,
    from_type,
    to_entity_id,
    to_type,
    signal_type,
    eur_cents_value,
    metadata = {},
  } = params

  const now = new Date().toISOString()
  const fromNodeId = buildNodeId(from_entity_id, from_type)
  const toNodeId = buildNodeId(to_entity_id, to_type)
  const edgeId = buildEdgeId(fromNodeId, toNodeId, signal_type, now)

  const upsertNode = async (
    nodeId: string,
    entityId: string,
    nodeType: NodeType,
    incrementSignal: boolean,
  ): Promise<void> => {
    const existing = await (supabaseAdmin as any)
      .from('growth_graph_nodes')
      .select('signal_count, capital_weight_eur_cents')
      .eq('tenant_id', tenant_id)
      .eq('entity_id', entityId)
      .eq('node_type', nodeType)
      .maybeSingle()

    const currentSignalCount: number = (existing.data?.signal_count ?? 0) as number
    const currentCapitalWeight: number = (existing.data?.capital_weight_eur_cents ?? 0) as number

    const newCapitalWeight =
      eur_cents_value != null && incrementSignal
        ? currentCapitalWeight + eur_cents_value
        : currentCapitalWeight

    await (supabaseAdmin as any)
      .from('growth_graph_nodes')
      .upsert(
        {
          node_id: nodeId,
          tenant_id,
          node_type: nodeType,
          entity_id: entityId,
          label: `${nodeType}:${entityId}`,
          properties: {},
          capital_weight_eur_cents: newCapitalWeight,
          signal_count: incrementSignal ? currentSignalCount + 1 : currentSignalCount,
          last_active_at: now,
        },
        { onConflict: 'tenant_id,entity_id,node_type' },
      )
  }

  try {
    await Promise.all([
      upsertNode(fromNodeId, from_entity_id, from_type, true),
      upsertNode(toNodeId, to_entity_id, to_type, false),
    ])

    await (supabaseAdmin as any).from('growth_graph_edges').insert({
      edge_id: edgeId,
      tenant_id,
      from_node_id: fromNodeId,
      to_node_id: toNodeId,
      edge_type: signal_type,
      weight: 1.0,
      eur_cents_value: eur_cents_value ?? null,
      occurred_at: now,
      metadata,
    })

    log.info('[economicGrowthGraph] signal recorded', {
      from: fromNodeId,
      to: toNodeId,
      signal_type,
      eur_cents_value,
    })
  } catch (err) {
    log.info('[economicGrowthGraph] recordEconomicSignal error', { err: String(err) })
    throw err
  }
}

// ─── getGraphSnapshot ─────────────────────────────────────────────────────────

/**
 * Reads from growth_graph_nodes and growth_graph_edges,
 * computes counts, graph_density = edges / (nodes × (nodes-1)),
 * top 5 most connected by signal_count.
 * Persists to growth_graph_snapshots.
 */
export async function getGraphSnapshot(tenantId: string): Promise<GraphSnapshot> {
  const [nodesRes, edgesRes] = await Promise.all([
    (supabaseAdmin as any)
      .from('growth_graph_nodes')
      .select('*')
      .eq('tenant_id', tenantId),
    (supabaseAdmin as any)
      .from('growth_graph_edges')
      .select('*')
      .eq('tenant_id', tenantId),
  ])

  const nodes: GraphNode[] = (nodesRes.data ?? []) as GraphNode[]
  const edges: GraphEdge[] = (edgesRes.data ?? []) as GraphEdge[]

  const nodeCountsMap: Partial<Record<NodeType, number>> = {}
  let totalCapitalWeight = 0

  for (const node of nodes) {
    nodeCountsMap[node.node_type] = (nodeCountsMap[node.node_type] ?? 0) + 1
    totalCapitalWeight += node.capital_weight_eur_cents ?? 0
  }

  const signalCountsMap: Partial<Record<EconomicSignalType, number>> = {}
  for (const edge of edges) {
    const et = edge.edge_type as EconomicSignalType
    signalCountsMap[et] = (signalCountsMap[et] ?? 0) + 1
  }

  const totalNodes = nodes.length
  const totalEdges = edges.length
  const graphDensity =
    totalNodes > 1 ? totalEdges / (totalNodes * (totalNodes - 1)) : 0

  const mostConnected = [...nodes]
    .sort((a, b) => (b.signal_count ?? 0) - (a.signal_count ?? 0))
    .slice(0, 5)

  const allNodeTypes: NodeType[] = [
    'investor', 'lead', 'broker', 'asset', 'campaign', 'bid', 'capital_flow', 'market',
  ]
  const allSignalTypes: EconomicSignalType[] = [
    'IMPRESSION', 'CLICK', 'ENGAGEMENT', 'BID_SUBMITTED', 'CAPITAL_DEPOSIT',
    'DEAL_EXECUTION', 'ROI_REALIZED', 'LEAD_CREATED', 'LEAD_QUALIFIED',
    'CAMPAIGN_TRIGGERED', 'INVESTOR_ACTIVATED', 'MARKET_ENTRY',
  ]

  const nodeCounts = Object.fromEntries(
    allNodeTypes.map(t => [t, nodeCountsMap[t] ?? 0]),
  ) as Record<NodeType, number>

  const signalCounts = Object.fromEntries(
    allSignalTypes.map(t => [t, signalCountsMap[t] ?? 0]),
  ) as Record<EconomicSignalType, number>

  const snapshot: GraphSnapshot = {
    tenant_id: tenantId,
    generated_at: new Date().toISOString(),
    total_nodes: totalNodes,
    total_edges: totalEdges,
    node_counts: nodeCounts,
    signal_counts: signalCounts,
    total_capital_weight_eur_cents: totalCapitalWeight,
    graph_density: graphDensity,
    most_connected_nodes: mostConnected,
  }

  void (supabaseAdmin as any)
    .from('growth_graph_snapshots')
    .insert({
      tenant_id: snapshot.tenant_id,
      generated_at: snapshot.generated_at,
      total_nodes: snapshot.total_nodes,
      total_edges: snapshot.total_edges,
      node_counts: snapshot.node_counts,
      signal_counts: snapshot.signal_counts,
      total_capital_weight_eur_cents: snapshot.total_capital_weight_eur_cents,
      graph_density: snapshot.graph_density,
      most_connected_nodes: snapshot.most_connected_nodes,
    })
    .catch((e: unknown) => console.warn('[economicGrowthGraph] snapshot persist', e))

  return snapshot
}

// ─── getNodeConnections ───────────────────────────────────────────────────────

/**
 * Fetches node + all its edges + connected nodes. depth=1 default.
 */
export async function getNodeConnections(
  nodeId: string,
  tenantId: string,
  depth = 1,
): Promise<{ node: GraphNode; edges: GraphEdge[]; connected_nodes: GraphNode[] }> {
  const nodeRes = await (supabaseAdmin as any)
    .from('growth_graph_nodes')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('node_id', nodeId)
    .maybeSingle()

  if (!nodeRes.data) {
    throw new Error(`Node not found: ${nodeId}`)
  }

  const node = nodeRes.data as GraphNode

  // At depth=1, fetch all edges where from_node_id or to_node_id = nodeId
  const edgesRes = await (supabaseAdmin as any)
    .from('growth_graph_edges')
    .select('*')
    .eq('tenant_id', tenantId)
    .or(`from_node_id.eq.${nodeId},to_node_id.eq.${nodeId}`)

  const edges: GraphEdge[] = (edgesRes.data ?? []) as GraphEdge[]

  // Collect connected node IDs
  const connectedNodeIds = new Set<string>()
  for (const edge of edges) {
    if (edge.from_node_id !== nodeId) connectedNodeIds.add(edge.from_node_id)
    if (edge.to_node_id !== nodeId) connectedNodeIds.add(edge.to_node_id)
  }

  let connectedNodes: GraphNode[] = []
  if (connectedNodeIds.size > 0) {
    const idsArray = Array.from(connectedNodeIds)
    const connRes = await (supabaseAdmin as any)
      .from('growth_graph_nodes')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('node_id', idsArray)

    connectedNodes = (connRes.data ?? []) as GraphNode[]
  }

  // depth > 1: recurse one more level (collect edges of connected nodes)
  if (depth > 1 && connectedNodes.length > 0) {
    const extraEdgesRes = await (supabaseAdmin as any)
      .from('growth_graph_edges')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('from_node_id', connectedNodes.map(n => n.node_id))

    const extraEdges: GraphEdge[] = (extraEdgesRes.data ?? []) as GraphEdge[]
    const existingEdgeIds = new Set(edges.map(e => e.edge_id))
    for (const e of extraEdges) {
      if (!existingEdgeIds.has(e.edge_id)) edges.push(e)
    }
  }

  return { node, edges, connected_nodes: connectedNodes }
}

// ─── computeEconomicVelocity ──────────────────────────────────────────────────

/**
 * Reads last 24h signals vs prior 24h to compute velocity metrics.
 */
export async function computeEconomicVelocity(tenantId: string): Promise<{
  signals_per_hour_24h: number
  capital_velocity_eur_cents_per_day: number
  top_signal_types: Array<{ type: EconomicSignalType; count: number }>
  velocity_trend: 'ACCELERATING' | 'STABLE' | 'DECELERATING'
}> {
  const now = new Date()
  const t24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const t48h = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()

  const [recent, prior] = await Promise.all([
    (supabaseAdmin as any)
      .from('growth_graph_edges')
      .select('edge_type, eur_cents_value')
      .eq('tenant_id', tenantId)
      .gte('occurred_at', t24h),
    (supabaseAdmin as any)
      .from('growth_graph_edges')
      .select('edge_type, eur_cents_value')
      .eq('tenant_id', tenantId)
      .gte('occurred_at', t48h)
      .lt('occurred_at', t24h),
  ])

  const recentEdges: Array<{ edge_type: string; eur_cents_value: number | null }> =
    (recent.data ?? []) as Array<{ edge_type: string; eur_cents_value: number | null }>
  const priorEdges: Array<{ edge_type: string; eur_cents_value: number | null }> =
    (prior.data ?? []) as Array<{ edge_type: string; eur_cents_value: number | null }>

  const signalsPerHour24h = recentEdges.length / 24

  let capitalVelocity = 0
  for (const e of recentEdges) {
    if (e.eur_cents_value != null) capitalVelocity += e.eur_cents_value
  }

  // Top signal types in last 24h
  const sigMap: Partial<Record<EconomicSignalType, number>> = {}
  for (const e of recentEdges) {
    const t = e.edge_type as EconomicSignalType
    sigMap[t] = (sigMap[t] ?? 0) + 1
  }
  const topSignalTypes = Object.entries(sigMap)
    .map(([type, count]) => ({ type: type as EconomicSignalType, count: count ?? 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // Velocity trend
  const recentCount = recentEdges.length
  const priorCount = priorEdges.length
  let velocityTrend: 'ACCELERATING' | 'STABLE' | 'DECELERATING' = 'STABLE'
  if (recentCount > priorCount * 1.1) velocityTrend = 'ACCELERATING'
  else if (recentCount < priorCount * 0.9) velocityTrend = 'DECELERATING'

  return {
    signals_per_hour_24h: signalsPerHour24h,
    capital_velocity_eur_cents_per_day: capitalVelocity,
    top_signal_types: topSignalTypes,
    velocity_trend: velocityTrend,
  }
}
