// AGENCY GROUP — SH-ROS Ω∞∞ Economics: economicBenchmarks | AMI: 22506
// Org-level and workflow-level economic benchmarks
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import logger from '@/lib/logger'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseAdmin as any

export interface OrgEconomicBenchmark {
  org_id: string
  period_days: number
  total_pipeline_eur: number
  total_closed_eur: number
  close_rate: number
  avg_deal_size_eur: number
  avg_days_to_close: number
  revenue_per_active_deal_eur: number
  pipeline_velocity_eur_per_day: number
  efficiency_score: number         // 0–100
  benchmark_vs_market: 'above' | 'at' | 'below'
  market_avg_close_rate: number    // Portugal 2026 benchmark
  market_avg_days_to_close: number
}

export interface ExecutionValueBenchmark {
  org_id: string
  period_days: number
  avg_ev_score: number
  median_ev_score: number
  p90_ev_score: number
  ev_accuracy_rate: number   // % of high-EV events that actually closed
  ev_calibration_drift: number
  recommendation: string
}

// Portugal 2026 market benchmarks
const MARKET = {
  avg_close_rate: 0.18,      // 18% of active leads close
  avg_days_to_close: 210,    // 210 days median
  avg_deal_size_eur: 320_000,
}

export class EconomicBenchmarkEngine {
  async benchmarkOrg(
    org_id: string,
    period_days = 90
  ): Promise<OrgEconomicBenchmark> {
    const from = new Date(Date.now() - period_days * 86_400_000).toISOString()

    const { data, error } = await sb
      .from('deals')
      .select('value_eur, status, created_at, updated_at')
      .eq('org_id', org_id)
      .gte('created_at', from)
      .limit(1000)

    if (error) {
      logger.error('[EconomicBenchmarks] Query failed', { error, org_id })
      return this._emptyBenchmark(org_id, period_days)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allDeals: any[] = data ?? []
    const wonDeals = allDeals.filter((d: any) => d.status === 'closed_won')

    const total_pipeline_eur = allDeals.reduce((s: number, d: any) =>
      s + ((d.value_eur as number) ?? 0), 0)
    const total_closed_eur = wonDeals.reduce((s: number, d: any) =>
      s + ((d.value_eur as number) ?? 0), 0)
    const close_rate = allDeals.length > 0 ? wonDeals.length / allDeals.length : 0
    const avg_deal_size_eur = wonDeals.length > 0 ? total_closed_eur / wonDeals.length : 0
    const avg_days_to_close = wonDeals.length > 0
      ? wonDeals.reduce((s: number, d: any) => {
          const diff = new Date(d.updated_at as string).getTime() -
            new Date(d.created_at as string).getTime()
          return s + diff / 86_400_000
        }, 0) / wonDeals.length
      : 0
    const revenue_per_active_deal_eur = allDeals.length > 0 ? total_pipeline_eur / allDeals.length : 0
    const pipeline_velocity_eur_per_day = period_days > 0 ? total_closed_eur / period_days : 0

    // Efficiency score
    const close_score = Math.min(100, (close_rate / MARKET.avg_close_rate) * 50)
    const speed_score = avg_days_to_close > 0
      ? Math.min(50, (MARKET.avg_days_to_close / avg_days_to_close) * 50)
      : 25
    const efficiency_score = Math.round(close_score + speed_score)

    const benchmark_vs_market: OrgEconomicBenchmark['benchmark_vs_market'] =
      close_rate > MARKET.avg_close_rate * 1.1 ? 'above'
      : close_rate < MARKET.avg_close_rate * 0.9 ? 'below'
      : 'at'

    return {
      org_id, period_days,
      total_pipeline_eur: Math.round(total_pipeline_eur * 100) / 100,
      total_closed_eur: Math.round(total_closed_eur * 100) / 100,
      close_rate: Math.round(close_rate * 1000) / 10,
      avg_deal_size_eur: Math.round(avg_deal_size_eur * 100) / 100,
      avg_days_to_close: Math.round(avg_days_to_close * 10) / 10,
      revenue_per_active_deal_eur: Math.round(revenue_per_active_deal_eur * 100) / 100,
      pipeline_velocity_eur_per_day: Math.round(pipeline_velocity_eur_per_day * 100) / 100,
      efficiency_score,
      benchmark_vs_market,
      market_avg_close_rate: MARKET.avg_close_rate,
      market_avg_days_to_close: MARKET.avg_days_to_close,
    }
  }

  async benchmarkExecutionValue(
    org_id: string,
    period_days = 30
  ): Promise<ExecutionValueBenchmark> {
    const from = new Date(Date.now() - period_days * 86_400_000).toISOString()

    const { data } = await sb
      .from('learning_events')
      .select('metadata')
      .eq('org_id', org_id)
      .eq('event_type', 'ev_computed')
      .gte('created_at', from)
      .limit(1000)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const evArr: any[] = data ?? []
    const scores = evArr
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((e: any) => ((e.metadata as Record<string, unknown>)?.['ev_score'] as number) ?? 0)
      .filter((v) => v > 0)
      .sort((a, b) => a - b)

    const avg_ev_score = scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : 0
    const median_ev_score = scores.length > 0 ? scores[Math.floor(scores.length / 2)] : 0
    const p90_ev_score = scores.length > 0 ? scores[Math.floor(scores.length * 0.9)] : 0

    // EV accuracy: high-EV (>0.7) events that resulted in closed_won
    const highEV = evArr.filter((e: any) =>
      ((e.metadata as Record<string, unknown>)?.['ev_score'] as number ?? 0) > 0.7
    )
    const highEVWithClose = highEV.filter((e: any) =>
      (e.metadata as Record<string, unknown>)?.['outcome'] === 'closed_won'
    )
    const ev_accuracy_rate = highEV.length > 0
      ? Math.round((highEVWithClose.length / highEV.length) * 1000) / 10
      : 0

    const recommendation = ev_accuracy_rate >= 70
      ? 'EV model performing well — maintain current weights'
      : ev_accuracy_rate >= 50
        ? 'EV model needs recalibration — consider weight adjustment'
        : 'EV model significantly miscalibrated — trigger learning reset'

    return {
      org_id, period_days,
      avg_ev_score: Math.round(avg_ev_score * 1000) / 1000,
      median_ev_score: Math.round(median_ev_score * 1000) / 1000,
      p90_ev_score: Math.round(p90_ev_score * 1000) / 1000,
      ev_accuracy_rate,
      ev_calibration_drift: Math.abs(avg_ev_score - median_ev_score),
      recommendation,
    }
  }

  private _emptyBenchmark(org_id: string, period_days: number): OrgEconomicBenchmark {
    return { org_id, period_days, total_pipeline_eur: 0, total_closed_eur: 0, close_rate: 0,
      avg_deal_size_eur: 0, avg_days_to_close: 0, revenue_per_active_deal_eur: 0,
      pipeline_velocity_eur_per_day: 0, efficiency_score: 0, benchmark_vs_market: 'below',
      market_avg_close_rate: MARKET.avg_close_rate, market_avg_days_to_close: MARKET.avg_days_to_close }
  }
}

export const economicBenchmarkEngine = new EconomicBenchmarkEngine()
