// GET|POST /api/security/soc-reality
// Wave 50 Phase 3 — Live Operational SOC Reality

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { runLiveOperationalSocReality } from '@/lib/security/liveOperationalSocReality'

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
  const report = await runLiveOperationalSocReality()
  return NextResponse.json({
    status: 'LIVE_OPERATIONAL_SOC_REALITY',
    soc_reality_status: report.soc_reality_status,
    soc_reality_score: report.soc_reality_score,
    open_sev1_count: report.open_sev1_count,
    rotations_overdue: report.rotations_overdue,
    plaintext_secret_violations: report.plaintext_secret_violations,
    blockers_count: report.blockers.length,
    assessed_at: report.assessed_at,
  })
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* body optional */ }
  const tenantId = typeof body.tenant_id === 'string' ? body.tenant_id : undefined

  const report = await runLiveOperationalSocReality(tenantId)
  return NextResponse.json({
    report_id: report.report_id,
    tenant_id: report.tenant_id,
    assessed_at: report.assessed_at,
    soc_reality_status: report.soc_reality_status,
    soc_reality_score: report.soc_reality_score,
    alert_routing_proven_count: report.alert_routing_proven_count,
    open_sev1_count: report.open_sev1_count,
    sev1_sla_breached: report.sev1_sla_breached,
    impossible_travel_detected: report.impossible_travel_detected,
    ransomware_signals: report.ransomware_signals,
    rotations_overdue: report.rotations_overdue,
    rotations_due_soon: report.rotations_due_soon,
    rotations_auto_capable: report.rotations_auto_capable,
    plaintext_secret_violations: report.plaintext_secret_violations,
    forensic_snapshots_count: report.forensic_snapshots.length,
    forensic_chain_hash: report.forensic_chain_hash,
    wave49_soc_score: report.wave49_soc_score,
    wave49_soc_status: report.wave49_soc_status,
    soc_reality_hash: report.soc_reality_hash,
    blockers: report.blockers,
    issues: report.issues,
    recommendations: report.recommendations,
  })
}
