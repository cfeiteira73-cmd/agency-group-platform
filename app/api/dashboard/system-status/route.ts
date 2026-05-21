// app/api/dashboard/system-status/route.ts
// Final system status assessment endpoint
// GET  = latest status from final_system_status_history
// POST = fresh full assessment (runs all sub-reports)
// runtime = 'nodejs', maxDuration = 120

import { NextRequest, NextResponse } from 'next/server'
import { safeCompare } from '@/lib/safeCompare'
import {
  computeFinalSystemStatus,
  type FinalSystemStatus,
  type SystemStatusLevel,
} from '@/lib/dashboard/finalSystemStatus'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

export const runtime    = 'nodejs'
export const maxDuration = 120
export const dynamic    = 'force-dynamic'

// ─── Auth helper ──────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '')
  const s1 = process.env.INTERNAL_API_SECRET
  const s2 = process.env.ADMIN_SECRET
  return (!!s1 && safeCompare(token, s1)) || (!!s2 && safeCompare(token, s2))
}

function getTenantId(req: NextRequest): string {
  return (
    req.nextUrl.searchParams.get('tenant_id') ??
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID ??
    'agency-group'
  )
}

// ─── Response builder ─────────────────────────────────────────────────────────

function buildResponse(
  status: FinalSystemStatus,
  httpStatus = 200,
): NextResponse {
  const res = NextResponse.json(status, { status: httpStatus })
  res.headers.set('X-System-Status', status.SYSTEM_STATUS satisfies SystemStatusLevel)
  res.headers.set('X-Ready-For-Scale', String(status.READY_FOR_SCALE))
  res.headers.set('X-Errors', String(status.ERRORS))
  return res
}

// ─── GET — latest status ──────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = getTenantId(req)

  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('final_system_status_history')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('assessed_at', { ascending: false })
      .limit(1)

    if (error || !data || data.length === 0) {
      // No cached status — run a fresh assessment
      log.info('[system-status] GET no_cache — running fresh', { tenant_id: tenantId })
      const fresh = await computeFinalSystemStatus(tenantId)
      return buildResponse(fresh)
    }

    const row = data[0] as {
      id: string
      tenant_id: string
      system_status: string
      errors_count: number
      ready_for_scale: boolean
      scores: FinalSystemStatus['scores']
      composite_score: number
      blocking_issues: string[]
      immediate_actions: string[]
      next_sprint_actions: string[]
      assessment_version: string
      assessed_at: string
    }

    const status: FinalSystemStatus = {
      status_id:           row.id,
      tenant_id:           row.tenant_id,
      SYSTEM_STATUS:       row.system_status as FinalSystemStatus['SYSTEM_STATUS'],
      ERRORS:              row.errors_count,
      READY_FOR_SCALE:     row.ready_for_scale,
      scores:              row.scores,
      composite_score:     row.composite_score,
      blocking_issues:     row.blocking_issues ?? [],
      immediate_actions:   row.immediate_actions ?? [],
      next_sprint_actions: row.next_sprint_actions ?? [],
      assessment_version:  row.assessment_version,
      assessed_at:         row.assessed_at,
    }

    return buildResponse(status)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.error('[system-status] GET error', new Error(message), { tenant_id: tenantId })
    return NextResponse.json({ error: 'Internal server error', detail: message }, { status: 500 })
  }
}

// ─── POST — fresh assessment ──────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = getTenantId(req)

  log.info('[system-status] POST fresh assessment start', { tenant_id: tenantId })

  try {
    const status = await computeFinalSystemStatus(tenantId)

    log.info('[system-status] POST complete', {
      tenant_id:       tenantId,
      SYSTEM_STATUS:   status.SYSTEM_STATUS,
      ERRORS:          status.ERRORS,
      READY_FOR_SCALE: status.READY_FOR_SCALE,
    })

    return buildResponse(status, 200)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.error('[system-status] POST error', new Error(message), { tenant_id: tenantId })
    return NextResponse.json({ error: 'Assessment failed', detail: message }, { status: 500 })
  }
}
