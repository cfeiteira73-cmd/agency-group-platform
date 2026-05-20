// Agency Group — Graph Intelligence Engine
// lib/graph/intelligence.ts
// Supabase-backed relationship intelligence (Neo4j-ready adapter pattern).
// Analyzes buyer clusters, agent performance, referral networks, revenue paths.
// TypeScript strict — 0 errors

import { createClient } from '@supabase/supabase-js'

// ─── Graph Types ──────────────────────────────────────────────────────────────

export interface GraphNode {
  id: string
  type: 'lead' | 'buyer' | 'agent' | 'property' | 'deal' | 'ai_decision' | 'revenue_event'
  label: string
  properties: Record<string, unknown>
  weight?: number               // importance score
}

export interface GraphEdge {
  from: string
  to: string
  relationship:
    | 'INFLUENCED'
    | 'MANAGED_BY'
    | 'INTERESTED_IN'
    | 'GENERATED'
    | 'LED_TO'
    | 'CLOSED_BY'
    | 'REFERRED_BY'
  weight?: number
  metadata?: Record<string, unknown>
}

export interface GraphQuery {
  nodes: GraphNode[]
  edges: GraphEdge[]
  insights: string[]
  metadata: { nodeCount: number; edgeCount: number; queryTimeMs: number }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env vars missing — cannot initialise graph intelligence client')
  return createClient(url, key)
}

function buildMeta(nodes: GraphNode[], edges: GraphEdge[], startMs: number) {
  return {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    queryTimeMs: Date.now() - startMs,
  }
}

function emptyGraph(startMs: number, insight: string): GraphQuery {
  return {
    nodes: [],
    edges: [],
    insights: [insight],
    metadata: buildMeta([], [], startMs),
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Finds buyers with similar: budget range, location preference, property type.
 * Source: Supabase contacts table — clusters contacts by zone + budget ±20%.
 */
export async function getBuyerSimilarityCluster(
  buyerId: string,
  tenantId: string,
  limit = 10,
): Promise<GraphQuery> {
  const startMs = Date.now()
  try {
    const db = getAdminClient()

    // Fetch anchor buyer
    const { data: anchor, error: anchorErr } = await db
      .from('contacts')
      .select('id, nome, orcamento_min, orcamento_max, zona_preferida, tipo_imovel, canal_origem')
      .eq('id', buyerId)
      .eq('tenant_id', tenantId)
      .single()

    if (anchorErr || !anchor) {
      return emptyGraph(startMs, `Anchor buyer ${buyerId} not found`)
    }

    const budgetMin = typeof anchor.orcamento_min === 'number' ? anchor.orcamento_min : 0
    const budgetMax = typeof anchor.orcamento_max === 'number' ? anchor.orcamento_max : 0
    const tolerance = 0.2
    const rangeMin = budgetMin * (1 - tolerance)
    const rangeMax = budgetMax > 0 ? budgetMax * (1 + tolerance) : budgetMin * (1 + tolerance) * 2

    // Fetch similar buyers
    let query = db
      .from('contacts')
      .select('id, nome, orcamento_min, orcamento_max, zona_preferida, tipo_imovel, canal_origem')
      .eq('tenant_id', tenantId)
      .neq('id', buyerId)
      .limit(limit)

    if (anchor.zona_preferida) {
      query = query.eq('zona_preferida', anchor.zona_preferida)
    }
    if (rangeMax > 0) {
      query = query.gte('orcamento_min', rangeMin).lte('orcamento_max', rangeMax)
    }

    const { data: similar } = await query

    const nodes: GraphNode[] = [
      {
        id: anchor.id as string,
        type: 'buyer',
        label: (anchor.nome as string) ?? 'Unknown Buyer',
        properties: { ...anchor, is_anchor: true },
        weight: 1.0,
      },
    ]

    const edges: GraphEdge[] = []
    const similarList = (similar ?? []) as Array<Record<string, unknown>>

    for (const contact of similarList) {
      const nodeId = contact.id as string
      nodes.push({
        id: nodeId,
        type: 'buyer',
        label: (contact.nome as string) ?? 'Buyer',
        properties: contact,
        weight: 0.7,
      })
      edges.push({
        from: anchor.id as string,
        to: nodeId,
        relationship: 'INFLUENCED',
        weight: 0.7,
        metadata: { similarity: 'budget+zone' },
      })
    }

    const insights: string[] = [
      `Found ${similarList.length} buyers similar to ${anchor.nome ?? buyerId}`,
      `Cluster zone: ${anchor.zona_preferida ?? 'Any'} | Budget: €${budgetMin.toLocaleString()}–€${budgetMax.toLocaleString()}`,
    ]

    return { nodes, edges, insights, metadata: buildMeta(nodes, edges, startMs) }
  } catch (err) {
    return emptyGraph(startMs, `getBuyerSimilarityCluster error: ${String(err)}`)
  }
}

/**
 * Builds a graph of Agent → Deals they managed → Revenue they generated.
 * Source: causal_trace where agent_id IS NOT NULL and revenue_delta IS NOT NULL.
 */
export async function getAgentRevenueGraph(
  tenantId: string,
  agentId?: string,
): Promise<GraphQuery> {
  const startMs = Date.now()
  try {
    const db = getAdminClient()

    let query = db
      .from('causal_trace')
      .select('id, agent_id, correlation_id, step_type, revenue_delta, action, entity_id, entity_type, success, created_at')
      .eq('tenant_id', tenantId)
      .not('agent_id', 'is', null)
      .not('revenue_delta', 'is', null)
      .order('created_at', { ascending: false })
      .limit(200)

    if (agentId) {
      query = query.eq('agent_id', agentId)
    }

    const { data: steps, error } = await query
    if (error || !steps) {
      return emptyGraph(startMs, `causal_trace query failed: ${error?.message ?? 'no data'}`)
    }

    const agentNodes = new Map<string, GraphNode>()
    const dealNodes  = new Map<string, GraphNode>()
    const revNodes   = new Map<string, GraphNode>()
    const edges: GraphEdge[] = []

    for (const step of steps as Array<Record<string, unknown>>) {
      const aid  = step.agent_id as string
      const cid  = step.correlation_id as string
      const rev  = step.revenue_delta as number
      const revId = `rev_${cid}`

      // Agent node
      if (!agentNodes.has(aid)) {
        agentNodes.set(aid, {
          id: aid,
          type: 'agent',
          label: `Agent: ${aid}`,
          properties: { agent_id: aid },
          weight: 0,
        })
      }
      const agNode = agentNodes.get(aid)!
      agNode.weight = (agNode.weight ?? 0) + Math.abs(rev)

      // Deal node
      if (!dealNodes.has(cid)) {
        dealNodes.set(cid, {
          id: cid,
          type: 'deal',
          label: `Deal ${cid.slice(0, 8)}`,
          properties: { correlation_id: cid },
          weight: 0,
        })
        edges.push({ from: aid, to: cid, relationship: 'MANAGED_BY', weight: 1 })
      }
      const dealNode = dealNodes.get(cid)!
      dealNode.weight = (dealNode.weight ?? 0) + Math.abs(rev)

      // Revenue event node
      if (!revNodes.has(revId)) {
        revNodes.set(revId, {
          id: revId,
          type: 'revenue_event',
          label: `€${Math.abs(rev).toLocaleString()}`,
          properties: { revenue_delta: rev, correlation_id: cid },
          weight: Math.abs(rev),
        })
        edges.push({ from: cid, to: revId, relationship: 'GENERATED', weight: Math.abs(rev) })
      }
    }

    const nodes: GraphNode[] = [
      ...Array.from(agentNodes.values()),
      ...Array.from(dealNodes.values()),
      ...Array.from(revNodes.values()),
    ]

    const totalRevenue = Array.from(revNodes.values()).reduce((s, n) => s + (n.weight ?? 0), 0)
    const insights = [
      `${agentNodes.size} agents, ${dealNodes.size} deals, €${totalRevenue.toLocaleString()} total revenue traced`,
      agentId ? `Filtered to agent: ${agentId}` : 'All agents included',
    ]

    return { nodes, edges, insights, metadata: buildMeta(nodes, edges, startMs) }
  } catch (err) {
    return emptyGraph(startMs, `getAgentRevenueGraph error: ${String(err)}`)
  }
}

/**
 * Maps the most common paths from lead → deal → revenue.
 * Source: causal_trace grouped by correlation_id.
 * Returns top 5 paths as graph structure.
 */
export async function getConversionPathIntelligence(tenantId: string): Promise<GraphQuery> {
  const startMs = Date.now()
  try {
    const db = getAdminClient()

    const { data: steps, error } = await db
      .from('causal_trace')
      .select('correlation_id, step_type, action, entity_type, revenue_delta, success, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true })
      .limit(500)

    if (error || !steps) {
      return emptyGraph(startMs, `causal_trace path query failed: ${error?.message ?? 'no data'}`)
    }

    // Group steps by correlation_id to form paths
    const pathMap = new Map<string, Array<Record<string, unknown>>>()
    for (const step of steps as Array<Record<string, unknown>>) {
      const cid = step.correlation_id as string
      if (!pathMap.has(cid)) pathMap.set(cid, [])
      pathMap.get(cid)!.push(step)
    }

    // Build a path signature: joined step_type sequence
    const sigCount = new Map<string, { count: number; revenue: number; cid: string }>()
    for (const [cid, pathSteps] of pathMap) {
      const sig = pathSteps.map(s => s.step_type as string).join(' → ')
      const rev = pathSteps.reduce((s, p) => s + (typeof p.revenue_delta === 'number' ? p.revenue_delta : 0), 0)
      const existing = sigCount.get(sig)
      if (existing) {
        existing.count++
        existing.revenue += rev
      } else {
        sigCount.set(sig, { count: 1, revenue: rev, cid })
      }
    }

    // Top 5 paths by revenue
    const top5 = Array.from(sigCount.entries())
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 5)

    const nodes: GraphNode[] = []
    const edges: GraphEdge[] = []
    const seenStepNodes = new Set<string>()

    for (const [sig, info] of top5) {
      const stepTypes = sig.split(' → ')
      let prevNodeId: string | null = null

      for (let i = 0; i < stepTypes.length; i++) {
        const stepLabel = stepTypes[i]
        const nodeId = `step_${stepLabel.replace(/\W+/g, '_')}`

        if (!seenStepNodes.has(nodeId)) {
          seenStepNodes.add(nodeId)
          nodes.push({
            id: nodeId,
            type: i === 0 ? 'lead' : i === stepTypes.length - 1 ? 'revenue_event' : 'ai_decision',
            label: stepLabel,
            properties: { step_index: i },
            weight: info.count,
          })
        }

        if (prevNodeId) {
          edges.push({
            from: prevNodeId,
            to: nodeId,
            relationship: 'LED_TO',
            weight: info.count,
            metadata: { path_count: info.count, revenue: info.revenue },
          })
        }
        prevNodeId = nodeId
      }
    }

    const insights = [
      `Analysed ${pathMap.size} conversion paths across ${steps.length} causal steps`,
      `Top path: ${top5[0]?.[0] ?? 'N/A'} (${top5[0]?.[1].count ?? 0} occurrences)`,
    ]

    return { nodes, edges, insights, metadata: buildMeta(nodes, edges, startMs) }
  } catch (err) {
    return emptyGraph(startMs, `getConversionPathIntelligence error: ${String(err)}`)
  }
}

/**
 * Placeholder for future referral tracking.
 * Currently returns graph of contacts who interacted with multiple properties.
 * Source: causal_trace entity_type='contact' with multiple entity_id occurrences.
 */
export async function getReferralInfluenceMap(tenantId: string): Promise<GraphQuery> {
  const startMs = Date.now()
  try {
    const db = getAdminClient()

    const { data: steps, error } = await db
      .from('causal_trace')
      .select('entity_id, entity_type, correlation_id, action, created_at')
      .eq('tenant_id', tenantId)
      .eq('entity_type', 'contact')
      .not('entity_id', 'is', null)
      .limit(300)

    if (error || !steps) {
      return emptyGraph(startMs, `getReferralInfluenceMap query failed: ${error?.message ?? 'no data'}`)
    }

    // Count interactions per contact
    const contactMap = new Map<string, { correlations: Set<string>; actions: string[] }>()
    for (const step of steps as Array<Record<string, unknown>>) {
      const eid = step.entity_id as string
      const cid = step.correlation_id as string
      if (!contactMap.has(eid)) contactMap.set(eid, { correlations: new Set(), actions: [] })
      const entry = contactMap.get(eid)!
      entry.correlations.add(cid)
      if (step.action) entry.actions.push(step.action as string)
    }

    // Only contacts with multiple interactions
    const multiContact = Array.from(contactMap.entries()).filter(([, v]) => v.correlations.size > 1)

    const nodes: GraphNode[] = []
    const edges: GraphEdge[] = []

    for (const [contactId, info] of multiContact) {
      nodes.push({
        id: contactId,
        type: 'buyer',
        label: `Contact ${contactId.slice(0, 8)}`,
        properties: {
          interaction_count: info.correlations.size,
          actions: info.actions.slice(0, 5),
        },
        weight: info.correlations.size,
      })

      for (const cid of info.correlations) {
        const propNodeId = `prop_${cid}`
        if (!nodes.find(n => n.id === propNodeId)) {
          nodes.push({
            id: propNodeId,
            type: 'property',
            label: `Property context ${cid.slice(0, 8)}`,
            properties: { correlation_id: cid },
          })
        }
        edges.push({
          from: contactId,
          to: propNodeId,
          relationship: 'INTERESTED_IN',
          weight: 1,
        })
      }
    }

    const insights = [
      `${multiContact.length} contacts with multi-property interest (referral candidates)`,
      `Future: wire referral_code field to upgrade INTERESTED_IN → REFERRED_BY`,
    ]

    return { nodes, edges, insights, metadata: buildMeta(nodes, edges, startMs) }
  } catch (err) {
    return emptyGraph(startMs, `getReferralInfluenceMap error: ${String(err)}`)
  }
}

/**
 * Returns full connected graph for a single entity.
 * All causal_trace steps involving this entityId → build nodes + edges.
 */
export async function getEntityOntology(
  entityId: string,
  entityType: GraphNode['type'],
  tenantId: string,
): Promise<GraphQuery> {
  const startMs = Date.now()
  try {
    const db = getAdminClient()

    const { data: steps, error } = await db
      .from('causal_trace')
      .select('id, correlation_id, step_type, agent_id, entity_id, entity_type, action, revenue_delta, success, created_at')
      .eq('tenant_id', tenantId)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: true })
      .limit(100)

    if (error || !steps) {
      return emptyGraph(startMs, `getEntityOntology query failed: ${error?.message ?? 'no data'}`)
    }

    const castSteps = steps as Array<Record<string, unknown>>

    // Root entity node
    const rootNode: GraphNode = {
      id: entityId,
      type: entityType,
      label: `${entityType}: ${entityId.slice(0, 8)}`,
      properties: { entity_id: entityId, entity_type: entityType },
      weight: castSteps.length,
    }

    const nodes: GraphNode[] = [rootNode]
    const edges: GraphEdge[] = []
    const seenAgents = new Set<string>()
    const seenCorrelations = new Set<string>()

    for (const step of castSteps) {
      const stepNodeId = step.id as string
      const agentId = step.agent_id as string | undefined
      const cid = step.correlation_id as string
      const rev = step.revenue_delta as number | undefined

      // Step node
      nodes.push({
        id: stepNodeId,
        type: step.step_type === 'ai_decision' ? 'ai_decision' : 'deal',
        label: (step.action as string) ?? (step.step_type as string),
        properties: { ...step },
        weight: rev ? Math.abs(rev) : 1,
      })
      edges.push({
        from: entityId,
        to: stepNodeId,
        relationship: 'INFLUENCED',
        metadata: { step_type: step.step_type, success: step.success },
      })

      // Agent node
      if (agentId && !seenAgents.has(agentId)) {
        seenAgents.add(agentId)
        nodes.push({
          id: agentId,
          type: 'agent',
          label: `Agent: ${agentId}`,
          properties: { agent_id: agentId },
        })
        edges.push({ from: stepNodeId, to: agentId, relationship: 'MANAGED_BY' })
      }

      // Correlation / deal chain node
      if (!seenCorrelations.has(cid)) {
        seenCorrelations.add(cid)
        const dealNodeId = `deal_${cid}`
        nodes.push({
          id: dealNodeId,
          type: 'deal',
          label: `Chain ${cid.slice(0, 8)}`,
          properties: { correlation_id: cid },
        })
        edges.push({ from: stepNodeId, to: dealNodeId, relationship: 'LED_TO' })
      }

      // Revenue event
      if (rev && rev > 0) {
        const revId = `rev_${stepNodeId}`
        nodes.push({
          id: revId,
          type: 'revenue_event',
          label: `€${rev.toLocaleString()}`,
          properties: { revenue_delta: rev },
          weight: rev,
        })
        edges.push({ from: stepNodeId, to: revId, relationship: 'GENERATED', weight: rev })
      }
    }

    const totalRevenue = castSteps.reduce(
      (s, st) => s + (typeof st.revenue_delta === 'number' && st.revenue_delta > 0 ? st.revenue_delta : 0),
      0,
    )

    const insights = [
      `Entity ${entityId.slice(0, 8)} (${entityType}): ${castSteps.length} causal steps`,
      `Agents involved: ${seenAgents.size} | Chains: ${seenCorrelations.size} | Revenue: €${totalRevenue.toLocaleString()}`,
    ]

    return { nodes, edges, insights, metadata: buildMeta(nodes, edges, startMs) }
  } catch (err) {
    return emptyGraph(startMs, `getEntityOntology error: ${String(err)}`)
  }
}
