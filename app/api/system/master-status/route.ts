// =============================================================================
// Agency Group — Master System Status API Route
// app/api/system/master-status/route.ts
//
// GET  /api/system/master-status              → latest cached snapshot
// GET  /api/system/master-status?mode=live    → live computation
// GET  /api/system/master-status?mode=history → snapshot history
// POST /api/system/master-status              → capture (requires auth)
//
// TypeScript strict — 0 errors.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import {
  captureSystemSnapshot,
  getLatestSnapshot,
  getSnapshotHistory,
  SYSTEM_IDENTITY,
} from '@/lib/system/masterSystemStatus'
import { logger as log } from '@/lib/observability/logger'

export const runtime = 'nodejs'
export const maxDuration = 120

// ─── Auth ─────────────────────────────────────────────────────────────────────

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  const expectedKey =
    process.env.API_SECRET_KEY ?? process.env.INTERNAL_API_KEY ?? ''
  if (!token || !expectedKey) return false
  return safeCompare(token, expectedKey)
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('mode') ?? 'cached'
  const limitParam = searchParams.get('limit')
  const limit = limitParam ? Math.min(100, Math.max(1, parseInt(limitParam, 10) || 10)) : 10

  try {
    if (mode === 'live') {
      log.info('[master-status] live capture requested')
      const snapshot = await captureSystemSnapshot()
      return NextResponse.json({
        system: SYSTEM_IDENTITY,
        snapshot,
        mode: 'live',
      })
    }

    if (mode === 'history') {
      const history = await getSnapshotHistory(limit)
      return NextResponse.json({
        system: SYSTEM_IDENTITY,
        history,
        count: history.length,
        mode: 'history',
      })
    }

    // Default: return latest cached snapshot
    const snapshot = await getLatestSnapshot()
    if (!snapshot) {
      // No snapshot yet — run a live capture
      const fresh = await captureSystemSnapshot()
      return NextResponse.json({
        system: SYSTEM_IDENTITY,
        snapshot: fresh,
        mode: 'live_first',
      })
    }

    return NextResponse.json({
      system: SYSTEM_IDENTITY,
      snapshot,
      mode: 'cached',
    })
  } catch (err) {
    log.warn('[master-status] GET failed', { error: String(err) })
    return NextResponse.json(
      { error: 'Failed to retrieve system status', details: String(err) },
      { status: 500 }
    )
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const action = body.action as string | undefined

  if (action === 'capture' || action === 'full-audit') {
    try {
      if (action === 'full-audit') {
        log.info('[master-status] full audit requested', { system: SYSTEM_IDENTITY.codename })
      }
      const snapshot = await captureSystemSnapshot()

      if (action === 'full-audit') {
        log.info('[master-status] full audit complete', {
          grade: snapshot.system_grade,
          score: snapshot.system_score,
          healthyLayers: snapshot.healthy_layer_count,
          passCriteria: snapshot.go_live_pass_count,
          moatScore: snapshot.system_moat_score,
          revenueReadiness: snapshot.revenue_readiness_score,
        })
      }

      return NextResponse.json({
        system: SYSTEM_IDENTITY,
        snapshot,
        action,
        timestamp: new Date().toISOString(),
      })
    } catch (err) {
      log.warn('[master-status] POST capture failed', { error: String(err) })
      return NextResponse.json(
        { error: 'Snapshot capture failed', details: String(err) },
        { status: 500 }
      )
    }
  }

  return NextResponse.json(
    { error: 'Unknown action. Use: capture | full-audit' },
    { status: 400 }
  )
}
