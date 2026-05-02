// GET /api/analytics/inventory-forecast
// Inventory scarcity forecast: supply trend, demand pressure, time-to-clear by zone

import { NextRequest, NextResponse }   from 'next/server'
import { getAdminRole, hasPermission } from '@/lib/auth/adminAuth'
import { supabaseAdmin }               from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '')
  const user       = await getAdminRole(authHeader ?? '')
  if (!user || !hasPermission(user.role, 'analytics:read')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url       = new URL(req.url)
  const zoneKey   = url.searchParams.get('zone')
  const days      = Math.min(Number(url.searchParams.get('days') ?? 90), 365)

  try {
    const since = new Date(Date.now() - days * 86400_000).toISOString()

    const [activeProps, closedDeals, segmentTrends, buyerPool] = await Promise.all([
      // Active inventory
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabaseAdmin as any)
        .from('properties')
        .select('id, zone, typology, price, created_at')
        .eq('status', 'active')
        .then((r: { data: unknown[] | null }) => r.data ?? []),

      // Closed deals in window (velocity)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabaseAdmin as any)
        .from('transaction_outcomes')
        .select('property_id, final_sale_price, closed_at, score_at_time, grade_at_time')
        .eq('outcome_type', 'won')
        .gte('closed_at', since)
        .then((r: { data: unknown[] | null }) => r.data ?? []),

      // Market segment trends (supply/demand proxy via DOM)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabaseAdmin as any)
        .from('market_segment_trends')
        .select('zone_key, property_type, period_label, avg_days_to_close, deal_count, confidence_score, price_trend')
        .eq('period_label', '30d')
        .gte('computed_at', new Date(Date.now() - 7 * 86400_000).toISOString())
        .then((r: { data: unknown[] | null }) => r.data ?? []),

      // Active qualified buyers
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabaseAdmin as any)
        .from('contacts')
        .select('id, preferred_zone, budget_max')
        .eq('type', 'buyer')
        .eq('status', 'active')
        .then((r: { data: unknown[] | null }) => r.data ?? []),
    ])

    // Zone-level aggregation
    type ZoneData = {
      zone: string;
      active_listings: number;
      closed_last_period: number;
      avg_days_to_close: number | null;
      active_buyers: number;
      demand_supply_ratio: number;
      time_to_clear_days: number | null;
      scarcity_score: number;
      price_trend: string;
    }
    const zoneMap: Record<string, ZoneData> = {}

    const getZone = (z: string): ZoneData => {
      if (!zoneMap[z]) {
        zoneMap[z] = {
          zone:                z,
          active_listings:     0,
          closed_last_period:  0,
          avg_days_to_close:   null,
          active_buyers:       0,
          demand_supply_ratio: 0,
          time_to_clear_days:  null,
          scarcity_score:      0,
          price_trend:         'unknown',
        }
      }
      return zoneMap[z]
    }

    for (const p of activeProps as Array<{ zone: string }>) {
      if (!p.zone) continue
      if (zoneKey && p.zone !== zoneKey) continue
      getZone(p.zone).active_listings++
    }

    for (const d of closedDeals as Array<{ property_id: string }>) {
      void d  // zone attribution requires joining — count globally for now
    }

    for (const seg of segmentTrends as Array<{
      zone_key: string; period_label: string; avg_days_to_close: number | null;
      deal_count: number; price_trend: string
    }>) {
      if (zoneKey && seg.zone_key !== zoneKey) continue
      const z = getZone(seg.zone_key)
      z.closed_last_period  += seg.deal_count ?? 0
      z.avg_days_to_close    = seg.avg_days_to_close
      z.price_trend          = seg.price_trend
    }

    for (const b of buyerPool as Array<{ preferred_zone: string | null }>) {
      if (!b.preferred_zone) continue
      if (zoneKey && b.preferred_zone !== zoneKey) continue
      getZone(b.preferred_zone).active_buyers++
    }

    // Compute derived metrics
    const zones = Object.values(zoneMap).map(z => {
      const velocity   = z.closed_last_period / (days / 30)   // deals per 30d
      const supply     = z.active_listings
      const timeToClear = velocity > 0 ? Math.round(supply / velocity * 30) : null

      const demandSupply = supply > 0 ? z.active_buyers / supply : 0

      // Scarcity score 0-100: high = scarce (few listings vs many buyers, fast clearing)
      let scarcity = 0
      if (timeToClear != null && timeToClear < 30)  scarcity += 40
      if (timeToClear != null && timeToClear < 60)  scarcity += 20
      if (demandSupply > 2)  scarcity += 25
      if (demandSupply > 1)  scarcity += 10
      if (z.price_trend === 'rising')  scarcity += 15

      return {
        ...z,
        time_to_clear_days:  timeToClear,
        demand_supply_ratio: Math.round(demandSupply * 100) / 100,
        scarcity_score:      Math.min(100, scarcity),
      }
    }).sort((a, b) => b.scarcity_score - a.scarcity_score)

    const topScarcity = zones.filter(z => z.scarcity_score >= 60)
    const closedCount = (closedDeals as unknown[]).length
    const velocity30d = Math.round(closedCount / (days / 30) * 10) / 10

    return NextResponse.json({
      zones,
      summary: {
        total_active_inventory:  (activeProps as unknown[]).length,
        closes_in_period:        closedCount,
        avg_velocity_per_30d:   velocity30d,
        high_scarcity_zones:     topScarcity.map(z => z.zone),
        period_days:             days,
      },
    })
  } catch (err) {
    console.error('[inventory-forecast GET]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}
