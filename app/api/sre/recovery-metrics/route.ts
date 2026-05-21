// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — SRE Recovery Metrics API
// app/api/sre/recovery-metrics/route.ts
//
// GET  /api/sre/recovery-metrics                    → SLO compliance (portal auth)
// GET  /api/sre/recovery-metrics?mode=posture       → current SLO posture estimate
// GET  /api/sre/recovery-metrics?component=database → filtered metrics
// POST /api/sre/recovery-metrics                    → record recovery metric (service auth)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth }         from '@/lib/requirePortalAuth'
import { requireServiceAuth }        from '@/lib/auth/serviceAuth'
import {
  recordRecoveryMetric,
  computeSLOCompliance,
  getRecoveryMetrics,
  estimateCurrentSLOPosture,
  SLO_TARGETS,
  type SystemComponent,
}                                    from '@/lib/sre/recoveryMetricsTracker'
import { CANONICAL_TENANT_UUID }     from '@/lib/constants/pipeline'
import { getRequestCorrelationId }   from '@/lib/observability/correlation'
import log                           from '@/lib/logger'

export const runtime = 'nodejs'

const VALID_COMPONENTS = new Set<string>(['database', 'events', 'ml', 'app'])

function resolveTenantId(): string {
  return (
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID     ??
    CANONICAL_TENANT_UUID
  )
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const corrId = getRequestCorrelationId(req)

  const auth = await requirePortalAuth(req)
  if (!auth.ok) return auth.response

  const tenantId = resolveTenantId()
  const { searchParams } = new URL(req.url)
  const mode      = searchParams.get('mode')
  const component = searchParams.get('component')

  try {
    if (mode === 'posture') {
      const posture = await estimateCurrentSLOPosture(tenantId)
      return NextResponse.json(
        { posture, slo_targets: SLO_TARGETS },
        { headers: { 'x-correlation-id': corrId } },
      )
    }

    if (component) {
      if (!VALID_COMPONENTS.has(component)) {
        return NextResponse.json(
          {
            error:             `Invalid component: ${component}`,
            valid_components:  Array.from(VALID_COMPONENTS),
          },
          { status: 400, headers: { 'x-correlation-id': corrId } },
        )
      }

      const metrics = await getRecoveryMetrics(tenantId, component as SystemComponent)
      return NextResponse.json(
        { metrics, component, count: metrics.length },
        { headers: { 'x-correlation-id': corrId } },
      )
    }

    // Default: SLO compliance report
    const periodRaw  = searchParams.get('period_days')
    const periodDays = periodRaw ? Math.max(1, Math.min(90, parseInt(periodRaw, 10))) : 30
    const compliance = await computeSLOCompliance(tenantId, periodDays)

    return NextResponse.json(
      { compliance },
      { headers: { 'x-correlation-id': corrId } },
    )
  } catch (err) {
    log.error('[GET /api/sre/recovery-metrics]', err instanceof Error ? err : undefined, {
      correlation_id: corrId,
      route: '/api/sre/recovery-metrics',
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: { 'x-correlation-id': corrId } },
    )
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const corrId = getRequestCorrelationId(req)

  const auth = await requireServiceAuth(req)
  if (!auth.ok) return auth.response

  const tenantId = resolveTenantId()

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400, headers: { 'x-correlation-id': corrId } },
    )
  }

  const {
    component,
    incident_type,
    actual_rto_minutes,
    actual_rpo_minutes,
    incident_started_at,
    recovery_completed_at,
    notes,
  } = body

  // Validate required fields
  if (!component || !VALID_COMPONENTS.has(String(component))) {
    return NextResponse.json(
      { error: `Invalid or missing component. Valid: ${Array.from(VALID_COMPONENTS).join(', ')}` },
      { status: 400, headers: { 'x-correlation-id': corrId } },
    )
  }

  if (!incident_type || typeof incident_type !== 'string') {
    return NextResponse.json(
      { error: 'incident_type is required (string)' },
      { status: 400, headers: { 'x-correlation-id': corrId } },
    )
  }

  if (!incident_started_at || typeof incident_started_at !== 'string') {
    return NextResponse.json(
      { error: 'incident_started_at is required (ISO 8601 string)' },
      { status: 400, headers: { 'x-correlation-id': corrId } },
    )
  }

  try {
    const metric = await recordRecoveryMetric(tenantId, {
      component:             component as SystemComponent,
      incident_type:         incident_type,
      actual_rto_minutes:    actual_rto_minutes != null ? Number(actual_rto_minutes) : null,
      actual_rpo_minutes:    actual_rpo_minutes != null ? Number(actual_rpo_minutes) : null,
      rto_slo_met:           null,
      rpo_slo_met:           null,
      incident_started_at:   incident_started_at,
      recovery_completed_at: recovery_completed_at != null ? String(recovery_completed_at) : null,
      notes:                 notes != null ? String(notes) : null,
    })

    log.info('[POST /api/sre/recovery-metrics] metric recorded', {
      correlation_id: corrId,
      tenant_id:      tenantId,
      component:      metric.component,
      incident_type:  metric.incident_type,
      rto_slo_met:    metric.rto_slo_met,
      rpo_slo_met:    metric.rpo_slo_met,
    })

    return NextResponse.json(
      { metric },
      {
        status: 201,
        headers: { 'x-correlation-id': corrId },
      },
    )
  } catch (err) {
    log.error('[POST /api/sre/recovery-metrics]', err instanceof Error ? err : undefined, {
      correlation_id: corrId,
      route: '/api/sre/recovery-metrics',
    })
    return NextResponse.json(
      { error: 'Failed to record recovery metric' },
      { status: 500, headers: { 'x-correlation-id': corrId } },
    )
  }
}
