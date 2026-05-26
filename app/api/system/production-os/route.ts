// =============================================================================
// Agency Group — SH-ROS | AMI: 22506
// Production OS API Route
// GET  /api/system/production-os              → latest snapshot (or live if none)
// GET  /api/system/production-os?mode=live    → live computation
// GET  /api/system/production-os?mode=gate    → run production readiness gate
// GET  /api/system/production-os?mode=source-quality → source quality report
// GET  /api/system/production-os?mode=history&limit=10 → snapshot history
// POST /api/system/production-os              → actions (requires Bearer auth)
// Wave 44 Agent 6 — Production Lock
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import {
  captureProductionOsSnapshot,
  getLatestSnapshot,
  getSnapshotHistory,
  PRODUCTION_OS_IDENTITY,
} from '@/lib/system/productionOperatingSystem'
import { runProductionReadinessGate } from '@/lib/validation/productionReadinessGate'
import { getSourceQualityReport, rejectUnverifiableSources } from '@/lib/data-quality/sourceValidationEngine'

export const runtime = 'nodejs'
export const maxDuration = 120

const TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

// ── Auth ───────────────────────────────────────────────────────────────────────

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  const expectedKey = process.env.API_SECRET_KEY ?? process.env.INTERNAL_API_KEY ?? ''
  if (!token || !expectedKey) return false
  return safeCompare(token, expectedKey)
}

// ── GET ────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') ?? 'default'
    const limit = parseInt(searchParams.get('limit') ?? '10', 10)

    if (mode === 'live') {
      const snapshot = await captureProductionOsSnapshot(TENANT_ID)
      return NextResponse.json({ ok: true, identity: PRODUCTION_OS_IDENTITY, snapshot })
    }

    if (mode === 'gate') {
      const assessment = await runProductionReadinessGate(TENANT_ID)
      return NextResponse.json({ ok: true, identity: PRODUCTION_OS_IDENTITY, assessment })
    }

    if (mode === 'source-quality') {
      const report = await getSourceQualityReport(TENANT_ID)
      return NextResponse.json({ ok: true, report })
    }

    if (mode === 'history') {
      const history = await getSnapshotHistory(TENANT_ID, limit)
      return NextResponse.json({ ok: true, identity: PRODUCTION_OS_IDENTITY, history, count: history.length })
    }

    // Default: latest snapshot, capture live if none
    const latest = await getLatestSnapshot(TENANT_ID)
    if (latest) {
      return NextResponse.json({ ok: true, identity: PRODUCTION_OS_IDENTITY, snapshot: latest, source: 'cached' })
    }

    const snapshot = await captureProductionOsSnapshot(TENANT_ID)
    return NextResponse.json({ ok: true, identity: PRODUCTION_OS_IDENTITY, snapshot, source: 'live' })
  } catch (e) {
    console.error('[production-os] GET error', e)
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}

// ── POST ───────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = (await request.json()) as { action?: string; dry_run?: boolean }
    const { action, dry_run = false } = body

    if (action === 'capture') {
      const snapshot = await captureProductionOsSnapshot(TENANT_ID)
      return NextResponse.json({ ok: true, snapshot })
    }

    if (action === 'run-gate') {
      const assessment = await runProductionReadinessGate(TENANT_ID)
      return NextResponse.json({ ok: true, assessment })
    }

    if (action === 'reject-unverifiable') {
      const result = await rejectUnverifiableSources(TENANT_ID, dry_run)
      return NextResponse.json({ ok: true, result, dry_run })
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 })
  } catch (e) {
    console.error('[production-os] POST error', e)
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
