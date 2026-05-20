// =============================================================================
// Agency Group — Reality: Failure Map API
// app/api/reality/failure-map/route.ts
//
// GET  /api/reality/failure-map?tenant_id=xxx&fresh=false
//   Returns stored failure map, or builds fresh if not found.
//   Set fresh=true to force a fresh build even when a cached map exists.
//
// POST /api/reality/failure-map
//   Body: { tenant_id: string }
//   Always triggers a fresh build and stores the result.
//
// Auth: Bearer token via REALITY_API_SECRET env var on both methods.
//
// TypeScript strict — 0 errors
// =============================================================================

import { type NextRequest, NextResponse } from 'next/server'
import {
  buildRealityFailureMap,
  getStoredFailureMap,
  storeFailureMap,
} from '@/lib/reality/failureMap'

// ─── Auth ─────────────────────────────────────────────────────────────────────

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
  return scheme === 'Bearer' && token === secret
}

// ─── GET ───────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyBearer(request)) return unauthorized()

  const { searchParams } = request.nextUrl
  const tenantId = searchParams.get('tenant_id')
  const freshParam = searchParams.get('fresh')

  if (!tenantId || tenantId.trim() === '') {
    return badRequest('tenant_id query parameter is required')
  }

  const forceFresh = freshParam === 'true'
  const id = tenantId.trim()

  try {
    // Try stored map first (unless forced fresh)
    if (!forceFresh) {
      const stored = await getStoredFailureMap(id)
      if (stored !== null) {
        return NextResponse.json(stored)
      }
    }

    // Build fresh, store, return
    const map = await buildRealityFailureMap(id)
    void storeFailureMap(map)   // fire-and-forget
    return NextResponse.json(map)
  } catch (err) {
    console.error('[FailureMap API] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST ──────────────────────────────────────────────────────────────────────

interface PostBody {
  tenant_id?: unknown
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!verifyBearer(request)) return unauthorized()

  let body: PostBody
  try {
    body = await request.json() as PostBody
  } catch {
    return badRequest('Invalid JSON body')
  }

  const tenantId = body.tenant_id
  if (typeof tenantId !== 'string' || tenantId.trim() === '') {
    return badRequest('tenant_id is required in the request body')
  }

  const id = tenantId.trim()

  try {
    const map = await buildRealityFailureMap(id)
    await storeFailureMap(map)
    return NextResponse.json(map, { status: 201 })
  } catch (err) {
    console.error('[FailureMap API] POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
