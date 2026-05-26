// Agency Group — Final Production Certification API Route
// app/api/system/certification/route.ts
// Wave 45 Agent 6 — Apex certification endpoint
// TypeScript strict — 0 errors

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import {
  runFinalCertification,
  getLatestCertification,
  getCertificationHistory,
  type FinalCertificationResult,
} from '@/lib/certification/finalProductionCertification'
import log from '@/lib/logger'

export const runtime = 'nodejs'
export const maxDuration = 60

// ── BigInt-safe JSON serializer ────────────────────────────────────────────────

function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value
}

// ── Timing-safe Bearer token comparison ───────────────────────────────────────

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b))
  } catch {
    return false
  }
}

// ── Bearer auth helper ────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const apiKey = process.env.SYSTEM_API_KEY ?? process.env.CRON_SECRET
  if (!apiKey) {
    // No key configured — allow in development only
    if (process.env.NODE_ENV === 'development') return true
    return false
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return false

  const token = authHeader.slice(7)
  return safeCompare(token, apiKey)
}

// ── GET /api/system/certification?mode=latest|history&limit=10 ────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl
  const mode = searchParams.get('mode') ?? 'latest'
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '10', 10), 100)

  const tenantId =
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID ??
    '00000000-0000-0000-0000-000000000001'

  log.info('[GET /api/system/certification]', {
    route: '/api/system/certification',
    correlation_id: null,
  })

  try {
    if (mode === 'history') {
      const history = await getCertificationHistory(tenantId, limit)
      return new NextResponse(JSON.stringify({ ok: true, history }, bigintReplacer), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Default: latest
    const latest = await getLatestCertification(tenantId)
    if (!latest) {
      return new NextResponse(
        JSON.stringify({
          ok: true,
          certification: null,
          message: 'No certification found — run POST with action=run-full-certification',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    return new NextResponse(JSON.stringify({ ok: true, certification: latest }, bigintReplacer), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    log.error('[GET /api/system/certification] error', e, {
      route: '/api/system/certification',
    })
    return new NextResponse(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : 'Internal error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}

// ── POST /api/system/certification ────────────────────────────────────────────
// Body: { action: 'run-full-certification' }
// Requires Bearer auth

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return new NextResponse(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: { action?: string } = {}
  try {
    body = (await req.json()) as { action?: string }
  } catch {
    return new NextResponse(
      JSON.stringify({ ok: false, error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  if (body.action !== 'run-full-certification') {
    return new NextResponse(
      JSON.stringify({
        ok: false,
        error: 'Unknown action. Use: { action: "run-full-certification" }',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const tenantId =
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID ??
    '00000000-0000-0000-0000-000000000001'

  log.info('[POST /api/system/certification] Running full certification', {
    route: '/api/system/certification',
    correlation_id: null,
  })

  try {
    const result: FinalCertificationResult = await runFinalCertification(tenantId)

    return new NextResponse(
      JSON.stringify(
        {
          ok: true,
          certification: result,
          summary: {
            system_status: result.system_status,
            overall_score: result.overall_score,
            pass_count: result.conditions.filter(c => c.status === 'PASS').length,
            warn_count: result.warnings.length,
            fail_count: result.blocking_failures.length,
            pending_count: result.conditions.filter(c => c.status === 'PENDING').length,
            certified_at: result.certified_at,
          },
        },
        bigintReplacer,
      ),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    log.error('[POST /api/system/certification] error', e, {
      route: '/api/system/certification',
    })
    return new NextResponse(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : 'Internal error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
