// =============================================================================
// Agency Group — Incidents: Global Map API
// app/api/incidents/global-map/route.ts
//
// GET /api/incidents/global-map?window_hours=24&fresh=false
//   Returns a GlobalIncidentMap aggregating all incidents in the given window.
//   Set fresh=true to bypass the 60-second Redis cache.
//
// Auth: Bearer token via REALITY_API_SECRET env var.
//
// TypeScript strict — 0 errors
// =============================================================================

import { type NextRequest, NextResponse } from 'next/server'
import { buildGlobalIncidentMap }         from '@/lib/incidents/globalIncidentMap'
import { safeCompare }                    from '@/lib/safeCompare'

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 })
}

function verifyBearer(request: NextRequest): boolean {
  const secret = process.env.REALITY_API_SECRET
  if (!secret) return false

  const authHeader = request.headers.get('authorization') ?? ''
  const [scheme, token] = authHeader.split(' ')
  return scheme === 'Bearer' && !!token && safeCompare(token, secret)
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyBearer(request)) return unauthorized()

  const { searchParams } = request.nextUrl
  const windowParam = searchParams.get('window_hours')
  const freshParam  = searchParams.get('fresh')

  let windowHours = 24
  if (windowParam !== null) {
    const parsed = Number(windowParam)
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 8760) {
      return badRequest('window_hours must be a positive number no greater than 8760')
    }
    windowHours = parsed
  }

  const skipCache = freshParam === 'true'

  try {
    const map = await buildGlobalIncidentMap(windowHours, skipCache)
    return NextResponse.json(map)
  } catch (err) {
    console.error('[GlobalMap API] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
