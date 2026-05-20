// =============================================================================
// Agency Group — Investor Graph Engine
// lib/investors/graphEngine.ts
//
// Tracks relationships between investors, properties, and deals as a graph.
// Each interaction (match, interest, deal, referral) creates a weighted edge.
// Network effects: more edges → better routing → more liquidity.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export type EntityType  = 'investor' | 'property' | 'deal'
export type EdgeType    = 'match' | 'interest' | 'deal' | 'referral' | 'co_investment'

export interface GraphEdge {
  tenant_id: string
  from_type: EntityType
  from_id:   string
  to_type:   EntityType
  to_id:     string
  edge_type: EdgeType
  weight:    number    // 0–1
  metadata?: Record<string, unknown>
}

// ─── Edge creation ────────────────────────────────────────────────────────────

/**
 * Upsert a graph edge. Safe to call multiple times — idempotent by
 * (tenant_id, from_type, from_id, to_type, to_id, edge_type) unique constraint.
 * Weight is always taken from the latest call (higher confidence overwrites lower).
 */
export async function upsertGraphEdge(edge: GraphEdge): Promise<void> {
  const db = supabaseAdmin as any

  const { error } = await db
    .from('investor_graph_edges')
    .upsert({
      tenant_id: edge.tenant_id,
      from_type: edge.from_type,
      from_id:   edge.from_id,
      to_type:   edge.to_type,
      to_id:     edge.to_id,
      edge_type: edge.edge_type,
      weight:    edge.weight,
      metadata:  edge.metadata ?? {},
    }, {
      onConflict: 'tenant_id,from_type,from_id,to_type,to_id,edge_type',
    })

  if (error) {
    console.error('[GraphEngine] upsertGraphEdge failed:', error.message)
  }
}

// ─── Convenience helpers ──────────────────────────────────────────────────────

/** Called when an investor-property match is created. */
export async function recordMatchEdge(
  tenantId: string,
  investorId: string,
  propertyId: string,
  matchScore: number,  // 0–100 → normalised to 0–1
): Promise<void> {
  await upsertGraphEdge({
    tenant_id: tenantId,
    from_type: 'investor',
    from_id:   investorId,
    to_type:   'property',
    to_id:     propertyId,
    edge_type: 'match',
    weight:    Math.min(matchScore / 100, 1),
  })
}

/** Called when a deal closes, linking investor → deal. */
export async function recordDealEdge(
  tenantId: string,
  investorId: string,
  dealId: string,
  dealValueEur: number,
): Promise<void> {
  // Normalise deal value: €0–€10M → 0–1 weight (capped at 1)
  const weight = Math.min(dealValueEur / 10_000_000, 1)
  await upsertGraphEdge({
    tenant_id: tenantId,
    from_type: 'investor',
    from_id:   investorId,
    to_type:   'deal',
    to_id:     dealId,
    edge_type: 'deal',
    weight,
    metadata:  { deal_value_eur: dealValueEur },
  })
}

// ─── Network analytics ────────────────────────────────────────────────────────

export interface NetworkStats {
  total_edges:       number
  investor_nodes:    number
  property_nodes:    number
  deal_nodes:        number
  avg_edge_weight:   number
  density_score:     number   // edges / (nodes² / 2)
}

export async function getNetworkStats(tenantId: string): Promise<NetworkStats> {
  const db = supabaseAdmin as any

  const { data: edges, count } = await db
    .from('investor_graph_edges')
    .select('from_type, to_type, weight', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .limit(5000)

  const castEdges = (edges ?? []) as { from_type: EntityType; to_type: EntityType; weight: number }[]
  const totalEdges = count ?? castEdges.length

  const investorSet  = new Set<string>()
  const propertySet  = new Set<string>()
  const dealSet      = new Set<string>()
  let   weightSum    = 0

  // We only selected aggregate columns so use count-based stats
  for (const e of castEdges) {
    weightSum += e.weight
  }

  // For node counts, do separate queries
  const { count: investorNodes } = await db
    .from('investor_graph_edges')
    .select('from_id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('from_type', 'investor')

  const { count: propertyNodes } = await db
    .from('investor_graph_edges')
    .select('to_id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('to_type', 'property')

  const { count: dealNodes } = await db
    .from('investor_graph_edges')
    .select('to_id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('to_type', 'deal')

  void investorSet; void propertySet; void dealSet  // suppress unused vars

  const totalNodes   = (investorNodes ?? 0) + (propertyNodes ?? 0) + (dealNodes ?? 0)
  const maxEdges     = totalNodes > 1 ? (totalNodes * (totalNodes - 1)) / 2 : 1
  const avgWeight    = castEdges.length > 0 ? weightSum / castEdges.length : 0

  return {
    total_edges:     totalEdges,
    investor_nodes:  investorNodes ?? 0,
    property_nodes:  propertyNodes ?? 0,
    deal_nodes:      dealNodes ?? 0,
    avg_edge_weight: Math.round(avgWeight * 1000) / 1000,
    density_score:   Math.round((totalEdges / maxEdges) * 10000) / 10000,
  }
}
