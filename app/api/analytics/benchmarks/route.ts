// GET /api/analytics/benchmarks — system vs baseline uplift report

import { NextRequest, NextResponse }   from 'next/server'
import { getAdminRole, hasPermission } from '@/lib/auth/adminAuth'
import { supabaseAdmin }               from '@/lib/supabase'
import {
  computeBaselineAccuracy,
  computeSystemAccuracy,
  computeUplift,
  computeConversionUplift,
  computeSpeedUplift,
  computeRoutingUplift,
  buildBenchmarkReport,
  computeStatisticalSignificance,
} from '@/lib/intelligence/benchmarkEngine'
import type { BenchmarkComparison } from '@/lib/intelligence/benchmarkEngine'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const user = await getAdminRole(req.headers.get('authorization')?.replace('Bearer ', '') ?? '')
  if (!user || !hasPermission(user.role, 'analytics:read')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') ?? '90d'
  const limit  = Number(searchParams.get('limit') ?? '200')

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabaseAdmin as any

    const { data: outcomes, error: outErr } = await sb
      .from('transaction_outcomes')
      .select('score_at_time, final_sale_price, asking_price, negotiation_duration_days, distribution_event_id')
      .not('final_sale_price', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (outErr) throw new Error(outErr.message)

    type OutcomeRow = {
      score_at_time:              number | null
      final_sale_price:           number
      asking_price:               number | null
      negotiation_duration_days:  number | null
      distribution_event_id:      string | null
    }
    const rows: OutcomeRow[] = outcomes ?? []

    if (rows.length === 0) {
      return NextResponse.json({ message: 'No outcome data available yet', period })
    }

    // AVM accuracy benchmark
    const scoredRows   = rows.filter(r => r.score_at_time != null)
    const systemScores = scoredRows.map(r => r.score_at_time!)
    const finalPrices  = scoredRows.map(r => r.final_sale_price)
    const baselineAcc  = computeBaselineAccuracy(finalPrices)
    const systemAcc    = computeSystemAccuracy(systemScores, finalPrices)
    const avmUplift    = computeUplift(baselineAcc.mae, systemAcc.mae, true)
    const avmSignif    = computeStatisticalSignificance(
      Array(scoredRows.length).fill(baselineAcc.mae),
      scoredRows.map((_, i) => Math.abs(systemScores[i] - finalPrices[i])),
    )

    // Speed benchmark
    const systemDays   = rows.filter(r => r.negotiation_duration_days != null).map(r => r.negotiation_duration_days!)
    const marketAvgDays = 90
    const avgSystemDays = systemDays.length > 0
      ? systemDays.reduce((a, b) => a + b, 0) / systemDays.length
      : marketAvgDays
    const speedUplift  = computeSpeedUplift(marketAvgDays, avgSystemDays)

    // Routing precision
    const { data: distData } = await sb
      .from('distribution_outcomes')
      .select('converted, response_received')
      .limit(limit)
    const distRows         = distData ?? []
    const systemPrecision  = distRows.length > 0
      ? distRows.filter((r: { converted: boolean }) => r.converted).length / distRows.length
      : 0
    const baselinePrecision = 0.02
    const routingUplift    = computeRoutingUplift(baselinePrecision, systemPrecision)
    const conversionUplift = computeConversionUplift(2, systemPrecision * 100)

    const comparisons: BenchmarkComparison[] = [
      {
        dimension:      'AVM Accuracy (MAE)',
        baseline:       'naive_mean_predictor',
        baseline_value: baselineAcc.mae,
        system_value:   systemAcc.mae,
        uplift_pct:     avmUplift.relative_uplift_pct,
        is_significant: avmSignif.is_significant,
        sample_size:    scoredRows.length,
      },
      {
        dimension:      'Time to Close (days)',
        baseline:       'market_average',
        baseline_value: marketAvgDays,
        system_value:   Math.round(avgSystemDays),
        uplift_pct:     speedUplift.relative_uplift_pct,
        is_significant: speedUplift.is_significant,
        sample_size:    systemDays.length,
      },
      {
        dimension:      'Routing Precision',
        baseline:       'broadcast_random',
        baseline_value: baselinePrecision * 100,
        system_value:   Math.round(systemPrecision * 100 * 100) / 100,
        uplift_pct:     routingUplift.relative_uplift_pct,
        is_significant: routingUplift.is_significant,
        sample_size:    distRows.length,
      },
      {
        dimension:      'Conversion Rate',
        baseline:       'random_distribution',
        baseline_value: 2,
        system_value:   Math.round(systemPrecision * 100 * 100) / 100,
        uplift_pct:     conversionUplift.relative_uplift_pct,
        is_significant: conversionUplift.is_significant,
        sample_size:    distRows.length,
      },
    ]

    const report = buildBenchmarkReport(period, rows.length, comparisons)
    return NextResponse.json({ report })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
