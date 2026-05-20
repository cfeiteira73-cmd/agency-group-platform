// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Incident Autopsy API
// app/api/incidents/[id]/autopsy/route.ts
//
// GET  /api/incidents/[id]/autopsy  — returns existing report or generates one
// POST /api/incidents/[id]/autopsy  — force regenerates the autopsy report
//
// Auth: Bearer INTERNAL_API_SECRET or ADMIN_SECRET
// =============================================================================

import { NextRequest, NextResponse }  from 'next/server'
import { generateAutopsyReport }      from '@/lib/incidents/autopsyReport'
import { safeCompare }                from '@/lib/safeCompare'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ─── Auth helper ──────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const token    = (req.headers.get('authorization') ?? '').replace('Bearer ', '')
  const internal = process.env.INTERNAL_API_SECRET
  const admin    = process.env.ADMIN_SECRET
  if (internal && safeCompare(token, internal)) return true
  if (admin    && safeCompare(token, admin))    return true
  return false
}

// ─── GET /api/incidents/[id]/autopsy ─────────────────────────────────────────

export async function GET(
  req:     NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params

  if (!id || id.length < 3) {
    return NextResponse.json({ error: 'Invalid incident id' }, { status: 400 })
  }

  try {
    const report = await generateAutopsyReport(id)
    return NextResponse.json(report)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ─── POST /api/incidents/[id]/autopsy ────────────────────────────────────────

export async function POST(
  req:     NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params

  if (!id || id.length < 3) {
    return NextResponse.json({ error: 'Invalid incident id' }, { status: 400 })
  }

  try {
    const report = await generateAutopsyReport(id)
    return NextResponse.json(report, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
