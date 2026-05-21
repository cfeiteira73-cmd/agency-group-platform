// Agency Group — Cashflow Forecaster
// lib/financial/cashflowForecaster.ts
// Pipeline × conversion rates × avg deal size → 90-day cashflow forecast.
// Based on EXECUTION REALITY (what we actually closed) not wishful thinking.

import log from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CashflowProjection {
  month_offset: number
  month_label: string
  projected_deals: number
  projected_revenue_eur: number
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  basis: string
}

export interface CashflowForecast {
  tenant_id: string
  generated_at: string
  forecast_horizon_days: number
  current_pipeline_value_eur: number
  historical_conversion_rate_pct: number
  historical_avg_cycle_days: number
  projections: CashflowProjection[]
  total_90d_projected_eur: number
  forecast_confidence: 'HIGH' | 'MEDIUM' | 'LOW'
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COMMISSION_RATE = 0.05
const FORECAST_HORIZON_DAYS = 90

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

function daysBetween(from: string | null, to: string | null): number {
  if (!from) return 0
  const toDate = to ? new Date(to) : new Date()
  const diff = toDate.getTime() - new Date(from).getTime()
  return Math.max(0, diff / (1000 * 60 * 60 * 24))
}

function monthLabel(baseDate: Date, offsetMonths: number): string {
  const d = new Date(baseDate)
  d.setMonth(d.getMonth() + offsetMonths)
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function confidenceLevel(historicalCount: number): CashflowProjection['confidence'] {
  if (historicalCount > 10) return 'HIGH'
  if (historicalCount > 3) return 'MEDIUM'
  return 'LOW'
}

// ─── Main Function ────────────────────────────────────────────────────────────

export async function forecastCashflow(tenantId: string): Promise<CashflowForecast> {
  const now = new Date()
  const generated_at = now.toISOString()

  log.info('[cashflowForecaster] starting cashflow forecast', { tenantId })

  // ── Historical deals (last 180 days) ──────────────────────────────────────
  const since180 = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString()

  const { data: historicalDeals, error: histError } = await (supabaseAdmin as any)
    .from('deals')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('created_at', since180)

  if (histError) {
    log.info('[cashflowForecaster] historical query error — using empty dataset', {
      tenantId,
      error: histError.message,
    })
  }

  const historical: Record<string, unknown>[] = Array.isArray(historicalDeals)
    ? historicalDeals
    : []

  // ── Closed deals in historical window ────────────────────────────────────
  const closedHistorical = historical.filter((r) => {
    const s = extractStage(r)
    return s === 'CLOSED_WON' || s === 'CLOSING'
  })

  const totalHistorical = historical.length
  const totalClosed = closedHistorical.length

  const historical_conversion_rate_pct =
    totalHistorical > 0
      ? Math.round((totalClosed / totalHistorical) * 10000) / 100
      : 0

  const avgCycleDays =
    totalClosed > 0
      ? closedHistorical.reduce((sum, r) => {
          const created = String(r['created_at'] ?? '')
          const closed = String(r['closed_at'] ?? r['updated_at'] ?? '')
          return sum + daysBetween(created || null, closed || null)
        }, 0) / totalClosed
      : 90

  const historical_avg_cycle_days = Math.round(avgCycleDays * 100) / 100

  const avgDealValue =
    totalClosed > 0
      ? closedHistorical.reduce((sum, r) => sum + extractValue(r), 0) / totalClosed
      : 0

  // ── Current open pipeline ─────────────────────────────────────────────────
  const { data: openDeals, error: openError } = await (supabaseAdmin as any)
    .from('deals')
    .select('*')
    .eq('tenant_id', tenantId)

  if (openError) {
    log.info('[cashflowForecaster] open deals query error', {
      tenantId,
      error: openError.message,
    })
  }

  const allDeals: Record<string, unknown>[] = Array.isArray(openDeals) ? openDeals : []
  const activePipeline = allDeals.filter((r) => {
    const s = extractStage(r)
    return s !== 'CLOSED_WON'
  })

  const current_pipeline_value_eur =
    Math.round(
      activePipeline.reduce((s, r) => s + extractValue(r), 0) * 100,
    ) / 100

  const pipelineDealCount = activePipeline.length

  // ── Monthly projections for next 3 months ────────────────────────────────
  const conversionRate = historical_conversion_rate_pct / 100
  const cycleDaysForCalc = Math.max(1, historical_avg_cycle_days)
  const confidence = confidenceLevel(totalClosed)
  const projections: CashflowProjection[] = []

  for (let monthOffset = 1; monthOffset <= 3; monthOffset++) {
    const monthDays = 30
    // How many of the current pipeline deals would close this month?
    // = pipeline_deals × conversion_rate × (month_days / avg_cycle_days)
    const projectedDeals =
      pipelineDealCount > 0
        ? Math.round(
            pipelineDealCount * conversionRate * (monthDays / cycleDaysForCalc) * 100,
          ) / 100
        : 0

    const projectedRevenue =
      Math.round(projectedDeals * avgDealValue * COMMISSION_RATE * 100) / 100

    const basisText =
      totalClosed > 0
        ? `Based on ${totalClosed} closed deals (${historical_conversion_rate_pct}% conv. rate, ${historical_avg_cycle_days}d avg cycle)`
        : 'Insufficient historical data — using market benchmarks'

    projections.push({
      month_offset: monthOffset,
      month_label: monthLabel(now, monthOffset),
      projected_deals: projectedDeals,
      projected_revenue_eur: projectedRevenue,
      confidence,
      basis: basisText,
    })
  }

  const total_90d_projected_eur =
    Math.round(
      projections.reduce((s, p) => s + p.projected_revenue_eur, 0) * 100,
    ) / 100

  const forecast: CashflowForecast = {
    tenant_id: tenantId,
    generated_at,
    forecast_horizon_days: FORECAST_HORIZON_DAYS,
    current_pipeline_value_eur,
    historical_conversion_rate_pct,
    historical_avg_cycle_days,
    projections,
    total_90d_projected_eur,
    forecast_confidence: confidence,
  }

  // ── Persist to cashflow_forecasts ─────────────────────────────────────────
  void (supabaseAdmin as any)
    .from('cashflow_forecasts')
    .insert({
      tenant_id: tenantId,
      generated_at,
      forecast_horizon_days: FORECAST_HORIZON_DAYS,
      current_pipeline_value_eur,
      historical_conversion_rate_pct,
      total_90d_projected_eur,
      forecast_confidence: confidence,
      projections,
    })
    .then(({ error: e }: { error: { message: string } | null }) => {
      if (e) log.info('[cashflowForecaster] persist warn', { error: e.message })
    })
    .catch((e: unknown) => console.warn('[cashflowForecaster] persist error', e))

  log.info('[cashflowForecaster] forecast complete', {
    tenantId,
    total_90d_projected_eur,
    confidence,
    historical_conversion_rate_pct,
    pipelineDealCount,
  })

  return forecast
}
