// GET|POST /api/ml/absolute-truth
// Wave 52 Phase 7 — Absolute ML Data Truth

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { runAbsoluteMlDataTruth } from '@/lib/ml/absoluteMlDataTruth'

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
  const report = await runAbsoluteMlDataTruth()
  return NextResponse.json({
    status:                   'ABSOLUTE_ML_DATA_TRUTH',
    ml_truth_grade:           report.ml_truth_grade,
    overall_score:            report.overall_score,
    models_evaluated:         report.models_evaluated,
    models_certified:         report.models_certified,
    drift_significant_count:  report.drift_significant_count,
    leakage_detected_count:   report.leakage_detected_count,
    overfit_detected_count:   report.overfit_detected_count,
    calibration_passed_count: report.calibration_passed_count,
    blockers:                 report.blockers,
    ml_truth_hash:            report.ml_truth_hash,
    generated_at:             report.generated_at,
  })
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* body optional */ }
  const tenantId = typeof body['tenant_id'] === 'string' ? body['tenant_id'] : undefined
  const report   = await runAbsoluteMlDataTruth(tenantId)
  return NextResponse.json(report)
}
