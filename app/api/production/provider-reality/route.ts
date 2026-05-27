// GET|POST /api/production/provider-reality
// Wave 51 Phase 4 — Provider Reality Hardening

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { runProviderRealityHardening } from '@/lib/production/providerRealityHardening'

export const runtime    = 'nodejs'
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
  const report = await runProviderRealityHardening()
  return NextResponse.json({
    status:               'PROVIDER_REALITY_HARDENING',
    reality_status:       report.reality_status,
    provider_truth_index: report.provider_truth_index,
    providers_live:       report.providers_live,
    providers_dead:       report.providers_dead,
    circuit_breakers_open: report.circuit_breakers_open,
    fallbacks_proven:     report.fallbacks_proven,
    fallbacks_unproven:   report.fallbacks_unproven,
    reality_report_hash:  report.reality_report_hash,
    generated_at:         report.generated_at,
  })
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* body optional */ }
  const tenantId = typeof body['tenant_id'] === 'string' ? body['tenant_id'] : undefined
  const report   = await runProviderRealityHardening(tenantId)
  return NextResponse.json(report)
}
