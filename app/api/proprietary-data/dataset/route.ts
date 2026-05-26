// Agency Group — Proprietary Data Dataset API
// app/api/proprietary-data/dataset/route.ts
// Unified GET/POST endpoint for all proprietary data modules.
// TypeScript strict — 0 errors

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware/portalAuthGuard'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import {
  computeTimeToCloseStats,
  ingestFromExecutionOutcomes,
} from '@/lib/proprietary-data/timeToCloseDataset'
import {
  computeDiscountProfile,
  getExpectedDiscount,
  ingestFromRealOutcomes,
} from '@/lib/proprietary-data/discountVsListingEngine'
import {
  getBehaviorInsights,
  runBehaviorDatasetUpdate,
} from '@/lib/proprietary-data/investorBehaviorDataset'
import {
  getLVIHistory,
  publishLVIMatrix,
} from '@/lib/proprietary-data/liquidityVelocityIndex'

export const runtime = 'nodejs'
export const maxDuration = 120

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: Request): Promise<NextResponse> {
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth as NextResponse

  const { searchParams } = new URL(req.url)
  const tenantId = auth.tenant_id
  const mode = searchParams.get('mode')
  const market = searchParams.get('market') ?? 'PT:Lisboa'

  try {
    // ?mode=time-to-close&market=PT:Lisboa
    if (mode === 'time-to-close') {
      const propertyType = searchParams.get('property_type') ?? undefined
      const stats = await computeTimeToCloseStats(market, propertyType, tenantId)
      return NextResponse.json({ data: stats, market, mode })
    }

    // ?mode=discount-profile&market=PT:Lisboa
    if (mode === 'discount-profile') {
      const propertyType = searchParams.get('property_type') ?? undefined
      const profiles = await computeDiscountProfile(market, propertyType, tenantId)
      return NextResponse.json({ data: profiles, market, mode })
    }

    // ?mode=behavior-insights
    if (mode === 'behavior-insights') {
      const insights = await getBehaviorInsights(tenantId)
      return NextResponse.json({ data: insights, mode })
    }

    // ?mode=lvi&market=PT:Lisboa
    if (mode === 'lvi') {
      const periodsParam = searchParams.get('periods')
      const periods = periodsParam != null ? parseInt(periodsParam, 10) : 12
      const history = await getLVIHistory(market, tenantId, periods)
      return NextResponse.json({ data: history, market, mode })
    }

    // ?mode=expected-discount&market=X&property_type=Y&days=30&distressed=false
    if (mode === 'expected-discount') {
      const propertyType = searchParams.get('property_type') ?? 'residential'
      const daysParam = searchParams.get('days')
      const daysOnMarket = daysParam != null ? parseInt(daysParam, 10) : 30
      const isDistressed = searchParams.get('distressed') === 'true'

      const result = await getExpectedDiscount(
        market,
        propertyType,
        daysOnMarket,
        isDistressed,
        tenantId,
      )
      return NextResponse.json({ data: result, market, property_type: propertyType, mode })
    }

    // Default: aggregate dataset summary
    const [ttcCount, discountCount, behaviorCount, lviCount] = await Promise.all([
      (supabaseAdmin as any)
        .from('time_to_close_records')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
      (supabaseAdmin as any)
        .from('discount_data_points')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
      (supabaseAdmin as any)
        .from('investor_behavior_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
      (supabaseAdmin as any)
        .from('liquidity_velocity_index')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
    ])

    const summary = {
      datasets: {
        time_to_close: {
          record_count: ttcCount.count ?? 0,
          table: 'time_to_close_records',
        },
        discount_data: {
          record_count: discountCount.count ?? 0,
          table: 'discount_data_points',
        },
        investor_behavior: {
          record_count: behaviorCount.count ?? 0,
          table: 'investor_behavior_profiles',
        },
        liquidity_velocity_index: {
          record_count: lviCount.count ?? 0,
          table: 'liquidity_velocity_index',
        },
      },
      available_modes: [
        'time-to-close',
        'discount-profile',
        'behavior-insights',
        'lvi',
        'expected-discount',
      ],
      generated_at: new Date().toISOString(),
    }

    return NextResponse.json({ data: summary })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Internal error'
    log.error('[proprietary-data/dataset] GET error', e instanceof Error ? e : new Error(msg), { mode, market })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth as NextResponse

  // Admin-only actions: require bearer or cron role
  if (auth.method !== 'bearer' && auth.method !== 'cron' && auth.role !== 'tenant_admin' && auth.role !== 'admin' && auth.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden', reason: 'admin role required' }, { status: 403 })
  }

  const tenantId = auth.tenant_id

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const action = typeof body.action === 'string' ? body.action : null
  if (!action) {
    return NextResponse.json({ error: 'Missing required field: action' }, { status: 400 })
  }

  try {
    // { action: 'ingest-outcomes' }
    if (action === 'ingest-outcomes') {
      const [ttcResult, discountResult] = await Promise.all([
        ingestFromExecutionOutcomes(tenantId),
        ingestFromRealOutcomes(tenantId),
      ])
      return NextResponse.json({
        data: {
          time_to_close_ingested: ttcResult.ingested,
          discount_ingested: discountResult.ingested,
          total_ingested: ttcResult.ingested + discountResult.ingested,
        },
      })
    }

    // { action: 'update-behavior-dataset' }
    if (action === 'update-behavior-dataset') {
      const result = await runBehaviorDatasetUpdate(tenantId)
      return NextResponse.json({ data: result })
    }

    // { action: 'publish-lvi' }
    if (action === 'publish-lvi') {
      const records = await publishLVIMatrix(tenantId)
      return NextResponse.json({
        data: {
          published: records.length,
          records,
        },
      })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Internal error'
    log.error('[proprietary-data/dataset] POST error', e instanceof Error ? e : new Error(msg), { action, tenantId })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
