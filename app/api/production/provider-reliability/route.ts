// GET|POST /api/production/provider-reliability
// Wave 52 Phase 4 — Live Provider Reliability Certification (12 providers)

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { runLiveProviderReliabilityCertification } from '@/lib/production/liveProviderReliabilityCertification'

export const runtime     = 'nodejs'
export const maxDuration = 60

function authorized(req: NextRequest): boolean {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization') ?? ''
  const token  = header.replace(/^Bearer\s+/i, '')
  try { return timingSafeEqual(Buffer.from(token), Buffer.from(secret)) }
  catch { return false }
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const report = await runLiveProviderReliabilityCertification()
  return NextResponse.json({
    status:               'PROVIDER_RELIABILITY_CERTIFICATION',
    reliability_grade:    report.reliability_grade,
    overall_score:        report.overall_score,
    total_providers:      report.total_providers,
    certified_count:      report.certified_count,
    degraded_count:       report.degraded_count,
    failed_count:         report.failed_count,
    unconfigured_count:   report.unconfigured_count,
    avg_trust_score:      report.avg_trust_score,
    all_have_fallbacks:   report.all_have_fallbacks,
    all_have_circuit_breakers: report.all_have_circuit_breakers,
    blockers:             report.blockers,
    certification_hash:   report.certification_hash,
    generated_at:         report.generated_at,
  })
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* body optional */ }
  const tenantId = typeof body['tenant_id'] === 'string' ? body['tenant_id'] : undefined
  const report   = await runLiveProviderReliabilityCertification(tenantId)
  return NextResponse.json(report)
}
