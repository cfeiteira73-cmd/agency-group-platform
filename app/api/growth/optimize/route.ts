// Agency Group — AI Growth Optimizer API
// app/api/growth/optimize/route.ts
// Growth intelligence endpoints: dashboard, loop health, reinvestment, decisions.
// TypeScript strict — 0 errors

import { NextRequest, NextResponse } from 'next/server'
import {
  requireAuth,
  safeCompare,
  extractBearerToken,
} from '@/lib/middleware/portalAuthGuard'
import { buildGrowthDashboard } from '@/lib/growth/growthDashboard'
import {
  measureClosedLoop,
  generateReinvestmentPlan,
  getLoopHistory,
} from '@/lib/growth/closedLoopGrowth'
import { runOptimizationCycle } from '@/lib/growth/aiGrowthOptimizer'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

export const runtime = 'nodejs'
export const maxDuration = 120

const CANONICAL_TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(req)
  if (authResult instanceof Response) return authResult as NextResponse

  const tenantId = authResult.tenant_id ?? CANONICAL_TENANT_ID
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('mode') ?? 'dashboard'

  try {
    switch (mode) {
      case 'dashboard': {
        const dashboard = await buildGrowthDashboard(tenantId)
        return NextResponse.json({ success: true, data: dashboard })
      }

      case 'loop-health': {
        const health = await measureClosedLoop(tenantId)
        return NextResponse.json({ success: true, data: health })
      }

      case 'loop-history': {
        const periods = parseInt(searchParams.get('periods') ?? '12', 10)
        const history = await getLoopHistory(tenantId, isNaN(periods) ? 12 : periods)
        return NextResponse.json({ success: true, data: history })
      }

      case 'reinvestment': {
        const plan = await generateReinvestmentPlan(tenantId)
        return NextResponse.json({ success: true, data: plan })
      }

      case 'pending-decisions': {
        const res = await (supabaseAdmin as any)
          .from('optimization_decisions')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('executed', false)
          .order('generated_at', { ascending: false })

        return NextResponse.json({
          success: true,
          data: res.data ?? [],
          count: (res.data ?? []).length,
        })
      }

      default:
        return NextResponse.json(
          {
            error: 'Invalid mode',
            valid_modes: [
              'dashboard',
              'loop-health',
              'loop-history',
              'reinvestment',
              'pending-decisions',
            ],
          },
          { status: 400 },
        )
    }
  } catch (err) {
    log.info('[growth/optimize] GET error', { tenantId, mode, error: String(err) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Admin Bearer required for mutation actions
  const internalToken = process.env.INTERNAL_API_TOKEN
  const token = extractBearerToken(req)

  if (!internalToken || !token || !safeCompare(token, internalToken)) {
    return NextResponse.json({ error: 'Admin Bearer required' }, { status: 401 })
  }

  const tenantId = CANONICAL_TENANT_ID

  let body: { action?: string } = {}
  try {
    body = (await req.json()) as { action?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { action } = body

  try {
    switch (action) {
      case 'run-optimization': {
        const cycle = await runOptimizationCycle(tenantId)
        log.info('[growth/optimize] run-optimization complete', {
          tenantId,
          cycle_id: cycle.cycle_id,
          decisions_made: cycle.decisions_made,
          decisions_executed: cycle.decisions_executed,
        })
        return NextResponse.json({ success: true, data: cycle })
      }

      case 'measure-loop': {
        const health = await measureClosedLoop(tenantId)
        log.info('[growth/optimize] measure-loop complete', {
          tenantId,
          loop_status: health.loop_status,
          loop_efficiency_pct: health.loop_efficiency_pct,
        })
        return NextResponse.json({ success: true, data: health })
      }

      default:
        return NextResponse.json(
          {
            error: 'Invalid action',
            valid_actions: ['run-optimization', 'measure-loop'],
          },
          { status: 400 },
        )
    }
  } catch (err) {
    log.info('[growth/optimize] POST error', { tenantId, action, error: String(err) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
