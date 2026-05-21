// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Liquidity Grade API
// app/api/liquidity/grade/route.ts
//
// GET /api/liquidity/grade?property_id=xxx              → single assessment
// GET /api/liquidity/grade?property_ids=a,b,c           → batch (max 20)
// GET /api/liquidity/grade?property_id=xxx&history=true → snapshots from DB
//
// Auth: isPortalAuth
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { isPortalAuth } from '@/lib/portalAuth'
import { getTenantId } from '@/lib/tenant'
import {
  computeLiquidityGrade,
  batchComputeLiquidity,
  persistLiquiditySnapshot,
} from '@/lib/liquidity/liquidityEngine'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

export const runtime     = 'nodejs'
export const maxDuration = 60

// ─── Internal snapshot row shape ─────────────────────────────────────────────

interface SnapshotRow {
  id:                      string
  tenant_id:               string
  property_id:             string
  grade:                   string
  score:                   number
  time_to_execution_days:  number
  probability_of_close:    number
  capital_absorption_rate: number
  components:              Record<string, number>
  computed_at:             string
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const propertyId       = searchParams.get('property_id')
    const propertyIdsParam = searchParams.get('property_ids')
    const history          = searchParams.get('history') === 'true'

    const tenantId = await getTenantId(req)

    // ── History mode ─────────────────────────────────────────────────────────
    if (propertyId && history) {
      const db = supabaseAdmin as any

      const { data, error } = await (db
        .from('liquidity_snapshots')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('property_id', propertyId)
        .order('computed_at', { ascending: false })
        .limit(50) as Promise<{ data: SnapshotRow[] | null; error: { message: string } | null }>)

      if (error) {
        log.warn('[API /liquidity/grade GET history] db error', { error: error.message })
        return NextResponse.json({ error: 'Failed to fetch snapshots' }, { status: 500 })
      }

      return NextResponse.json({ success: true, data: data ?? [] })
    }

    // ── Batch mode ────────────────────────────────────────────────────────────
    if (propertyIdsParam) {
      const ids = propertyIdsParam
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)

      if (ids.length === 0) {
        return NextResponse.json({ error: 'No valid property_ids provided' }, { status: 400 })
      }

      if (ids.length > 20) {
        return NextResponse.json({ error: 'Maximum 20 property_ids per batch request' }, { status: 400 })
      }

      const assessments = await batchComputeLiquidity(tenantId, ids)

      // Fire-and-forget persist all
      for (const a of assessments) {
        void persistLiquiditySnapshot(a).catch(e =>
          log.warn('[API /liquidity/grade batch] persist failed', {
            property_id: a.property_id,
            error:       e instanceof Error ? e.message : String(e),
          }),
        )
      }

      return NextResponse.json({ success: true, data: assessments })
    }

    // ── Single mode ───────────────────────────────────────────────────────────
    if (propertyId) {
      const assessment = await computeLiquidityGrade(tenantId, propertyId)

      // Fire-and-forget persist
      void persistLiquiditySnapshot(assessment).catch(e =>
        log.warn('[API /liquidity/grade single] persist failed', {
          property_id: propertyId,
          error:       e instanceof Error ? e.message : String(e),
        }),
      )

      return NextResponse.json({ success: true, data: assessment })
    }

    return NextResponse.json(
      { error: 'Provide property_id or property_ids param' },
      { status: 400 },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.warn('[API /liquidity/grade GET] error', { error: msg })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
