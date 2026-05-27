// GET|POST /api/audit/system-reality
// Wave 51 Phase 1 — Full System Reality Audit

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { runFullSystemRealityAudit } from '@/lib/audit/fullSystemRealityAudit'

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
  const graph = await runFullSystemRealityAudit()
  return NextResponse.json({
    status:                'SYSTEM_REALITY_AUDIT',
    reality_grade:         graph.reality_grade,
    reality_coverage_pct:  graph.reality_coverage_pct,
    system_truth_score:    graph.system_truth_score,
    total_domains:         graph.total_domains,
    fully_real_domains:    graph.fully_real_domains,
    unconfigured_domains:  graph.unconfigured_domains,
    issue_count:           graph.issues.length,
    graph_hash:            graph.graph_hash,
    generated_at:          graph.generated_at,
  })
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* body optional */ }
  const tenantId = typeof body['tenant_id'] === 'string' ? body['tenant_id'] : undefined
  const graph    = await runFullSystemRealityAudit(tenantId)
  return NextResponse.json(graph)
}
