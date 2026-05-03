// POST /api/analytics/economic-truth — record a realized economic truth event
// GET  /api/analytics/economic-truth — query truth events + summary

import { NextRequest, NextResponse }   from 'next/server'
import { getAdminRole, hasPermission } from '@/lib/auth/adminAuth'
import { supabaseAdmin }               from '@/lib/supabase'
import {
  computeEconomicTruthScore,
  normalizeEconomicScore,
  persistEconomicTruth,
  getZoneMeanTruthScore,
  batchNormalizeTruth,
} from '@/lib/intelligence/economicTruth'
import type { EconomicTruthInputs } from '@/lib/intelligence/economicTruth'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const user = await getAdminRole(req.headers.get('authorization')?.replace('Bearer ', '') ?? '')
  if (!user || !hasPermission(user.role, 'analytics:read')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const zone       = searchParams.get('zone')
  const assetClass = searchParams.get('asset_class')
  const limit      = Number(searchParams.get('limit') ?? '50')
  const view       = searchParams.get('view') ?? 'list'

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabaseAdmin as any)
      .from('economic_truth_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (zone)       query = query.eq('zone_key', zone)
    if (assetClass) query = query.eq('asset_class', assetClass)

    const { data, error } = await query
    if (error) throw new Error(error.message)

    if (view === 'summary') {
      const events = data ?? []
      const avgScore = events.length > 0
        ? events.reduce((a: number, e: { raw_truth_score: number }) => a + (e.raw_truth_score ?? 0), 0) / events.length
        : 0
      const normEvents = events.filter((e: { normalized_truth_score: number | null }) => e.normalized_truth_score != null)
      const avgNorm    = normEvents.length > 0
        ? normEvents.reduce((a: number, e: { normalized_truth_score: number }) => a + e.normalized_truth_score, 0) / normEvents.length
        : 0
      return NextResponse.json({
        count:                 events.length,
        avg_raw_truth_score:   Math.round(avgScore * 10) / 10,
        avg_normalized_score:  Math.round(avgNorm  * 10) / 10,
        zones_covered:         [...new Set(events.map((e: { zone_key: string }) => e.zone_key))].length,
      })
    }

    return NextResponse.json({ events: data ?? [], count: (data ?? []).length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const user = await getAdminRole(req.headers.get('authorization')?.replace('Bearer ', '') ?? '')
  if (!user || !hasPermission(user.role, 'commercial:write')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { action, inputs, deal_id, distribution_event_id } = body

    if (action === 'batch_normalize') {
      const result = await batchNormalizeTruth(body.limit ?? 100)
      return NextResponse.json({ ok: true, ...result })
    }

    const typedInputs = inputs as EconomicTruthInputs
    const result      = computeEconomicTruthScore(typedInputs)
    const zoneMean    = await getZoneMeanTruthScore(typedInputs.zone_key, typedInputs.asset_class)
    result.normalized_truth_score = normalizeEconomicScore(result.raw_truth_score, zoneMean)

    await persistEconomicTruth(result, deal_id, distribution_event_id)
    return NextResponse.json({ ok: true, result })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
