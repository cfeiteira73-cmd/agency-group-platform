// =============================================================================
// Agency Group — Conversion Optimizer
// lib/revenue/conversionOptimizer.ts
//
// Identifies highest-performing flows and drop-off patterns.
// Queries causal_trace and ai_feedback via Supabase.
//
// DESIGN:
//   - All functions are async and return typed Promises
//   - All Supabase calls are wrapped in try/catch — fail-open
//   - No module-level side effects or instantiation
//   - createClient<any> with eslint-disable for untyped tables
//
// TypeScript strict — 0 errors
// =============================================================================

import { createClient } from '@supabase/supabase-js'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConversionFlow {
  flowId: string
  name: string
  steps: string[]
  conversionRate: number
  avgRevenueEur: number
  avgLatencyMs: number
  sampleCount: number
  trend: 'improving' | 'stable' | 'declining'
}

export interface DropOffPoint {
  step: string
  dropOffRate: number
  estimatedLossEur: number
  recommendation: string
}

export interface OptimizationReport {
  tenant_id: string
  generated_at: string
  topFlows: ConversionFlow[]
  dropOffPoints: DropOffPoint[]
  quickWins: string[]
  totalOptimizableRevenueEur: number
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function getClient() {
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

/** Stable hash of a sorted step-type sequence — used as flowId. */
function flowId(steps: string[]): string {
  return steps.join('→')
}

/** Derive a human-readable flow name from step sequence. */
function flowName(steps: string[]): string {
  if (steps.length === 0) return 'unknown'
  return steps.join(' → ')
}

// ─── analyzeConversionFlows ───────────────────────────────────────────────────

/**
 * Queries causal_trace for the tenant and analyzes step sequences.
 *
 * Algorithm:
 *   1. Group steps by correlation_id
 *   2. Build step-type sequence per group (sorted by created_at)
 *   3. A correlation_id "converted" if it contains a 'revenue_outcome' step
 *   4. Group correlation_ids by sequence signature → compute metrics
 *   5. Identify drop-offs: event_received with no revenue_outcome within 7 days
 *
 * Returns an empty report (with message) if < 10 traces available.
 * Fails open — never throws.
 */
export async function analyzeConversionFlows(tenantId: string): Promise<OptimizationReport> {
  const emptyReport: OptimizationReport = {
    tenant_id: tenantId,
    generated_at: new Date().toISOString(),
    topFlows: [],
    dropOffPoints: [],
    quickWins: ['Collect more causal_trace data (minimum 10 traces needed for analysis).'],
    totalOptimizableRevenueEur: 0,
  }

  const client = getClient()
  if (!client) {
    console.warn('[conversion-optimizer] Supabase not configured — skipping analyzeConversionFlows')
    return emptyReport
  }

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // Fetch causal_trace rows for this tenant in the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const { data: traces, error } = await client
      .from('causal_trace')
      .select('correlation_id, step_type, action, revenue_delta, latency_ms, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: true })
      .limit(5000)

    if (error) {
      console.warn('[conversion-optimizer] analyzeConversionFlows query error:', error.message)
      return emptyReport
    }

    if (!traces || traces.length < 10) {
      return emptyReport
    }

    // ── Group by correlation_id ─────────────────────────────────────────────

    type TraceRow = {
      correlation_id: string
      step_type: string
      action: string | null
      revenue_delta: number | null
      latency_ms: number | null
      created_at: string
    }

    const grouped = new Map<string, TraceRow[]>()
    for (const row of traces as TraceRow[]) {
      if (!grouped.has(row.correlation_id)) {
        grouped.set(row.correlation_id, [])
      }
      grouped.get(row.correlation_id)!.push(row)
    }

    if (grouped.size < 10) return emptyReport

    // ── Build flow signatures ───────────────────────────────────────────────

    type FlowData = {
      steps: string[]
      converted: boolean
      revenueEur: number
      latencyMs: number
      correlationId: string
      firstSeen: string
    }

    const allFlows: FlowData[] = []

    for (const [correlationId, rows] of grouped.entries()) {
      // rows already sorted ascending by created_at from the query
      const steps = rows.map((r) => r.step_type)
      const converted = steps.includes('revenue_outcome')
      const revenueEur = rows.reduce((sum, r) => sum + (r.revenue_delta ?? 0), 0)

      let latencyMs = 0
      if (rows.length >= 2) {
        const first = new Date(rows[0].created_at).getTime()
        const last = new Date(rows[rows.length - 1].created_at).getTime()
        latencyMs = last - first
      }

      allFlows.push({
        steps,
        converted,
        revenueEur,
        latencyMs,
        correlationId,
        firstSeen: rows[0].created_at,
      })
    }

    // ── Aggregate by flow signature ─────────────────────────────────────────

    type FlowAgg = {
      name: string
      steps: string[]
      convertedCount: number
      totalCount: number
      totalRevenue: number
      totalLatency: number
      recentConverted: number
      recentTotal: number
    }

    const flowMap = new Map<string, FlowAgg>()

    for (const flow of allFlows) {
      const id = flowId(flow.steps)
      if (!flowMap.has(id)) {
        flowMap.set(id, {
          name: flowName(flow.steps),
          steps: flow.steps,
          convertedCount: 0,
          totalCount: 0,
          totalRevenue: 0,
          totalLatency: 0,
          recentConverted: 0,
          recentTotal: 0,
        })
      }
      const agg = flowMap.get(id)!
      agg.totalCount++
      agg.totalRevenue += flow.revenueEur
      agg.totalLatency += flow.latencyMs
      if (flow.converted) agg.convertedCount++

      // Recent = last 7 days
      if (flow.firstSeen >= sevenDaysAgo) {
        agg.recentTotal++
        if (flow.converted) agg.recentConverted++
      }
    }

    // ── Build ConversionFlow objects ────────────────────────────────────────

    const conversionFlows: ConversionFlow[] = []

    for (const [id, agg] of flowMap.entries()) {
      if (agg.totalCount < 2) continue

      const conversionRate = agg.convertedCount / agg.totalCount
      const avgRevenueEur =
        agg.convertedCount > 0 ? agg.totalRevenue / agg.convertedCount : 0
      const avgLatencyMs = agg.totalLatency / agg.totalCount

      // Trend: compare recent conversion rate vs overall
      let trend: ConversionFlow['trend'] = 'stable'
      if (agg.recentTotal >= 3) {
        const recentRate = agg.recentConverted / agg.recentTotal
        const delta = recentRate - conversionRate
        if (delta > 0.05) trend = 'improving'
        else if (delta < -0.05) trend = 'declining'
      }

      conversionFlows.push({
        flowId: id,
        name: agg.name,
        steps: agg.steps,
        conversionRate,
        avgRevenueEur,
        avgLatencyMs,
        sampleCount: agg.totalCount,
        trend,
      })
    }

    // Top 5 by conversionRate
    conversionFlows.sort((a, b) => b.conversionRate - a.conversionRate)
    const topFlows = conversionFlows.slice(0, 5)

    // ── Drop-off analysis ───────────────────────────────────────────────────

    const dropOffPoints: DropOffPoint[] = []

    // Find correlation_ids with event_received but no revenue_outcome within 7 days
    const inboundNoRevenue = allFlows.filter(
      (f) =>
        f.steps.includes('event_received') &&
        !f.converted &&
        f.firstSeen < sevenDaysAgo,
    )

    // Group by the last step seen (the drop-off point)
    const dropOffMap = new Map<string, number>()
    const totalWithInbound = allFlows.filter((f) => f.steps.includes('event_received')).length

    for (const flow of inboundNoRevenue) {
      const lastStep = flow.steps[flow.steps.length - 1] ?? 'unknown'
      const key = `${flow.steps[0] ?? 'event_received'} → ${lastStep} → no_conversion`
      dropOffMap.set(key, (dropOffMap.get(key) ?? 0) + 1)
    }

    const avgDealValueEur = 250_000 // Agency Group average deal proxy

    for (const [stepLabel, dropCount] of dropOffMap.entries()) {
      const dropOffRate = totalWithInbound > 0 ? dropCount / totalWithInbound : 0
      const estimatedLossEur = Math.round(dropCount * avgDealValueEur * 0.05) // 5% commission proxy

      let recommendation = `Investigate drop-offs at '${stepLabel}'.`
      if (stepLabel.includes('whatsapp')) {
        recommendation = `Automate WhatsApp follow-up within 2 hours to recover ${dropCount} stalled leads.`
      } else if (stepLabel.includes('email')) {
        recommendation = `Add email sequence automation for leads stuck at '${stepLabel}'.`
      } else if (stepLabel.includes('crm')) {
        recommendation = `Review CRM mutation failures at '${stepLabel}' — potential data pipeline issue.`
      }

      dropOffPoints.push({
        step: stepLabel,
        dropOffRate,
        estimatedLossEur,
        recommendation,
      })
    }

    dropOffPoints.sort((a, b) => b.estimatedLossEur - a.estimatedLossEur)

    // ── Quick wins ──────────────────────────────────────────────────────────

    const quickWins: string[] = []

    if (topFlows.length > 0 && topFlows[0].conversionRate > 0.3) {
      quickWins.push(
        `Scale the top-converting flow '${topFlows[0].name.substring(0, 80)}' (${(topFlows[0].conversionRate * 100).toFixed(0)}% conversion rate).`,
      )
    }

    if (dropOffPoints.length > 0) {
      quickWins.push(dropOffPoints[0].recommendation)
    }

    const decliningFlows = topFlows.filter((f) => f.trend === 'declining')
    if (decliningFlows.length > 0) {
      quickWins.push(
        `Investigate declining flow '${decliningFlows[0].name.substring(0, 80)}' — conversion rate is falling.`,
      )
    }

    // Pad to 3 if needed
    if (quickWins.length < 3) {
      quickWins.push('Increase causal_trace coverage to all inbound channels for richer analysis.')
    }
    if (quickWins.length < 3) {
      quickWins.push('Add revenue_outcome steps to all deal closure events for accurate attribution.')
    }

    const totalOptimizableRevenueEur = dropOffPoints.reduce(
      (sum, d) => sum + d.estimatedLossEur,
      0,
    )

    return {
      tenant_id: tenantId,
      generated_at: new Date().toISOString(),
      topFlows,
      dropOffPoints,
      quickWins: quickWins.slice(0, 3),
      totalOptimizableRevenueEur,
    }
  } catch (err) {
    console.warn('[conversion-optimizer] analyzeConversionFlows unexpected error:', err)
    return emptyReport
  }
}

// ─── getTopPerformingAgents ───────────────────────────────────────────────────

/**
 * Queries ai_feedback joining with downstream revenue data for the tenant.
 * Ranks agents by avgRevenuePerDecision DESC.
 * Fails open — returns [] on error.
 */
export async function getTopPerformingAgents(
  tenantId: string,
): Promise<
  Array<{
    agentId: string
    avgRevenuePerDecision: number
    conversionRate: number
    totalDecisions: number
    rank: number
  }>
> {
  const client = getClient()
  if (!client) {
    console.warn('[conversion-optimizer] Supabase not configured — skipping getTopPerformingAgents')
    return []
  }

  try {
    const { data, error } = await client
      .from('ai_feedback')
      .select('agent_id, revenue_outcome, success_score')
      .eq('tenant_id', tenantId)
      .not('agent_id', 'is', null)
      .limit(2000)

    if (error) {
      console.warn('[conversion-optimizer] getTopPerformingAgents query error:', error.message)
      return []
    }

    if (!data || data.length === 0) return []

    type Row = {
      agent_id: string
      revenue_outcome: number | null
      success_score: number | null
    }

    // Aggregate per agent
    const agentMap = new Map<
      string,
      { totalRevenue: number; totalDecisions: number; convertedCount: number }
    >()

    for (const row of data as Row[]) {
      const agentId = row.agent_id
      if (!agentMap.has(agentId)) {
        agentMap.set(agentId, { totalRevenue: 0, totalDecisions: 0, convertedCount: 0 })
      }
      const agg = agentMap.get(agentId)!
      agg.totalDecisions++
      agg.totalRevenue += row.revenue_outcome ?? 0

      // Consider "converted" if revenue_outcome > 0 or success_score >= 0.8
      if ((row.revenue_outcome ?? 0) > 0 || (row.success_score ?? 0) >= 0.8) {
        agg.convertedCount++
      }
    }

    const results = Array.from(agentMap.entries()).map(([agentId, agg]) => ({
      agentId,
      avgRevenuePerDecision:
        agg.totalDecisions > 0 ? agg.totalRevenue / agg.totalDecisions : 0,
      conversionRate:
        agg.totalDecisions > 0 ? agg.convertedCount / agg.totalDecisions : 0,
      totalDecisions: agg.totalDecisions,
      rank: 0, // filled below
    }))

    // Sort by avgRevenuePerDecision DESC, assign rank
    results.sort((a, b) => b.avgRevenuePerDecision - a.avgRevenuePerDecision)
    results.forEach((r, i) => {
      r.rank = i + 1
    })

    return results
  } catch (err) {
    console.warn('[conversion-optimizer] getTopPerformingAgents unexpected error:', err)
    return []
  }
}
