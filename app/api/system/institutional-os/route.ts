// GET|POST /api/system/institutional-os
// Wave 56 — Institutional Operating System
// Full autonomous production self-test + runtime audit

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import {
  runtimeAudit,
  finalSystemSelfTest,
  autoHealingEngine,
  capitalRoutingEngine,
  telemetryBus,
  SYSTEM_GUARDRAILS,
} from '@/lib/system/institutionalOS'

export const runtime     = 'nodejs'
export const dynamic     = 'force-dynamic'
export const maxDuration = 120

function authorized(req: NextRequest): boolean {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) return false
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  try { return timingSafeEqual(Buffer.from(token), Buffer.from(secret)) }
  catch { return false }
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp   = req.nextUrl.searchParams
  const view = sp.get('view') ?? 'audit'

  if (view === 'audit') {
    const audit = await runtimeAudit()
    return NextResponse.json({
      status:          'IOS_RUNTIME_AUDIT',
      system_status:   audit.system_status,
      reality_score:   audit.reality_score,
      health_score:    audit.health_score,
      blockers:        audit.blockers,
      capital_safe:    audit.capital_safety_status.capital_safe,
      soc_operational: audit.soc_connectivity.soc_operational,
      guardrails:      SYSTEM_GUARDRAILS,
      generated_at:    audit.generated_at,
    }, { status: audit.system_status === 'NOT_READY' ? 503 : 200 })
  }

  if (view === 'self-test') {
    const test = await finalSystemSelfTest()
    return NextResponse.json({
      status:             'IOS_SELF_TEST',
      final_status:       test.final_status,
      capital_safe:       test.capital_safety.capital_safe,
      soc_operational:    test.soc_status.soc_operational,
      chaos_readiness:    test.chaos_readiness,
      workflow_integrity: test.workflow_integrity,
      certification_hash: test.certification_hash,
      generated_at:       test.generated_at,
    })
  }

  if (view === 'guardrails') {
    return NextResponse.json({ guardrails: SYSTEM_GUARDRAILS })
  }

  return NextResponse.json({ error: 'Invalid view — use: audit | self-test | guardrails' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /**/ }

  const action   = String(body['action'] ?? 'self-test')
  const tenantId = typeof body['tenant_id'] === 'string' ? body['tenant_id'] : undefined

  if (action === 'self-test') {
    return NextResponse.json(await finalSystemSelfTest(tenantId))
  }

  if (action === 'heal') {
    const result = await autoHealingEngine(tenantId)
    return NextResponse.json({ status: 'AUTO_HEALING_COMPLETE', ...result })
  }

  if (action === 'match-capital') {
    const result = await capitalRoutingEngine(tenantId)
    return NextResponse.json({ status: 'CAPITAL_ROUTING_COMPLETE', ...result })
  }

  if (action === 'telemetry') {
    const event = body['event'] as { type: string; source: string } | undefined
    if (!event?.type || !event?.source) {
      return NextResponse.json({ error: 'event.type and event.source required' }, { status: 400 })
    }
    await telemetryBus({ ...event, tenant_id: tenantId })
    return NextResponse.json({ status: 'TELEMETRY_PUBLISHED' })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
