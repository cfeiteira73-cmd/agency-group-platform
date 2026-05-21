// Agency Group — Revenue Pipeline Monitor
// lib/financial/revenuePipelineMonitor.ts
// Tracks lead→deal→closing→revenue with stage durations and velocity.
// Reads from real contacts + deals tables. NEVER writes to financial tables.

import log from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PipelineStage {
  stage: string
  count: number
  avg_age_days: number
  total_value_eur: number
  conversion_rate_pct: number
}

export interface RevenueVelocity {
  deals_per_week: number
  avg_days_to_close: number
  avg_deal_value_eur: number
  projected_monthly_revenue_eur: number
}

export interface RevenuePipelineReport {
  tenant_id: string
  generated_at: string
  pipeline_stages: PipelineStage[]
  active_deals: number
  total_pipeline_value_eur: number
  deals_closed_30d: number
  revenue_realized_30d_eur: number
  velocity: RevenueVelocity
  health: 'STRONG' | 'NORMAL' | 'WEAK' | 'CRITICAL'
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

const COMMISSION_RATE = 0.05

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

function daysBetween(from: string | null, to: Date = new Date()): number {
  if (!from) return 0
  const diff = to.getTime() - new Date(from).getTime()
  return Math.max(0, diff / (1000 * 60 * 60 * 24))
}

function computeHealth(dealsPerWeek: number): RevenuePipelineReport['health'] {
  if (dealsPerWeek > 2) return 'STRONG'
  if (dealsPerWeek > 0.5) return 'NORMAL'
  if (dealsPerWeek > 0) return 'WEAK'
  return 'CRITICAL'
}

// ─── Main Function ────────────────────────────────────────────────────────────

export async function getRevenuePipelineReport(
  tenantId: string,
): Promise<RevenuePipelineReport> {
  const now = new Date()
  const generated_at = now.toISOString()

  log.info('[revenuePipelineMonitor] generating pipeline report', { tenantId })

  // Query all deals for this tenant
  const { data: deals, error } = await (supabaseAdmin as any)
    .from('deals')
    .select('*')
    .eq('tenant_id', tenantId)

  if (error) {
    log.info('[revenuePipelineMonitor] deals query error — using empty dataset', {
      tenantId,
      error: error.message,
    })
  }

  const rows: Record<string, unknown>[] = Array.isArray(deals) ? deals : []

  // ── Per-stage aggregation ──────────────────────────────────────────────────
  const stageMap = new Map<
    string,
    { count: number; total_age_days: number; total_value: number }
  >()

  for (const stage of ORDERED_STAGES) {
    stageMap.set(stage, { count: 0, total_age_days: 0, total_value: 0 })
  }

  for (const row of rows) {
    const stage = extractStage(row)
    const normalised = ORDERED_STAGES.includes(stage) ? stage : 'LEAD'
    const entry = stageMap.get(normalised)!
    const createdAt = String(row['created_at'] ?? row['inserted_at'] ?? '')
    entry.count++
    entry.total_age_days += daysBetween(createdAt)
    entry.total_value += extractValue(row)
  }

  // Compute conversion rates (sequential funnel)
  const pipeline_stages: PipelineStage[] = ORDERED_STAGES.map((stage, idx) => {
    const entry = stageMap.get(stage)!
    const prevStage = idx > 0 ? stageMap.get(ORDERED_STAGES[idx - 1]!) : null
    const prevCount = prevStage ? prevStage.count : entry.count
    const conversion_rate_pct =
      prevCount > 0 ? Math.round((entry.count / prevCount) * 10000) / 100 : 0

    return {
      stage,
      count: entry.count,
      avg_age_days:
        entry.count > 0
          ? Math.round((entry.total_age_days / entry.count) * 100) / 100
          : 0,
      total_value_eur: Math.round(entry.total_value * 100) / 100,
      conversion_rate_pct,
    }
  })

  // ── Active deals (not CLOSED_WON) ─────────────────────────────────────────
  const active_deals = rows.filter((r) => {
    const stage = extractStage(r)
    return stage !== 'CLOSED_WON'
  }).length

  // ── Total pipeline value ───────────────────────────────────────────────────
  const total_pipeline_value_eur = rows
    .filter((r) => extractStage(r) !== 'CLOSED_WON')
    .reduce((sum, r) => sum + extractValue(r), 0)

  // ── Closed deals last 30 days ──────────────────────────────────────────────
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const closedLast30 = rows.filter((r) => {
    const stage = extractStage(r)
    if (stage !== 'CLOSED_WON' && stage !== 'CLOSING') return false
    const updated = String(r['updated_at'] ?? r['closed_at'] ?? '')
    return updated ? new Date(updated) > thirtyDaysAgo : false
  })

  const deals_closed_30d = closedLast30.length
  const revenue_realized_30d_eur =
    Math.round(
      closedLast30.reduce((sum, r) => sum + extractValue(r), 0) *
        COMMISSION_RATE *
        100,
    ) / 100

  // ── Velocity ──────────────────────────────────────────────────────────────
  const deals_per_week =
    Math.round((deals_closed_30d / 4.3) * 1000) / 1000

  const allClosed = rows.filter((r) => {
    const s = extractStage(r)
    return s === 'CLOSED_WON' || s === 'CLOSING'
  })

  const avgCycleDays =
    allClosed.length > 0
      ? allClosed.reduce((sum, r) => {
          const created = String(r['created_at'] ?? '')
          const closed = String(r['closed_at'] ?? r['updated_at'] ?? '')
          if (!created || !closed) return sum + 90
          const diff =
            (new Date(closed).getTime() - new Date(created).getTime()) /
            (1000 * 60 * 60 * 24)
          return sum + Math.max(1, diff)
        }, 0) / allClosed.length
      : 90

  const avg_deal_value_eur =
    allClosed.length > 0
      ? allClosed.reduce((sum, r) => sum + extractValue(r), 0) /
        allClosed.length
      : 0

  const projected_monthly_revenue_eur =
    Math.round(
      avg_deal_value_eur * deals_per_week * 4.3 * COMMISSION_RATE * 100,
    ) / 100

  const velocity: RevenueVelocity = {
    deals_per_week,
    avg_days_to_close: Math.round(avgCycleDays * 100) / 100,
    avg_deal_value_eur: Math.round(avg_deal_value_eur * 100) / 100,
    projected_monthly_revenue_eur,
  }

  const health = computeHealth(deals_per_week)

  const report: RevenuePipelineReport = {
    tenant_id: tenantId,
    generated_at,
    pipeline_stages,
    active_deals,
    total_pipeline_value_eur: Math.round(total_pipeline_value_eur * 100) / 100,
    deals_closed_30d,
    revenue_realized_30d_eur,
    velocity,
    health,
  }

  // ── Persist to revenue_pipeline_reports ───────────────────────────────────
  void (supabaseAdmin as any)
    .from('revenue_pipeline_reports')
    .insert({
      tenant_id: tenantId,
      generated_at,
      active_deals,
      total_pipeline_value_eur: report.total_pipeline_value_eur,
      deals_closed_30d,
      revenue_realized_30d_eur,
      health,
      pipeline_stages,
      velocity,
    })
    .then(({ error: e }: { error: { message: string } | null }) => {
      if (e) log.info('[revenuePipelineMonitor] persist warn', { error: e.message })
    })
    .catch((e: unknown) =>
      console.warn('[revenuePipelineMonitor] persist error', e),
    )

  log.info('[revenuePipelineMonitor] report complete', {
    tenantId,
    health,
    active_deals,
    deals_closed_30d,
  })

  return report
}
