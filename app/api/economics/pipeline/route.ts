// =============================================================================
// Agency Group — Capital Pipeline Trace API
// app/api/economics/pipeline/route.ts
//
// GET /api/economics/pipeline?deal_id=<uuid>
//     Returns full CapitalPipelineTrace for a deal:
//     every step from lead qualification to commission payment,
//     with stage durations, bottleneck, financial summary, and outcome.
//
// GET /api/economics/pipeline?funnel=true&from=2026-01-01
//     Returns conversion funnel metrics:
//     lead→match→deal→won rates, avg values, pipeline at risk.
//
// Auth: INTERNAL_API_SECRET (Bearer token in Authorization header)
//
// AMI: 22506 | SH-ROS | TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { safeCompare } from '@/lib/safeCompare'
import {
  buildPipelineTrace,
  getConversionFunnelMetrics,
  type CapitalPipelineTrace,
  type ConversionFunnelMetrics,
} from '@/lib/economics/capitalPipeline'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ─── Auth ─────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) return false
  const authHeader = req.headers.get('authorization') ?? ''
  const token      = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  return safeCompare(token, secret)
}

function tenantId(): string {
  return process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001'
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const dealId  = searchParams.get('deal_id')
  const funnel  = searchParams.get('funnel')
  const from    = searchParams.get('from')

  // ── Path: full pipeline trace for one deal ────────────────────────────────
  if (dealId) {
    try {
      const trace: CapitalPipelineTrace = await buildPipelineTrace(dealId, tenantId())
      return NextResponse.json(
        {
          deal_id:    dealId,
          tenant_id:  tenantId(),
          trace,
          fetched_at: new Date().toISOString(),
        },
        {
          status:  200,
          headers: { 'Cache-Control': 'no-store' },
        }
      )
    } catch (err: unknown) {
      return NextResponse.json(
        { error: 'Failed to build pipeline trace', detail: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      )
    }
  }

  // ── Path: conversion funnel metrics ───────────────────────────────────────
  if (funnel === 'true') {
    const fromDate = from ?? new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10)

    if (from && !/^\d{4}-\d{2}-\d{2}/.test(from)) {
      return NextResponse.json(
        { error: 'from must be an ISO date string e.g. 2026-01-01' },
        { status: 400 }
      )
    }

    try {
      const metrics: ConversionFunnelMetrics = await getConversionFunnelMetrics(tenantId(), fromDate)
      return NextResponse.json(
        {
          tenant_id:   tenantId(),
          from:        fromDate,
          metrics,
          computed_at: new Date().toISOString(),
        },
        {
          status:  200,
          headers: { 'Cache-Control': 'no-store' },
        }
      )
    } catch (err: unknown) {
      return NextResponse.json(
        { error: 'Funnel metrics computation failed', detail: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      )
    }
  }

  return NextResponse.json(
    {
      error:   'Missing required parameters',
      options: [
        'GET ?deal_id=<uuid>                  — full capital pipeline trace for one deal',
        'GET ?funnel=true&from=YYYY-MM-DD     — conversion funnel metrics from date',
      ],
    },
    { status: 400 }
  )
}
