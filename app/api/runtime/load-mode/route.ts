// =============================================================================
// Agency Group — Load Mode API
// app/api/runtime/load-mode/route.ts
//
// GET  → returns current LoadStatus for the region
// POST → sets a new LoadMode (body: { mode: LoadMode, set_by?: string })
//
// Auth: Bearer token — INTERNAL_API_TOKEN or CRON_SECRET
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { safeCompare } from '@/lib/safeCompare'
import { getLoadStatus, setLoadMode } from '@/lib/runtime/loadGovernor'
import type { LoadMode } from '@/lib/runtime/loadGovernor'

export const runtime = 'nodejs'

// ─── Auth helper ──────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return false

  const internalToken = process.env.INTERNAL_API_TOKEN
  const cronSecret    = process.env.CRON_SECRET

  if (internalToken && safeCompare(token, internalToken)) return true
  if (cronSecret    && safeCompare(token, cronSecret))    return true
  return false
}

// ─── Valid modes ──────────────────────────────────────────────────────────────

const VALID_MODES = new Set<LoadMode>(['NORMAL', 'STRESSED', 'CRITICAL', 'EMERGENCY'])

function isValidMode(v: unknown): v is LoadMode {
  return typeof v === 'string' && VALID_MODES.has(v as LoadMode)
}

// ─── GET /api/runtime/load-mode ───────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const tenantId = searchParams.get('tenant_id')?.trim() || 'system'

  try {
    const status = await getLoadStatus(tenantId)
    return NextResponse.json(status, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[GET /api/runtime/load-mode]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ─── POST /api/runtime/load-mode ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { mode, set_by, tenant_id } = body

  if (!isValidMode(mode)) {
    return NextResponse.json(
      { error: `mode must be one of: ${[...VALID_MODES].join(', ')}` },
      { status: 400 },
    )
  }

  const tenantId = typeof tenant_id === 'string' && tenant_id ? tenant_id : 'system'
  const setBy    = typeof set_by    === 'string' && set_by    ? set_by    : 'manual'

  try {
    await setLoadMode(tenantId, mode, setBy)
    const status = await getLoadStatus(tenantId)
    return NextResponse.json(status, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/runtime/load-mode]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
