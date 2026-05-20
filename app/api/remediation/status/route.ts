// =============================================================================
// Agency Group — Self-Healing Status
// GET /api/remediation/status?tenant_id=xxx
//
// Returns OrchestratorStats + current LoadMode for the tenant.
// Fail-open: returns zeroed stats on any infrastructure error.
//
// Auth : Bearer INTERNAL_API_SECRET | ADMIN_SECRET
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse }   from 'next/server'
import { getOrchestratorStats }         from '@/lib/remediation/selfHealingOrchestrator'
import { getLoadMode }                  from '@/lib/runtime/loadGovernor'
import { safeCompare }                  from '@/lib/safeCompare'

export const dynamic = 'force-dynamic'

// ─── Auth ─────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const auth     = req.headers.get('authorization') ?? ''
  const internal = process.env.INTERNAL_API_SECRET
  const admin    = process.env.ADMIN_SECRET
  if (internal && !!auth && safeCompare(auth, `Bearer ${internal}`)) return true
  if (admin    && !!auth && safeCompare(auth, `Bearer ${admin}`))    return true
  return false
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const tenantId = searchParams.get('tenant_id')?.trim() ?? ''

  if (!tenantId) {
    return NextResponse.json({ error: 'tenant_id query param required' }, { status: 400 })
  }

  const [stats, loadMode] = await Promise.allSettled([
    getOrchestratorStats(tenantId),
    getLoadMode(tenantId),
  ])

  return NextResponse.json({
    tenant_id:    tenantId,
    fetched_at:   new Date().toISOString(),
    load_mode:    loadMode.status === 'fulfilled' ? loadMode.value : 'NORMAL',
    orchestrator: stats.status === 'fulfilled' ? stats.value : {
      tenant_id:             tenantId,
      cycles_run:            0,
      cycles_healed:         0,
      cycles_escalated:      0,
      avg_cycle_duration_ms: 0,
      heal_rate:             0,
      last_cycle_at:         null,
    },
  })
}
