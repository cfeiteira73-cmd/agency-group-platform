// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — SRE Integrity API
// app/api/sre/integrity/route.ts
//
// GET  /api/sre/integrity                  → latest integrity report (portal auth)
// GET  /api/sre/integrity?mode=history     → integrity history (portal auth)
// GET  /api/sre/integrity?mode=slo         → SLO compliance + posture (portal auth)
// GET  /api/sre/integrity?mode=soft-delete → hard delete audit + missing columns (portal auth)
// POST /api/sre/integrity                  → run integrity check (service auth)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth }         from '@/lib/requirePortalAuth'
import { requireServiceAuth }        from '@/lib/auth/serviceAuth'
import {
  runSystemIntegrityCheck,
  getLatestIntegrityReport,
  getIntegrityHistory,
}                                    from '@/lib/sre/systemIntegrityValidator'
import {
  computeSLOCompliance,
  estimateCurrentSLOPosture,
}                                    from '@/lib/sre/recoveryMetricsTracker'
import {
  auditHardDeleteAttempts,
  getMissingDeletedAtColumns,
}                                    from '@/lib/sre/softDeleteEnforcer'
import { CANONICAL_TENANT_UUID }     from '@/lib/constants/pipeline'
import { getRequestCorrelationId }   from '@/lib/observability/correlation'
import log                           from '@/lib/logger'

export const runtime    = 'nodejs'
export const maxDuration = 60

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
  const mode = searchParams.get('mode')

  try {
    if (mode === 'history') {
      const limitRaw = searchParams.get('limit')
      const limit    = limitRaw ? Math.max(1, Math.min(100, parseInt(limitRaw, 10))) : 20
      const history  = await getIntegrityHistory(tenantId, limit)
      return NextResponse.json(
        { reports: history, count: history.length },
        { headers: { 'x-correlation-id': corrId } },
      )
    }

    if (mode === 'slo') {
      const periodRaw = searchParams.get('period_days')
      const periodDays = periodRaw ? Math.max(1, Math.min(90, parseInt(periodRaw, 10))) : 30
      const [compliance, posture] = await Promise.all([
        computeSLOCompliance(tenantId, periodDays),
        estimateCurrentSLOPosture(tenantId),
      ])
      return NextResponse.json(
        { compliance, posture },
        { headers: { 'x-correlation-id': corrId } },
      )
    }

    if (mode === 'soft-delete') {
      const sinceHoursRaw = searchParams.get('since_hours')
      const sinceHours    = sinceHoursRaw ? Math.max(1, Math.min(720, parseInt(sinceHoursRaw, 10))) : 24
      const [hardDeleteAudit, missingColumns] = await Promise.all([
        auditHardDeleteAttempts(tenantId, sinceHours),
        getMissingDeletedAtColumns(),
      ])
      return NextResponse.json(
        {
          hard_delete_audit: hardDeleteAudit,
          missing_deleted_at_columns: missingColumns,
          tables_needing_migration: missingColumns.length,
        },
        { headers: { 'x-correlation-id': corrId } },
      )
    }

    // Default: latest report
    const report = await getLatestIntegrityReport(tenantId)
    if (!report) {
      return NextResponse.json(
        { error: 'No integrity reports found. POST to run first check.' },
        { status: 404, headers: { 'x-correlation-id': corrId } },
      )
    }

    return NextResponse.json(
      { report },
      { headers: { 'x-correlation-id': corrId } },
    )
  } catch (err) {
    log.error('[GET /api/sre/integrity]', err instanceof Error ? err : undefined, {
      correlation_id: corrId,
      route: '/api/sre/integrity',
      mode: mode ?? 'latest',
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

  try {
    const report = await runSystemIntegrityCheck(tenantId)

    log.info('[POST /api/sre/integrity] check complete', {
      correlation_id: corrId,
      tenant_id:      tenantId,
      overall_status: report.overall_status,
      overall_score:  report.overall_score,
      sre_grade:      report.sre_grade,
    })

    return NextResponse.json(
      { report },
      {
        status: 201,
        headers: { 'x-correlation-id': corrId },
      },
    )
  } catch (err) {
    log.error('[POST /api/sre/integrity]', err instanceof Error ? err : undefined, {
      correlation_id: corrId,
      route: '/api/sre/integrity',
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: { 'x-correlation-id': corrId } },
    )
  }
}
