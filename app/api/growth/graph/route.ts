// Agency Group — Growth Graph API Route
// app/api/growth/graph/route.ts
// Unified endpoint for Economic Growth Graph + Capital-Aware Segmentation.
// TypeScript strict — 0 errors

export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { requireAuth } from '@/lib/middleware/portalAuthGuard'
import {
  getGraphSnapshot,
  computeEconomicVelocity,
  getNodeConnections,
  recordEconomicSignal,
  type NodeType,
  type EconomicSignalType,
} from '@/lib/growth/economicGrowthGraph'
import {
  generateSegmentationReport,
  getSegmentInvestors,
  detectChurnRisk,
  type InvestorSegment,
} from '@/lib/growth/capitalSegmentationEngine'
import { runFullCollection } from '@/lib/growth/growthSignalCollector'
import log from '@/lib/logger'

// ─── Constants ────────────────────────────────────────────────────────────────

const CANONICAL_TENANT =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

const ALL_SEGMENTS: InvestorSegment[] = [
  'HIGH_CAPITAL_VELOCITY',
  'INSTITUTIONAL_BUYER',
  'OPPORTUNISTIC_BIDDER',
  'DORMANT_CAPITAL',
  'HIGH_ROI_CONTRIBUTOR',
  'EMERGING_INVESTOR',
  'WHALE',
]

// ─── Admin Bearer check ───────────────────────────────────────────────────────

function isAdminBearer(req: Request): boolean {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) return false
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return false
  const token = authHeader.slice(7).trim()
  if (!token) return false
  try {
    const bufA = Buffer.from(token)
    const bufB = Buffer.from(secret)
    if (bufA.length !== bufB.length) return false
    return timingSafeEqual(bufA, bufB)
  } catch {
    return false
  }
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url)
    const mode = searchParams.get('mode')
    const nodeId = searchParams.get('node_id')
    const segment = searchParams.get('segment')

    const tenantId = CANONICAL_TENANT

    // GET ?node_id=xxx — node connections
    if (nodeId) {
      const depth = parseInt(searchParams.get('depth') ?? '1', 10)
      const connections = await getNodeConnections(nodeId, tenantId, depth)
      return NextResponse.json({ ok: true, data: connections })
    }

    // GET ?segment=HIGH_CAPITAL_VELOCITY (or any segment)
    if (segment) {
      const seg = segment as InvestorSegment
      if (!ALL_SEGMENTS.includes(seg)) {
        return NextResponse.json(
          { ok: false, error: `Invalid segment: ${segment}` },
          { status: 400 },
        )
      }
      const investors = await getSegmentInvestors(seg, tenantId)
      return NextResponse.json({ ok: true, data: investors })
    }

    // GET ?mode=snapshot
    if (mode === 'snapshot') {
      const snapshot = await getGraphSnapshot(tenantId)
      return NextResponse.json({ ok: true, data: snapshot })
    }

    // GET ?mode=velocity
    if (mode === 'velocity') {
      const velocity = await computeEconomicVelocity(tenantId)
      return NextResponse.json({ ok: true, data: velocity })
    }

    // GET ?mode=segmentation
    if (mode === 'segmentation') {
      const report = await generateSegmentationReport(tenantId)
      return NextResponse.json({ ok: true, data: report })
    }

    // GET ?mode=churn-risk
    if (mode === 'churn-risk') {
      const churnRisk = await detectChurnRisk(tenantId)
      return NextResponse.json({ ok: true, data: churnRisk })
    }

    // Default: return snapshot
    const snapshot = await getGraphSnapshot(tenantId)
    return NextResponse.json({ ok: true, data: snapshot })
  } catch (err) {
    log.info('[growth/graph] GET error', { err: String(err) })
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = (await req.json()) as Record<string, unknown>
    const action = body.action as string | undefined
    const tenantId = CANONICAL_TENANT

    // action: 'collect' — Admin Bearer required
    if (action === 'collect') {
      if (!isAdminBearer(req)) {
        return NextResponse.json(
          { ok: false, error: 'Unauthorized — admin bearer required' },
          { status: 401 },
        )
      }
      const sinceHours =
        typeof body.since_hours === 'number' ? body.since_hours : 24
      const result = await runFullCollection(tenantId, sinceHours)
      return NextResponse.json({ ok: true, data: result })
    }

    // action: 'signal' — requireAuth
    if (action === 'signal') {
      const authResult = await requireAuth(req)
      if (authResult instanceof Response) return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 },
      )

      const fromEntityId = body.from_entity_id as string | undefined
      const fromType = body.from_type as NodeType | undefined
      const toEntityId = body.to_entity_id as string | undefined
      const toType = body.to_type as NodeType | undefined
      const signalType = body.signal_type as EconomicSignalType | undefined
      const eurCentsValue =
        typeof body.eur_cents_value === 'number' ? body.eur_cents_value : undefined

      if (!fromEntityId || !fromType || !toEntityId || !toType || !signalType) {
        return NextResponse.json(
          { ok: false, error: 'Missing required fields: from_entity_id, from_type, to_entity_id, to_type, signal_type' },
          { status: 400 },
        )
      }

      await recordEconomicSignal({
        tenant_id: tenantId,
        from_entity_id: fromEntityId,
        from_type: fromType,
        to_entity_id: toEntityId,
        to_type: toType,
        signal_type: signalType,
        eur_cents_value: eurCentsValue,
        metadata: { source: 'manual_api', user_id: authResult.user_id },
      })

      return NextResponse.json({ ok: true, message: 'Signal recorded' })
    }

    return NextResponse.json(
      { ok: false, error: `Unknown action: ${action ?? '(none)'}` },
      { status: 400 },
    )
  } catch (err) {
    log.info('[growth/graph] POST error', { err: String(err) })
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
