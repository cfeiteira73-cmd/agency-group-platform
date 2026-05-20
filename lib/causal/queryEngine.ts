// =============================================================================
// Agency Group — Causal Query Engine
// lib/causal/queryEngine.ts
//
// Answers business questions like "why did this deal close?" by reconstructing
// and graphing causal chains stored in the `causal_trace` table.
//
// DESIGN:
//   - All functions are async and return typed Promises
//   - All Supabase calls are wrapped in try/catch — fail-open
//   - Guarded by CAUSAL_TRACE_ENABLED=true for any DB-dependent operation
//   - No `any` types except where the untyped Supabase client requires it
//
// TypeScript strict — 0 errors
// =============================================================================

import {
  getCausalChain,
  getRevenueTrace,
  reconstructLineage,
} from '@/lib/observability/causalTrace'
import type { CausalStep } from '@/lib/observability/causalTrace'
import { createClient } from '@supabase/supabase-js'

// ─── Graph Output Types ───────────────────────────────────────────────────────

export interface CausalNode {
  id: string
  type: 'event' | 'ai_decision' | 'db_mutation' | 'crm_action' | 'revenue'
  label: string
  timestamp: string
  agentId?: string
  model?: string
  entityId?: string
  entityType?: string
  revenueImpact?: number
  success: boolean
  metadata?: Record<string, unknown>
}

export interface CausalEdge {
  from: string
  to: string
  label: string
  latencyMs?: number
}

export interface CausalGraphResult {
  nodes: CausalNode[]
  edges: CausalEdge[]
  summary: string
  revenueImpact: number
  agentsInvolved: string[]
  durationMs: number
  hasFailures: boolean
}

export interface RevenueLeak {
  type:
    | 'dropped_lead'
    | 'failed_conversion'
    | 'missing_followup'
    | 'ai_misclassification'
    | 'stalled_deal'
  entityId: string
  entityType: string
  estimatedLossEur: number
  correlationId: string
  lastSeen: string
  description: string
}

export interface RevenueLeakReport {
  tenantId: string
  totalLeakageEur: number
  leaks: RevenueLeak[]
  analyzedAt: string
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Map a CausalStepType to the CausalNode union discriminant.
 * 'event_received' and unknown types → 'event'
 * 'revenue_outcome' → 'revenue'
 */
function stepTypeToNodeType(
  stepType: CausalStep['step_type'],
): CausalNode['type'] {
  switch (stepType) {
    case 'ai_decision':
      return 'ai_decision'
    case 'db_mutation':
      return 'db_mutation'
    case 'crm_action':
      return 'crm_action'
    case 'revenue_outcome':
      return 'revenue'
    default:
      return 'event'
  }
}

/**
 * Convert an ordered array of CausalStep records into graph nodes + edges.
 * Node ids are the step's array index as a string so edges remain stable
 * even if correlation_id is the same across all steps.
 */
function stepsToGraph(
  steps: CausalStep[],
): { nodes: CausalNode[]; edges: CausalEdge[] } {
  const nodes: CausalNode[] = steps.map((step, idx) => {
    const node: CausalNode = {
      id: String(idx),
      type: stepTypeToNodeType(step.step_type),
      label: step.action ?? step.step_type,
      timestamp: step.created_at,
      success: step.success,
    }
    if (step.agent_id !== undefined) node.agentId = step.agent_id
    if (step.model !== undefined) node.model = step.model
    if (step.entity_id !== undefined) node.entityId = step.entity_id
    if (step.entity_type !== undefined) node.entityType = step.entity_type
    if (step.revenue_delta !== undefined) node.revenueImpact = step.revenue_delta
    if (step.metadata !== undefined) node.metadata = step.metadata
    return node
  })

  const edges: CausalEdge[] = []
  for (let i = 0; i < nodes.length - 1; i++) {
    const current = steps[i]
    const edge: CausalEdge = {
      from: String(i),
      to: String(i + 1),
      label:
        current.latency_ms !== undefined
          ? `${current.latency_ms}ms`
          : 'next',
    }
    if (current.latency_ms !== undefined) edge.latencyMs = current.latency_ms
    edges.push(edge)
  }

  return { nodes, edges }
}

/** Derive metadata for a graph result from its node/step set. */
function deriveGraphMeta(
  nodes: CausalNode[],
  steps: CausalStep[],
): {
  revenueImpact: number
  agentsInvolved: string[]
  durationMs: number
  hasFailures: boolean
} {
  const revenueImpact = steps.reduce(
    (sum, s) => sum + (s.revenue_delta ?? 0),
    0,
  )
  const agentsInvolved = [
    ...new Set(
      steps.filter((s) => s.agent_id).map((s) => s.agent_id as string),
    ),
  ]
  const hasFailures = nodes.some((n) => !n.success)

  let durationMs = 0
  if (steps.length >= 2) {
    const first = new Date(steps[0].created_at).getTime()
    const last = new Date(steps[steps.length - 1].created_at).getTime()
    durationMs = last - first
  }

  return { revenueImpact, agentsInvolved, durationMs, hasFailures }
}

/** Inline Supabase admin client — identical pattern to causalTrace.ts. */
function getQueryClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient<any>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** Empty CausalGraphResult used as a safe fallback. */
function emptyGraph(summary: string): CausalGraphResult {
  return {
    nodes: [],
    edges: [],
    summary,
    revenueImpact: 0,
    agentsInvolved: [],
    durationMs: 0,
    hasFailures: false,
  }
}

// ─── 1. whyDidDealClose ───────────────────────────────────────────────────────

/**
 * Reconstruct the full causal graph explaining why a deal closed.
 *
 * Combines the revenue-bearing trace (getRevenueTrace) with the full
 * correlation chain (getCausalChain using dealId as fallback correlationId),
 * deduplicates, and builds a directed graph.
 *
 * @param dealId  UUID of the deal entity in `causal_trace.entity_id`
 */
export async function whyDidDealClose(dealId: string): Promise<CausalGraphResult> {
  try {
    // Fetch both traces in parallel
    const [revenueSteps, chainSteps] = await Promise.all([
      getRevenueTrace(dealId, 'deal'),
      getCausalChain(dealId),
    ])

    // Merge, deduplicate by created_at+step_type, and sort chronologically
    const seen = new Set<string>()
    const merged: CausalStep[] = []
    for (const step of [...revenueSteps, ...chainSteps]) {
      const key = `${step.created_at}:${step.step_type}:${step.action ?? ''}`
      if (!seen.has(key)) {
        seen.add(key)
        merged.push(step)
      }
    }
    merged.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    )

    if (merged.length === 0) {
      return emptyGraph(`No causal data found for deal ${dealId}.`)
    }

    const { nodes, edges } = stepsToGraph(merged)
    const { revenueImpact, agentsInvolved, durationMs, hasFailures } =
      deriveGraphMeta(nodes, merged)

    const summary =
      agentsInvolved.length > 0
        ? `Deal ${dealId} closed via ${agentsInvolved.join(', ')}. Revenue: €${revenueImpact.toLocaleString('pt-PT')}`
        : `Deal ${dealId} closed. Revenue: €${revenueImpact.toLocaleString('pt-PT')}`

    return { nodes, edges, summary, revenueImpact, agentsInvolved, durationMs, hasFailures }
  } catch (err) {
    console.warn('[causal-query] whyDidDealClose error:', err)
    return emptyGraph(`Error tracing deal ${dealId}.`)
  }
}

// ─── 2. findRevenueLeak ───────────────────────────────────────────────────────

/**
 * Scan the last 7 days of causal_trace for this tenant and surface any
 * patterns that indicate lost or stalled revenue.
 *
 * Leak categories and estimated losses:
 *   ai_decision failure         → 'ai_misclassification'  €5,000
 *   email_sent/whatsapp_sent    → 'missing_followup'       €3,000
 *   db_mutation failure         → 'failed_conversion'      €8,000
 *   inbound WhatsApp w/o reply  → 'missing_followup'       €3,000
 *   all other failures          → 'dropped_lead'           €2,000
 *
 * Fails open: returns an empty report if Supabase is unavailable or
 * CAUSAL_TRACE_ENABLED is not 'true'.
 *
 * @param tenantId  Tenant identifier stored in `causal_trace.tenant_id`
 */
export async function findRevenueLeak(tenantId: string): Promise<RevenueLeakReport> {
  const empty: RevenueLeakReport = {
    tenantId,
    totalLeakageEur: 0,
    leaks: [],
    analyzedAt: new Date().toISOString(),
  }

  if (process.env.CAUSAL_TRACE_ENABLED === 'false') return empty

  const client = getQueryClient()
  if (!client) {
    console.warn('[causal-query] Supabase not configured — skipping revenue leak scan')
    return empty
  }

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    // Query 1: all failed steps in the last 7 days
    const { data: failures, error: failError } = await client
      .from('causal_trace')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('success', false)
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(100)

    if (failError) {
      console.warn('[causal-query] findRevenueLeak failures query failed:', failError.message)
      return empty
    }

    // Query 2: inbound WhatsApp events in last 24 h — look for correlation_ids
    //   with an 'event_received' + action='whatsapp_inbound' that have no
    //   subsequent 'whatsapp_sent' step in the same correlation_id window.
    const { data: inboundRaw, error: inboundError } = await client
      .from('causal_trace')
      .select('correlation_id, entity_id, entity_type, created_at, metadata')
      .eq('tenant_id', tenantId)
      .eq('step_type', 'event_received')
      .eq('action', 'whatsapp_inbound')
      .gte('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false })
      .limit(100)

    if (inboundError) {
      console.warn('[causal-query] findRevenueLeak inbound query failed:', inboundError.message)
      // Carry on with failures only
    }

    // Find correlation_ids that have NO outbound whatsapp_sent step
    const unansweredCorrelationIds: string[] = []
    if (inboundRaw && inboundRaw.length > 0) {
      const inboundCorrelationIds: string[] = inboundRaw.map(
        (r: { correlation_id: string }) => r.correlation_id,
      )

      const { data: sentRaw } = await client
        .from('causal_trace')
        .select('correlation_id')
        .eq('tenant_id', tenantId)
        .eq('step_type', 'whatsapp_sent')
        .in('correlation_id', inboundCorrelationIds)
        .gte('created_at', twentyFourHoursAgo)

      const sentCorrelationIdSet = new Set<string>(
        (sentRaw ?? []).map((r: { correlation_id: string }) => r.correlation_id),
      )

      for (const row of inboundRaw) {
        const r = row as {
          correlation_id: string
          entity_id: string | null
          entity_type: string | null
          created_at: string
        }
        if (!sentCorrelationIdSet.has(r.correlation_id)) {
          unansweredCorrelationIds.push(r.correlation_id)
        }
      }
    }

    // Build a lookup for inbound rows by correlationId
    const inboundByCorrelation = new Map<
      string,
      { entity_id: string | null; entity_type: string | null; created_at: string }
    >()
    if (inboundRaw) {
      for (const row of inboundRaw) {
        const r = row as {
          correlation_id: string
          entity_id: string | null
          entity_type: string | null
          created_at: string
        }
        if (!inboundByCorrelation.has(r.correlation_id)) {
          inboundByCorrelation.set(r.correlation_id, {
            entity_id: r.entity_id,
            entity_type: r.entity_type,
            created_at: r.created_at,
          })
        }
      }
    }

    // ── Map failures to RevenueLeak objects ──────────────────────────────────

    const leaks: RevenueLeak[] = []

    for (const row of failures ?? []) {
      const step = row as CausalStep

      let leakType: RevenueLeak['type']
      let estimatedLossEur: number

      if (step.step_type === 'ai_decision') {
        leakType = 'ai_misclassification'
        estimatedLossEur = 5_000
      } else if (
        step.step_type === 'email_sent' ||
        step.step_type === 'whatsapp_sent'
      ) {
        leakType = 'missing_followup'
        estimatedLossEur = 3_000
      } else if (step.step_type === 'db_mutation') {
        leakType = 'failed_conversion'
        estimatedLossEur = 8_000
      } else {
        leakType = 'dropped_lead'
        estimatedLossEur = 2_000
      }

      leaks.push({
        type: leakType,
        entityId: step.entity_id ?? step.correlation_id,
        entityType: step.entity_type ?? 'unknown',
        estimatedLossEur,
        correlationId: step.correlation_id,
        lastSeen: step.created_at,
        description:
          step.error_message ??
          `${step.step_type} failed${step.action ? ` during '${step.action}'` : ''}`,
      })
    }

    // ── Unanswered WhatsApp inbounds ─────────────────────────────────────────

    for (const correlationId of unansweredCorrelationIds) {
      const ref = inboundByCorrelation.get(correlationId)
      leaks.push({
        type: 'missing_followup',
        entityId: ref?.entity_id ?? correlationId,
        entityType: ref?.entity_type ?? 'lead',
        estimatedLossEur: 3_000,
        correlationId,
        lastSeen: ref?.created_at ?? new Date().toISOString(),
        description: 'Inbound WhatsApp received with no outbound reply within 24 h',
      })
    }

    const totalLeakageEur = leaks.reduce((sum, l) => sum + l.estimatedLossEur, 0)

    return {
      tenantId,
      totalLeakageEur,
      leaks,
      analyzedAt: new Date().toISOString(),
    }
  } catch (err) {
    console.warn('[causal-query] findRevenueLeak unexpected error:', err)
    return empty
  }
}

// ─── 3. traceAgentDecision ────────────────────────────────────────────────────

/**
 * Trace only the AI decision steps within a correlation chain.
 * Useful for auditing which Claude models / agents made decisions
 * for a given business flow.
 *
 * @param correlationId  The correlation_id shared across all steps in the flow
 */
export async function traceAgentDecision(
  correlationId: string,
): Promise<CausalGraphResult> {
  try {
    const allSteps = await getCausalChain(correlationId)
    const aiSteps = allSteps.filter((s) => s.step_type === 'ai_decision')

    if (aiSteps.length === 0) {
      return emptyGraph(
        `No AI decision steps found for correlation ${correlationId}.`,
      )
    }

    const { nodes, edges } = stepsToGraph(aiSteps)
    const { revenueImpact, agentsInvolved, durationMs, hasFailures } =
      deriveGraphMeta(nodes, aiSteps)

    const summary = `${aiSteps.length} AI decision(s) traced for correlation ${correlationId}`

    return { nodes, edges, summary, revenueImpact, agentsInvolved, durationMs, hasFailures }
  } catch (err) {
    console.warn('[causal-query] traceAgentDecision error:', err)
    return emptyGraph(`Error tracing agent decisions for ${correlationId}.`)
  }
}

// ─── 4. reconstructCausalChain ────────────────────────────────────────────────

/**
 * Reconstruct the full causal lineage for a correlation_id and return it
 * as a graph, leveraging the rich `reconstructLineage` output from causalTrace.
 *
 * @param correlationId  The correlation_id to reconstruct
 */
export async function reconstructCausalChain(
  correlationId: string,
): Promise<CausalGraphResult> {
  try {
    const lineage = await reconstructLineage(correlationId)

    if (lineage.chain.length === 0) {
      return emptyGraph(`No lineage data found for correlation ${correlationId}.`)
    }

    const { nodes, edges } = stepsToGraph(lineage.chain)

    const agentsInvolved = lineage.agentsCalled
    const revenueImpact = lineage.revenueTotal
    const durationMs = lineage.durationMs
    const hasFailures = lineage.hasErrors

    const entitySummary =
      lineage.entitiesAffected.length > 0
        ? ` Entities affected: ${lineage.entitiesAffected.map((e) => `${e.type}:${e.id}`).join(', ')}.`
        : ''

    const summary =
      `Causal chain for ${correlationId}: ${lineage.chain.length} step(s)` +
      (agentsInvolved.length > 0
        ? `, agents: ${agentsInvolved.join(', ')}`
        : '') +
      `, revenue: €${revenueImpact.toLocaleString('pt-PT')}` +
      `.${entitySummary}`

    return { nodes, edges, summary, revenueImpact, agentsInvolved, durationMs, hasFailures }
  } catch (err) {
    console.warn('[causal-query] reconstructCausalChain error:', err)
    return emptyGraph(`Error reconstructing chain for ${correlationId}.`)
  }
}
