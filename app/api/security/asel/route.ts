// GET|POST /api/security/asel
// Wave 58 — Autonomous Security Execution Layer

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import {
  ASEL_ORCHESTRATOR,
  ASEL_DEFENSE_LOOP,
  AUTO_HEALING_ENGINE,
  SECURITY_GATE,
  DR_ORCHESTRATOR,
  SELF_CERTIFY_SYSTEM,
  FREEZE_CAPITAL_FLOW,
  ASEL_GUARDRAILS,
  type ASELRequest,
} from '@/lib/security/asel'

export const runtime     = 'nodejs'
export const dynamic     = 'force-dynamic'
export const maxDuration = 60

function authorized(req: NextRequest): boolean {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) return false
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  try { return timingSafeEqual(Buffer.from(token), Buffer.from(secret)) }
  catch { return false }
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const view = req.nextUrl.searchParams.get('view') ?? 'certify'

  if (view === 'certify') {
    const cert = await SELF_CERTIFY_SYSTEM()
    return NextResponse.json({
      status:          'ASEL_SELF_CERTIFICATION',
      overall_status:  cert.overall_status,
      red_team_score:  cert.red_team.detection_rate_pct,
      log_integrity:   cert.log_integrity.valid,
      capital_safe:    cert.capital_safety.capital_safe,
      vault_status:    cert.security_audit.status,
      guardrails:      ASEL_GUARDRAILS,
      cert_hash:       cert.cert_hash,
      generated_at:    cert.generated_at,
    })
  }

  if (view === 'dr')    return NextResponse.json(await DR_ORCHESTRATOR())
  if (view === 'heal')  return NextResponse.json({ healing_results: await AUTO_HEALING_ENGINE() })

  if (view === 'full')  return NextResponse.json(await SELF_CERTIFY_SYSTEM())

  return NextResponse.json({ error: 'Invalid view — use: certify|dr|heal|full' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /**/ }

  const action   = String(body['action'] ?? 'orchestrate')
  const tenantId = typeof body['tenant_id'] === 'string' ? body['tenant_id'] : undefined

  if (action === 'certify')  return NextResponse.json(await SELF_CERTIFY_SYSTEM(tenantId))
  if (action === 'heal')     return NextResponse.json({ healing_results: await AUTO_HEALING_ENGINE(tenantId) })
  if (action === 'dr')       return NextResponse.json(await DR_ORCHESTRATOR(tenantId))

  if (action === 'freeze') {
    await FREEZE_CAPITAL_FLOW(undefined, tenantId)
    return NextResponse.json({ status: 'CAPITAL_FLOW_FROZEN', tenant_id: tenantId })
  }

  if (action === 'gate') {
    const reqBody = body['request'] as Record<string, unknown> | undefined
    if (!reqBody?.['ip'] || !reqBody?.['path']) {
      return NextResponse.json({ error: 'request.ip and request.path required' }, { status: 400 })
    }
    const aselReq: ASELRequest = {
      ip:           String(reqBody['ip']),
      path:         String(reqBody['path']),
      method:       String(reqBody['method'] ?? 'GET'),
      user_id:      reqBody['user_id'] as string | undefined,
      user_agent:   reqBody['user_agent'] as string | undefined,
      payload_size: reqBody['payload_size'] as number | undefined,
    }
    return NextResponse.json(await SECURITY_GATE(aselReq))
  }

  if (action === 'orchestrate') {
    const event = body['event'] as Record<string, unknown> | undefined
    if (!event?.['type']) return NextResponse.json({ error: 'event.type required' }, { status: 400 })
    const result = await ASEL_ORCHESTRATOR({ type: String(event['type']), description: event['description'] as string | undefined, severity: event['severity'] as 'CRITICAL' | 'HIGH' | 'MEDIUM' | undefined }, undefined, tenantId)
    return NextResponse.json(result)
  }

  if (action === 'defense') {
    const event = body['event'] as Record<string, unknown> | undefined
    if (!event?.['type']) return NextResponse.json({ error: 'event.type required' }, { status: 400 })
    return NextResponse.json(await ASEL_DEFENSE_LOOP({ type: String(event['type']), severity: event['severity'] as 'CRITICAL' | 'HIGH' | 'MEDIUM' | undefined }, tenantId))
  }

  return NextResponse.json({ error: 'Unknown action — use: certify|heal|dr|freeze|gate|orchestrate|defense' }, { status: 400 })
}
