// =============================================================================
// Agency Group — Observability Timeline API Route
// app/api/observability/timeline/route.ts
//
// GET /api/observability/timeline
//   ?tenant_id=xxx
//   &mode=realtime|replay|forensics
//   &correlation_id=yyy          (required for replay / forensics)
//   &limit=50
//   &from=2026-01-01T00:00:00Z   (optional ISO time range start)
//   &to=2026-01-02T00:00:00Z     (optional ISO time range end)
//
// Auth: Bearer INTERNAL_API_SECRET or Bearer ADMIN_SECRET
// Returns: KernelTimelineResponse as JSON
//
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import {
  getSystemTimeline,
  type ObservabilityMode,
} from '@/lib/observability/kernel'
import { safeCompare } from '@/lib/safeCompare'

export const dynamic = 'force-dynamic'

// ─── Auth ─────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const token    = (req.headers.get('authorization') ?? '').replace('Bearer ', '')
  const internal = process.env.INTERNAL_API_SECRET
  const admin    = process.env.ADMIN_SECRET
  if (internal && safeCompare(token, internal)) return true
  if (admin    && safeCompare(token, admin))    return true
  return false
}

// ─── Mode validation ──────────────────────────────────────────────────────────

const VALID_MODES: ReadonlySet<string> = new Set<ObservabilityMode>([
  'realtime',
  'replay',
  'forensics',
])

function isValidMode(value: string | null): value is ObservabilityMode {
  return value !== null && VALID_MODES.has(value)
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sp             = req.nextUrl.searchParams
  const tenant_id      = sp.get('tenant_id')
  const modeParam      = sp.get('mode') ?? 'realtime'
  const correlation_id = sp.get('correlation_id') ?? undefined
  const limitParam     = sp.get('limit')
  const fromParam      = sp.get('from')
  const toParam        = sp.get('to')

  // ── Validate required fields ────────────────────────────────────────────────

  if (!tenant_id) {
    return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 })
  }

  if (!isValidMode(modeParam)) {
    return NextResponse.json(
      { error: `mode must be one of: realtime, replay, forensics` },
      { status: 400 },
    )
  }

  if ((modeParam === 'replay' || modeParam === 'forensics') && !correlation_id) {
    return NextResponse.json(
      { error: `correlation_id is required for mode="${modeParam}"` },
      { status: 400 },
    )
  }

  // ── Parse optional params ───────────────────────────────────────────────────

  const limit = limitParam !== null ? parseInt(limitParam, 10) : undefined
  if (limit !== undefined && (isNaN(limit) || limit < 1)) {
    return NextResponse.json({ error: 'limit must be a positive integer' }, { status: 400 })
  }

  const time_range =
    fromParam && toParam
      ? { from: fromParam, to: toParam }
      : undefined

  // ── Delegate to kernel ──────────────────────────────────────────────────────

  try {
    const response = await getSystemTimeline({
      tenant_id,
      correlation_id,
      mode:   modeParam,
      limit,
      time_range,
    })

    return NextResponse.json(response)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[observability/timeline] Unhandled error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
