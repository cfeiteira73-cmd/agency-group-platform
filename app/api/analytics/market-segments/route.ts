// GET /api/analytics/market-segments
// Multi-period (7d/30d/90d) market segment intelligence with regime shift alerts

import { NextRequest, NextResponse }   from 'next/server'
import { getAdminRole, hasPermission } from '@/lib/auth/adminAuth'
import {
  getSegmentTrends,
  getRegimeShiftAlerts,
} from '@/lib/intelligence/marketSegments'
import type { PriceBand, PeriodLabel } from '@/lib/intelligence/marketSegments'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '')
  const user       = await getAdminRole(authHeader ?? '')
  if (!user || !hasPermission(user.role, 'analytics:read')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url         = new URL(req.url)
  const zoneKey     = url.searchParams.get('zone')         ?? undefined
  const propType    = url.searchParams.get('property_type') ?? undefined
  const priceBand   = url.searchParams.get('price_band')   as PriceBand | null
  const period      = url.searchParams.get('period')       as PeriodLabel | null
  const shifts      = url.searchParams.get('shifts_only')  === 'true'
  const limit       = Math.min(Number(url.searchParams.get('limit') ?? 200), 500)

  try {
    if (shifts) {
      const alerts = await getRegimeShiftAlerts()
      return NextResponse.json({
        regime_shift_alerts: alerts,
        count: alerts.length,
      })
    }

    const trends = await getSegmentTrends({
      zoneKey:      zoneKey,
      propertyType: propType,
      priceBand:    priceBand ?? undefined,
      periodLabel:  period    ?? undefined,
      limit,
    })

    // Group by zone+type+priceBand for multi-period comparison view
    const grouped: Record<string, { '7d'?: unknown; '30d'?: unknown; '90d'?: unknown }> = {}
    for (const t of trends) {
      const key = `${t.zone_key}|${t.property_type}|${t.price_band}`
      if (!grouped[key]) grouped[key] = {}
      grouped[key][t.period_label] = t
    }

    return NextResponse.json({
      trends,
      segments_compared: Object.keys(grouped).length,
      multi_period:       Object.entries(grouped).map(([k, v]) => {
        const [zone, type, band] = k.split('|')
        return { zone_key: zone, property_type: type, price_band: band, ...v }
      }),
    })
  } catch (err) {
    console.error('[market-segments GET]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}
