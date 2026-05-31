// GET|POST /api/monitoring/dashboard
// Wave 54 Phase 2 — System Health Dashboard

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { runSystemHealthDashboard } from '@/lib/observability/systemHealthDashboard'

export const runtime     = 'nodejs'
export const dynamic     = 'force-dynamic'
export const maxDuration = 60

function authorized(req: NextRequest): boolean {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) return false
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  try { return timingSafeEqual(Buffer.from(token), Buffer.from(secret)) }
  catch { return false }
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const d = await runSystemHealthDashboard()
  return NextResponse.json({
    status:           'SYSTEM_HEALTH_DASHBOARD',
    overall_health:   d.overall_health,
    health_score:     d.health_score,
    reality_score:    d.reality_score,
    service_count:    d.service_count,
    healthy_count:    d.healthy_count,
    degraded_count:   d.degraded_count,
    down_count:       d.down_count,
    alert_score:      d.alert_readiness.overall_alert_score,
    error_rate_pct:   d.error_summary.error_rate_pct,
    dashboard_hash:   d.dashboard_hash,
    generated_at:     d.generated_at,
  }, { status: d.overall_health === 'DOWN' ? 503 : 200 })
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /**/ }
  const tenantId = typeof body['tenant_id'] === 'string' ? body['tenant_id'] : undefined
  const d = await runSystemHealthDashboard(tenantId)
  return NextResponse.json(d)
}
