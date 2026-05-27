// GET|POST /api/ml/data-truth
// Wave 51 Phase 7 — ML/Data Truth Hardening

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { runMlDataTruthHardening } from '@/lib/ml/mlDataTruthHardening'

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
  const report = await runMlDataTruthHardening()
  return NextResponse.json({
    status:                       'ML_DATA_TRUTH',
    ml_status:                    report.ml_status,
    ml_truth_score:               report.ml_truth_score,
    models_stable:                report.models_stable,
    models_drifted:               report.models_drifted,
    models_needing_retrain:       report.models_needing_retrain,
    feature_lineage_verified_pct: report.feature_lineage_verified_pct,
    blocker_count:                report.blockers.length,
    ml_truth_hash:                report.ml_truth_hash,
    generated_at:                 report.generated_at,
  })
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* body optional */ }
  const tenantId = typeof body['tenant_id'] === 'string' ? body['tenant_id'] : undefined
  const report   = await runMlDataTruthHardening(tenantId)
  return NextResponse.json(report)
}
