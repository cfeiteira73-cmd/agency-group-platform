// Agency Group — Production Readiness API
// app/api/validation/production-readiness/route.ts
// TypeScript strict — 0 errors
//
// GET  — Returns latest cached production readiness report from DB
// POST — Runs fresh full assessment (computeProductionReadiness + generateProductionReadinessReport)
//
// Auth: x-service-auth: INTERNAL_API_SECRET (both methods)

import { NextRequest, NextResponse } from 'next/server'
import { safeCompare } from '@/lib/safeCompare'
import log from '@/lib/logger'
import {
  generateProductionReadinessReport,
  getLatestProductionReadinessReport,
} from '@/lib/validation/productionReadinessReport'
import { CANONICAL_TENANT_UUID } from '@/lib/constants/pipeline'

export const runtime     = 'nodejs'
export const maxDuration = 300

// ─── Auth ─────────────────────────────────────────────────────────────────────

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) return false
  const incoming =
    req.headers.get('x-service-auth') ??
    req.headers.get('authorization')?.replace('Bearer ', '') ??
    ''
  return safeCompare(incoming, secret)
}

function resolveTenantId(): string {
  return (
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID ??
    CANONICAL_TENANT_UUID
  )
}

// ─── GET — latest cached report ───────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = resolveTenantId()

  try {
    const report = await getLatestProductionReadinessReport(tenantId)

    if (!report) {
      return NextResponse.json(
        {
          error: 'No production readiness report found — run POST /api/validation/production-readiness first',
        },
        { status: 404 },
      )
    }

    return NextResponse.json(
      {
        score:              report.readiness_score.total_score,
        verdict:            report.readiness_score.verdict,
        production_blocked: report.readiness_score.production_blocked,
        blocking_reasons:   report.readiness_score.blocking_reasons,
        report,
      },
      {
        headers: {
          'Cache-Control':        'no-store',
          'X-Production-Ready':   String(report.production_ready),
          'X-Readiness-Score':    String(report.readiness_score.total_score),
          'X-Verdict':            report.readiness_score.verdict,
        },
      },
    )
  } catch (err) {
    log.error(
      '[GET /api/validation/production-readiness] error',
      err instanceof Error ? err : undefined,
      { tenant_id: tenantId },
    )
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST — fresh assessment ──────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = resolveTenantId()

  log.info('[POST /api/validation/production-readiness] starting full assessment', {
    tenant_id: tenantId,
  })

  try {
    const report = await generateProductionReadinessReport(tenantId)

    return NextResponse.json(
      {
        score:              report.readiness_score.total_score,
        verdict:            report.readiness_score.verdict,
        production_blocked: report.readiness_score.production_blocked,
        blocking_reasons:   report.readiness_score.blocking_reasons,
        report,
      },
      {
        status: 200,
        headers: {
          'Cache-Control':       'no-store',
          'X-Production-Ready':  String(report.production_ready),
          'X-Readiness-Score':   String(report.readiness_score.total_score),
          'X-Verdict':           report.readiness_score.verdict,
        },
      },
    )
  } catch (err) {
    log.error(
      '[POST /api/validation/production-readiness] error',
      err instanceof Error ? err : undefined,
      { tenant_id: tenantId },
    )
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
