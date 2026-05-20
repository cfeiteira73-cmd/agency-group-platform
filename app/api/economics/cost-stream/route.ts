// =============================================================================
// Agency Group — Cost Stream API Route
// app/api/economics/cost-stream/route.ts
//
// GET /api/economics/cost-stream?tenant_id=xxx&window_seconds=3600
//
// Returns a RollingCostWindow JSON with real-time cost aggregation
// from the Redis cost_stream:{tenant_id} stream.
//
// Auth      : Bearer token (ECONOMICS_API_SECRET env var)
// Fail-open : Redis unavailable → returns zero-valued window
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import {
  getRollingCostWindow,
  getInstantMargin,
  type RollingCostWindow,
} from '@/lib/economics/costStreamEngine'

export const dynamic = 'force-dynamic'

// ─── Auth helper ──────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.ECONOMICS_API_SECRET
  if (!secret) return false   // env var required; refuse if missing

  const auth = req.headers.get('authorization') ?? ''
  const [scheme, token] = auth.split(' ')
  return scheme === 'Bearer' && token === secret
}

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    )
  }

  const { searchParams } = req.nextUrl
  const tenantId = searchParams.get('tenant_id')

  if (!tenantId || tenantId.trim() === '') {
    return NextResponse.json(
      { error: 'Missing required query param: tenant_id' },
      { status: 400 },
    )
  }

  const rawWindow = searchParams.get('window_seconds')
  const windowSeconds = rawWindow !== null ? parseInt(rawWindow, 10) : 3600

  if (isNaN(windowSeconds) || windowSeconds <= 0 || windowSeconds > 86_400) {
    return NextResponse.json(
      { error: 'window_seconds must be an integer between 1 and 86400' },
      { status: 400 },
    )
  }

  // Fetch rolling window and margin in parallel
  const [window, margin] = await Promise.allSettled([
    getRollingCostWindow(tenantId, windowSeconds),
    getInstantMargin(tenantId),
  ])

  const costWindow: RollingCostWindow =
    window.status === 'fulfilled'
      ? window.value
      : {
          tenant_id:          tenantId,
          window_seconds:     windowSeconds,
          total_cost_eur:     0,
          ai_cost_eur:        0,
          infra_cost_eur:     0,
          compute_cost_eur:   0,
          event_count:        0,
          burn_rate_per_hour: 0,
          margin:             null,
          generated_at:       new Date().toISOString(),
        }

  // Attach margin when available
  costWindow.margin =
    margin.status === 'fulfilled' ? margin.value : null

  return NextResponse.json(costWindow, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
