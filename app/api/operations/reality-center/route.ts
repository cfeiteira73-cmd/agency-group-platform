// GET|POST /api/operations/reality-center
// Wave 50 Phase 6 — Live Institutional Reality Center

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { runLiveInstitutionalRealityCenter } from '@/lib/operations/liveInstitutionalRealityCenter'

export const runtime    = 'nodejs'
export const maxDuration = 120

function authorized(req: NextRequest): boolean {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization') ?? ''
  const token = header.replace(/^Bearer\s+/i, '')
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(secret))
  } catch { return false }
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const report = await runLiveInstitutionalRealityCenter()
  return NextResponse.json({
    status: 'LIVE_INSTITUTIONAL_REALITY_CENTER',
    reality_center_status: report.reality_center_status,
    global_reality_score: report.global_reality_score,
    operational_readiness: report.operational_readiness,
    investor_confidence: report.investor_confidence,
    reality_center_hash: report.reality_center_hash,
    assessed_at: report.assessed_at,
  })
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* body optional */ }
  const tenantId = typeof body.tenant_id === 'string' ? body.tenant_id : undefined

  const report = await runLiveInstitutionalRealityCenter(tenantId)
  return NextResponse.json({
    report_id: report.report_id,
    tenant_id: report.tenant_id,
    assessed_at: report.assessed_at,
    reality_center_status: report.reality_center_status,
    global_reality_score: report.global_reality_score,
    operational_readiness: report.operational_readiness,
    executive_dashboard: report.executive_dashboard,
    soc_dashboard: report.soc_dashboard,
    treasury_dashboard: report.treasury_dashboard,
    liquidity_dashboard: report.liquidity_dashboard,
    infrastructure_saturation: report.infrastructure_saturation,
    provider_activation_score: report.provider_activation_score,
    money_reality_score: report.money_reality_score,
    soc_reality_score: report.soc_reality_score,
    external_audit_score: report.external_audit_score,
    failure_resilience_score: report.failure_resilience_score,
    wave49_global_score: report.wave49_global_score,
    investor_confidence: report.investor_confidence,
    liquidity_confidence: report.liquidity_confidence,
    predictive_failure_risk: report.predictive_failure_risk,
    operational_risk_heatmap: report.operational_risk_heatmap,
    reality_center_hash: report.reality_center_hash,
    issues: report.issues,
    recommendations: report.recommendations,
  })
}
