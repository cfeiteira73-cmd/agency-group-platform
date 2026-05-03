// GET  /api/analytics/market-feedback — market pressure signals by zone
// POST /api/analytics/market-feedback — ingest new market signal

import { NextRequest, NextResponse }   from 'next/server'
import { getAdminRole, hasPermission } from '@/lib/auth/adminAuth'
import { supabaseAdmin }               from '@/lib/supabase'
import { buildMarketFeedbackSignal }   from '@/lib/intelligence/marketFeedback'

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

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabaseAdmin as any)
      .from('market_feedback_signals')
      .select('*')
      .order('computed_at', { ascending: false })
      .limit(limit)

    if (zone)       query = query.eq('zone_key', zone)
    if (assetClass) query = query.eq('asset_class', assetClass)

    const { data, error } = await query
    if (error) throw new Error(error.message)

    const signals = data ?? []
    const regimeCount: Record<string, number> = {}
    for (const s of signals as Array<{ market_regime: string }>) {
      regimeCount[s.market_regime] = (regimeCount[s.market_regime] ?? 0) + 1
    }
    const dominantRegime = Object.entries(regimeCount).sort(([, a], [, b]) => b - a)[0]?.[0] ?? 'neutral'

    return NextResponse.json({ signals, dominant_regime: dominantRegime, count: signals.length })
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
    const body   = await req.json()
    const signal = buildMarketFeedbackSignal(
      body.zone_key,
      body.asset_class,
      body.period_label,
      {
        new_listings:         body.new_listings,
        sold_listings:        body.sold_listings,
        prior_new_listings:   body.prior_new_listings,
        price_delta_pct:      body.price_delta_pct,
        price_growth_yoy_pct: body.price_growth_yoy_pct,
        supply_balance:       body.supply_balance,
        competitor_pricing:   body.competitor_pricing,
      },
    )

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any)
      .from('market_feedback_signals')
      .insert(signal)
    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true, signal })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
