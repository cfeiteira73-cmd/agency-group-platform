// GET|POST /api/security/global-os
// Wave 57 — Global Security & DR Operating System

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import {
  SYSTEM_DEFENSE_LOOP,
  SECURITY_ORCHESTRATOR,
  CAPITAL_FREEZE,
  DR_HEALTH_CHECK,
  runRedTeamSimulation,
  checkWAFHealth,
  checkVaultHealth,
  verifyLogChainIntegrity,
  WAF_POLICY,
  SECRET_POLICY,
  DISASTER_RECOVERY,
  RED_TEAM_SIMULATION,
  GLOBAL_SECURITY_PRINCIPLES,
  IMMUTABLE_LOGGING,
  SOC_MATRIX,
} from '@/lib/security/globalSecurityOS'

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

  const view = req.nextUrl.searchParams.get('view') ?? 'defense'

  if (view === 'defense') {
    const d = await SYSTEM_DEFENSE_LOOP()
    return NextResponse.json({
      status:          'SECURITY_DEFENSE_LOOP',
      waf_status:      d.waf_status,
      vault_status:    d.vault_status,
      logs_integrity:  d.logs_integrity,
      dr_status:       d.dr_status,
      any_failure:     d.any_failure,
      escalated:       d.escalated,
      generated_at:    d.generated_at,
    }, { status: d.any_failure ? 503 : 200 })
  }

  if (view === 'waf')      return NextResponse.json(await checkWAFHealth())
  if (view === 'vault')    return NextResponse.json(await checkVaultHealth())
  if (view === 'logs')     return NextResponse.json(await verifyLogChainIntegrity())
  if (view === 'dr')       return NextResponse.json(await DR_HEALTH_CHECK())
  if (view === 'red-team') return NextResponse.json(await runRedTeamSimulation())

  if (view === 'policy') {
    return NextResponse.json({
      waf_policy:          WAF_POLICY,
      secret_policy:       SECRET_POLICY,
      disaster_recovery:   DISASTER_RECOVERY,
      red_team:            RED_TEAM_SIMULATION,
      immutable_logging:   IMMUTABLE_LOGGING,
      soc_matrix:          SOC_MATRIX,
      global_principles:   GLOBAL_SECURITY_PRINCIPLES,
    })
  }

  return NextResponse.json({ error: 'Invalid view — use: defense|waf|vault|logs|dr|red-team|policy' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /**/ }

  const action = String(body['action'] ?? 'defense')

  if (action === 'defense')    return NextResponse.json(await SYSTEM_DEFENSE_LOOP(body['tenant_id'] as string | undefined))
  if (action === 'red-team')   return NextResponse.json(await runRedTeamSimulation(body['tenant_id'] as string | undefined))
  if (action === 'dr-check')   return NextResponse.json(await DR_HEALTH_CHECK(body['tenant_id'] as string | undefined))
  if (action === 'log-chain')  return NextResponse.json(await verifyLogChainIntegrity(body['tenant_id'] as string | undefined))

  if (action === 'freeze-capital') {
    const result = await CAPITAL_FREEZE({ anomalyDetected: true, description: String(body['reason'] ?? 'Manual freeze via API') })
    return NextResponse.json({ status: 'CAPITAL_FREEZE_PROTOCOL', ...result })
  }

  if (action === 'soc-event') {
    const event = body['event'] as Record<string, unknown> | undefined
    if (!event?.['type']) return NextResponse.json({ error: 'event.type required' }, { status: 400 })
    const result = await SECURITY_ORCHESTRATOR({ type: String(event['type']), description: String(event['description'] ?? ''), severity: event['severity'] as 'CRITICAL' | 'HIGH' | 'MEDIUM' | undefined })
    return NextResponse.json({ status: 'SOC_EVENT_PROCESSED', ...result })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
