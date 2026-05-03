// GET /api/analytics/data-moat — quantify platform data moat + network effects

import { NextRequest, NextResponse }   from 'next/server'
import { getAdminRole, hasPermission } from '@/lib/auth/adminAuth'
import { supabaseAdmin }               from '@/lib/supabase'
import {
  computeDataUniquenessScore,
  computeNetworkEffectValue,
  computeDataDepthScore,
  computeTemporalScore,
  computeMoatScore,
  classifyMoatStrength,
  buildMoatReport,
} from '@/lib/intelligence/dataMoat'
import type { DataAsset, NetworkState } from '@/lib/intelligence/dataMoat'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const user = await getAdminRole(req.headers.get('authorization')?.replace('Bearer ', '') ?? '')
  if (!user || !hasPermission(user.role, 'analytics:read')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const view = searchParams.get('view') ?? 'full'

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabaseAdmin as any

    const [
      { count: totalRecords },
      { count: recentRecords },
      { count: outcomeRecords },
      { count: behaviorSignals },
      { count: totalAgents },
      { count: totalInvestors },
      { count: totalTransactions },
    ] = await Promise.all([
      sb.from('learning_events').select('*', { count: 'exact', head: true }),
      sb.from('learning_events').select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 90 * 86400_000).toISOString()),
      sb.from('transaction_outcomes').select('*', { count: 'exact', head: true })
        .not('final_sale_price', 'is', null),
      sb.from('distribution_outcomes').select('*', { count: 'exact', head: true }),
      sb.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'agent'),
      sb.from('investidores').select('*', { count: 'exact', head: true }),
      sb.from('deals').select('*', { count: 'exact', head: true }),
    ])

    const { data: firstEvent } = await sb
      .from('learning_events')
      .select('created_at')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    const monthsAccumulating = firstEvent?.created_at
      ? Math.max(1, Math.round((Date.now() - new Date(firstEvent.created_at).getTime()) / (30 * 86400_000)))
      : 1

    const exclusiveEstimate = Math.round((totalRecords ?? 0) * 0.6)

    const asset: DataAsset = {
      total_records:       totalRecords       ?? 0,
      records_last_90d:    recentRecords      ?? 0,
      exclusive_records:   exclusiveEstimate,
      outcome_records:     outcomeRecords     ?? 0,
      behavioral_signals:  behaviorSignals    ?? 0,
      months_accumulating: monthsAccumulating,
    }

    const { data: zones } = await sb
      .from('market_segment_trends')
      .select('zone_key')
      .limit(100)
    const uniqueZones = [...new Set((zones ?? []).map((z: { zone_key: string }) => z.zone_key))].length

    const network: NetworkState = {
      active_agents:      totalAgents      ?? 0,
      active_investors:   totalInvestors   ?? 0,
      total_transactions: totalTransactions ?? 0,
      zones_covered:      uniqueZones,
      asset_classes:      5,
    }

    if (view === 'scores') {
      const uniqueness    = computeDataUniquenessScore(asset)
      const networkEffect = computeNetworkEffectValue(network.active_agents, network.active_investors, network.total_transactions)
      const depth         = computeDataDepthScore(asset)
      const temporal      = computeTemporalScore(asset.months_accumulating)
      const composite     = computeMoatScore(uniqueness, networkEffect, depth, temporal)
      const strength      = classifyMoatStrength(composite)
      return NextResponse.json({ uniqueness, network_effect: networkEffect, depth, temporal, composite, strength })
    }

    if (view === 'network') {
      const netScore = computeNetworkEffectValue(network.active_agents, network.active_investors, network.total_transactions)
      return NextResponse.json({ network, network_effect_score: netScore })
    }

    const report = buildMoatReport(asset, network)
    return NextResponse.json({ report, asset, network })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
