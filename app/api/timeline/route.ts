// =============================================================================
// Agency Group — Unified Timeline API
// app/api/timeline/route.ts
//
// GET /api/timeline?tenant_id=xxx&correlation_id=yyy&from=ISO&to=ISO&limit=50&sources=audit,event
//
// Auth: Bearer INTERNAL_API_SECRET or ADMIN_SECRET
// Returns: { entries: TimelineEntry[], count: number, generated_at: string }
//
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import {
  getUnifiedTimeline,
  type TimelineEntry,
} from '@/lib/observability/unifiedTimeline'
import { safeCompare } from '@/lib/safeCompare'

export const dynamic = 'force-dynamic'

// ─── Auth ─────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '')
  const s1    = process.env.INTERNAL_API_SECRET
  const s2    = process.env.ADMIN_SECRET
  return (!!s1 && safeCompare(token, s1)) || (!!s2 && safeCompare(token, s2))
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sp = req.nextUrl.searchParams

  const tenant_id      = sp.get('tenant_id') ?? req.headers.get('x-tenant-id') ?? ''
  const correlation_id = sp.get('correlation_id') ?? undefined
  const from           = sp.get('from') ?? undefined
  const to             = sp.get('to')   ?? undefined
  const limitParam     = sp.get('limit')
  const sourcesParam   = sp.get('sources')

  if (!tenant_id) {
    return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 })
  }

  // Parse limit (default 50, max 200)
  const limit = limitParam
    ? Math.min(Math.max(1, parseInt(limitParam, 10)), 200)
    : 50

  // Parse sources filter
  type Source = 'audit' | 'event' | 'causal'
  let sources: Source[] | undefined
  if (sourcesParam) {
    const parsed = sourcesParam
      .split(',')
      .map((s) => s.trim())
      .filter((s): s is Source => s === 'audit' || s === 'event' || s === 'causal')
    if (parsed.length > 0) sources = parsed
  }

  // Build time_range only if both from and to are provided, or either alone
  const time_range =
    from ?? to
      ? { from: from ?? '1970-01-01T00:00:00.000Z', to: to ?? new Date().toISOString() }
      : undefined

  let entries: TimelineEntry[]
  try {
    entries = await getUnifiedTimeline({
      tenant_id,
      correlation_id,
      time_range,
      limit,
      ...(sources ? { sources } : {}),
    })
  } catch (err) {
    // Fail-open: return empty feed rather than 500
    console.error('[GET /api/timeline] unexpected error:', err)
    entries = []
  }

  return NextResponse.json({
    entries,
    count:        entries.length,
    generated_at: new Date().toISOString(),
  })
}
