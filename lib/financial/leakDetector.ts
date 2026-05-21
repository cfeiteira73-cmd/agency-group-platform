// Agency Group — Revenue Leak Detector
// lib/financial/leakDetector.ts
// Identifies conversion drop points in the funnel.
// "Where are we losing deals and money?"

import log from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FunnelDropPoint {
  from_stage: string
  to_stage: string
  entries: number
  exits_without_progression: number
  drop_rate_pct: number
  estimated_value_lost_eur: number
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
}

export interface LeakReport {
  tenant_id: string
  generated_at: string
  drop_points: FunnelDropPoint[]
  total_estimated_leakage_eur: number
  worst_drop_stage: string
  overall_funnel_efficiency_pct: number
  recommendations: string[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ORDERED_STAGES = [
  'LEAD',
  'QUALIFIED',
  'VISIT',
  'PROPOSAL',
  'NEGOTIATION',
  'CPCV',
  'CLOSING',
  'CLOSED_WON',
]

const STAGE_INDEX: Record<string, number> = Object.fromEntries(
  ORDERED_STAGES.map((s, i) => [s, i]),
)

const COMMISSION_RATE = 0.05
const STALE_THRESHOLD_DAYS = 30

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractValue(row: Record<string, unknown>): number {
  const candidates = ['valor', 'price', 'value', 'amount', 'deal_value']
  for (const key of candidates) {
    const v = row[key]
    if (v !== null && v !== undefined && !isNaN(Number(v))) {
      return Number(v)
    }
  }
  return 0
}

function extractStage(row: Record<string, unknown>): string {
  const s = row['pipeline_stage'] ?? row['stage'] ?? row['status'] ?? ''
  return String(s).toUpperCase()
}

function stageIndex(stage: string): number {
  return STAGE_INDEX[stage] ?? -1
}

function daysSinceUpdate(row: Record<string, unknown>): number {
  const updated = String(row['updated_at'] ?? row['stage_updated_at'] ?? row['created_at'] ?? '')
  if (!updated) return 0
  const diff = Date.now() - new Date(updated).getTime()
  return Math.max(0, diff / (1000 * 60 * 60 * 24))
}

function classifySeverity(dropRate: number): FunnelDropPoint['severity'] {
  if (dropRate > 60) return 'CRITICAL'
  if (dropRate > 40) return 'HIGH'
  if (dropRate > 20) return 'MEDIUM'
  return 'LOW'
}

// ─── Main Function ────────────────────────────────────────────────────────────

export async function detectRevenueLeak(
  tenantId: string,
): Promise<LeakReport> {
  const generated_at = new Date().toISOString()

  log.info('[leakDetector] detecting revenue leaks', { tenantId })

  const { data: deals, error } = await (supabaseAdmin as any)
    .from('deals')
    .select('*')
    .eq('tenant_id', tenantId)

  if (error) {
    log.info('[leakDetector] deals query error — using empty dataset', {
      tenantId,
      error: error.message,
    })
  }

  const rows: Record<string, unknown>[] = Array.isArray(deals) ? deals : []

  // ── Build drop points for each consecutive stage pair ─────────────────────
  const drop_points: FunnelDropPoint[] = []
  let worst_drop_stage = 'UNKNOWN'
  let worst_drop_rate = 0

  for (let i = 0; i < ORDERED_STAGES.length - 1; i++) {
    const fromStage = ORDERED_STAGES[i]!
    const toStage = ORDERED_STAGES[i + 1]!

    // Entries = deals that reached or passed fromStage
    const entries = rows.filter((r) => {
      const idx = stageIndex(extractStage(r))
      return idx >= stageIndex(fromStage)
    })

    // Exits without progression = stuck in fromStage > STALE_THRESHOLD_DAYS
    const stuckInFromStage = rows.filter((r) => {
      const stage = extractStage(r)
      return (
        stage === fromStage &&
        daysSinceUpdate(r) > STALE_THRESHOLD_DAYS
      )
    })

    const entryCount = entries.length
    const stuckCount = stuckInFromStage.length

    const drop_rate_pct =
      entryCount > 0
        ? Math.round((stuckCount / entryCount) * 10000) / 100
        : 0

    const avgValue =
      stuckCount > 0
        ? stuckInFromStage.reduce((s, r) => s + extractValue(r), 0) /
          stuckCount
        : 0

    const estimated_value_lost_eur =
      Math.round(avgValue * stuckCount * COMMISSION_RATE * drop_rate_pct / 100 * 100) / 100

    const severity = classifySeverity(drop_rate_pct)

    if (drop_rate_pct > worst_drop_rate) {
      worst_drop_rate = drop_rate_pct
      worst_drop_stage = fromStage
    }

    drop_points.push({
      from_stage: fromStage,
      to_stage: toStage,
      entries: entryCount,
      exits_without_progression: stuckCount,
      drop_rate_pct,
      estimated_value_lost_eur,
      severity,
    })
  }

  // ── Totals ────────────────────────────────────────────────────────────────
  const total_estimated_leakage_eur =
    Math.round(
      drop_points.reduce((s, p) => s + p.estimated_value_lost_eur, 0) * 100,
    ) / 100

  // Overall funnel efficiency: % of leads that made it to CLOSED_WON
  const totalLeads = rows.filter(
    (r) => stageIndex(extractStage(r)) >= 0,
  ).length
  const closedWon = rows.filter(
    (r) => extractStage(r) === 'CLOSED_WON',
  ).length
  const overall_funnel_efficiency_pct =
    totalLeads > 0
      ? Math.round((closedWon / totalLeads) * 10000) / 100
      : 0

  // ── Recommendations ───────────────────────────────────────────────────────
  const recommendations: string[] = []
  for (const dp of drop_points) {
    if (dp.severity === 'CRITICAL' || dp.severity === 'HIGH') {
      recommendations.push(
        `Review ${dp.from_stage}→${dp.to_stage} handoff process. ${dp.exits_without_progression} deals potentially stalled.`,
      )
    }
  }
  if (recommendations.length === 0) {
    recommendations.push('Funnel health is acceptable. Monitor weekly for stage stagnation.')
  }

  const report: LeakReport = {
    tenant_id: tenantId,
    generated_at,
    drop_points,
    total_estimated_leakage_eur,
    worst_drop_stage,
    overall_funnel_efficiency_pct,
    recommendations,
  }

  // ── Persist to leak_reports ───────────────────────────────────────────────
  void (supabaseAdmin as any)
    .from('leak_reports')
    .insert({
      tenant_id: tenantId,
      generated_at,
      total_estimated_leakage_eur,
      worst_drop_stage,
      overall_funnel_efficiency_pct,
      drop_points,
      recommendations,
    })
    .then(({ error: e }: { error: { message: string } | null }) => {
      if (e) log.info('[leakDetector] persist warn', { error: e.message })
    })
    .catch((e: unknown) => console.warn('[leakDetector] persist error', e))

  log.info('[leakDetector] leak report complete', {
    tenantId,
    worst_drop_stage,
    total_estimated_leakage_eur,
    overall_funnel_efficiency_pct,
  })

  return report
}
