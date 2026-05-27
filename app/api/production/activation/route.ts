// GET|POST /api/production/activation
// Wave 50 Phase 1 — Live Provider Activation Engine

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { runLiveProductionActivationEngine } from '@/lib/production/liveProductionActivationEngine'

export const runtime    = 'nodejs'
export const maxDuration = 60

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
  const report = await runLiveProductionActivationEngine()
  return NextResponse.json({
    status: 'LIVE_PROVIDER_ACTIVATION_ENGINE',
    activation_score: report.activation_score,
    providers_activated: report.providers_activated,
    providers_total: report.providers_total,
    sla_compliant: report.sla_compliant,
    issues_count: report.issues.length,
    activation_proof_hash: report.activation_proof_hash,
    assessed_at: report.assessed_at,
  })
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* body optional */ }
  const tenantId = typeof body.tenant_id === 'string' ? body.tenant_id : undefined

  const report = await runLiveProductionActivationEngine(tenantId)
  return NextResponse.json({
    report_id: report.report_id,
    tenant_id: report.tenant_id,
    assessed_at: report.assessed_at,
    activation_score: report.activation_score,
    providers_activated: report.providers_activated,
    providers_configured_not_active: report.providers_configured_not_active,
    providers_failed: report.providers_failed,
    providers_unconfigured: report.providers_unconfigured,
    providers_total: report.providers_total,
    sla_target_pct: report.sla_target_pct,
    sla_compliance_pct: report.sla_compliance_pct,
    sla_compliant: report.sla_compliant,
    active_fallbacks: report.active_fallbacks.length,
    fallback_failures: report.fallback_failures.length,
    activation_proof_hash: report.activation_proof_hash,
    mesh_report_id: report.mesh_report_id,
    issues: report.issues,
    recommendations: report.recommendations,
  })
}
