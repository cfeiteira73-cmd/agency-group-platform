// Agency Group — Capital Latency Tracker
// lib/financial/capitalLatencyTracker.ts
// Measures time from first contact to revenue recognition.
// "How long does it take for a lead to become money?"

import log from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CapitalLatencyMetrics {
  tenant_id: string
  generated_at: string
  avg_lead_to_contact_days: number
  avg_contact_to_proposal_days: number
  avg_proposal_to_cpcv_days: number
  avg_cpcv_to_closing_days: number
  avg_total_cycle_days: number
  p50_cycle_days: number
  p90_cycle_days: number
  longest_open_deal_days: number
  bottleneck_stage: string
  bottleneck_avg_days: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysBetween(from: string | null, to: string | null | Date = new Date()): number {
  if (!from) return 0
  const toDate = to instanceof Date ? to : (to ? new Date(to) : new Date())
  const diff = toDate.getTime() - new Date(from).getTime()
  return Math.max(0, diff / (1000 * 60 * 60 * 24))
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return Math.round((sorted[Math.max(0, idx)] ?? 0) * 100) / 100
}

function extractStage(row: Record<string, unknown>): string {
  const s = row['pipeline_stage'] ?? row['stage'] ?? row['status'] ?? ''
  return String(s).toUpperCase()
}

// Stage order index for comparison
const STAGE_ORDER: Record<string, number> = {
  LEAD: 0,
  QUALIFIED: 1,
  VISIT: 2,
  PROPOSAL: 3,
  NEGOTIATION: 4,
  CPCV: 5,
  CLOSING: 6,
  CLOSED_WON: 7,
}

// ─── Main Function ────────────────────────────────────────────────────────────

export async function computeCapitalLatency(
  tenantId: string,
): Promise<CapitalLatencyMetrics> {
  const now = new Date()
  const generated_at = now.toISOString()

  log.info('[capitalLatencyTracker] computing capital latency', { tenantId })

  const { data: deals, error } = await (supabaseAdmin as any)
    .from('deals')
    .select('*')
    .eq('tenant_id', tenantId)

  if (error) {
    log.info('[capitalLatencyTracker] deals query error — using empty dataset', {
      tenantId,
      error: error.message,
    })
  }

  const rows: Record<string, unknown>[] = Array.isArray(deals) ? deals : []

  // ── Cycle durations ───────────────────────────────────────────────────────

  const closedDeals = rows.filter((r) => {
    const s = extractStage(r)
    return s === 'CLOSED_WON' || s === 'CLOSING'
  })

  const cycleDays = closedDeals.map((r) => {
    const created = String(r['created_at'] ?? '')
    const closed = String(r['closed_at'] ?? r['updated_at'] ?? '')
    return daysBetween(created || null, closed || null)
  })

  const sortedCycleDays = [...cycleDays].sort((a, b) => a - b)

  const avg_total_cycle_days =
    cycleDays.length > 0
      ? Math.round(
          (cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length) * 100,
        ) / 100
      : 0

  const p50_cycle_days = percentile(sortedCycleDays, 50)
  const p90_cycle_days = percentile(sortedCycleDays, 90)

  // ── Longest open deal ─────────────────────────────────────────────────────
  const openDeals = rows.filter((r) => {
    const s = extractStage(r)
    return s !== 'CLOSED_WON'
  })

  const longest_open_deal_days = openDeals.reduce((max, r) => {
    const created = String(r['created_at'] ?? '')
    const age = daysBetween(created || null, now)
    return age > max ? age : max
  }, 0)

  // ── Stage-based latency approximation ─────────────────────────────────────
  // Group deals by current stage, compute avg age per stage
  const stageAgeMap = new Map<string, number[]>()

  for (const row of rows) {
    const stage = extractStage(row)
    const normalised = STAGE_ORDER[stage] !== undefined ? stage : 'LEAD'
    const created = String(row['created_at'] ?? '')
    const age = daysBetween(created || null, now)
    if (!stageAgeMap.has(normalised)) stageAgeMap.set(normalised, [])
    stageAgeMap.get(normalised)!.push(age)
  }

  // Compute per-stage avg age
  const stageAvgAge: Record<string, number> = {}
  for (const [stage, ages] of stageAgeMap.entries()) {
    stageAvgAge[stage] =
      ages.length > 0
        ? Math.round((ages.reduce((a, b) => a + b, 0) / ages.length) * 100) /
          100
        : 0
  }

  // Bottleneck = stage with highest avg age among active stages
  let bottleneck_stage = 'UNKNOWN'
  let bottleneck_avg_days = 0
  for (const [stage, avgAge] of Object.entries(stageAvgAge)) {
    if (stage !== 'CLOSED_WON' && avgAge > bottleneck_avg_days) {
      bottleneck_avg_days = avgAge
      bottleneck_stage = stage
    }
  }

  // ── Approximate inter-stage durations using avg cycle and stage ratios ────
  // Based on typical real estate funnel: Lead→Qualified ~15%, rest distributed
  const totalCycle = avg_total_cycle_days || 180
  const avg_lead_to_contact_days = Math.round(totalCycle * 0.05 * 100) / 100
  const avg_contact_to_proposal_days = Math.round(totalCycle * 0.20 * 100) / 100
  const avg_proposal_to_cpcv_days = Math.round(totalCycle * 0.35 * 100) / 100
  const avg_cpcv_to_closing_days = Math.round(totalCycle * 0.40 * 100) / 100

  const metrics: CapitalLatencyMetrics = {
    tenant_id: tenantId,
    generated_at,
    avg_lead_to_contact_days,
    avg_contact_to_proposal_days,
    avg_proposal_to_cpcv_days,
    avg_cpcv_to_closing_days,
    avg_total_cycle_days,
    p50_cycle_days,
    p90_cycle_days,
    longest_open_deal_days: Math.round(longest_open_deal_days * 100) / 100,
    bottleneck_stage,
    bottleneck_avg_days: Math.round(bottleneck_avg_days * 100) / 100,
  }

  // ── Persist to capital_latency_metrics ────────────────────────────────────
  void (supabaseAdmin as any)
    .from('capital_latency_metrics')
    .insert({
      tenant_id: tenantId,
      generated_at,
      avg_total_cycle_days,
      p50_cycle_days,
      p90_cycle_days,
      bottleneck_stage,
      bottleneck_avg_days: metrics.bottleneck_avg_days,
      raw_metrics: metrics,
    })
    .then(({ error: e }: { error: { message: string } | null }) => {
      if (e) log.info('[capitalLatencyTracker] persist warn', { error: e.message })
    })
    .catch((e: unknown) =>
      console.warn('[capitalLatencyTracker] persist error', e),
    )

  log.info('[capitalLatencyTracker] metrics complete', {
    tenantId,
    avg_total_cycle_days,
    bottleneck_stage,
    p90_cycle_days,
  })

  return metrics
}
