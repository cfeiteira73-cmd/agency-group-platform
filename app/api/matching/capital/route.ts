// GET|POST /api/matching/capital
// Wave 54 Phase 5 — Capital Matching Engine

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { runCapitalMatching } from '@/lib/matching/capitalMatchingEngine'

export const runtime = 'nodejs'
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
  const report = await runCapitalMatching()
  return NextResponse.json({ status: 'CAPITAL_MATCHING', total_matches: report.total_matches, perfect_matches: report.perfect_matches, strong_matches: report.strong_matches, good_matches: report.good_matches, avg_score: report.avg_score, coverage_pct: report.coverage_pct, matching_hash: report.matching_hash })
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /**/ }
  const tenantId = typeof body['tenant_id'] === 'string' ? body['tenant_id'] : undefined
  return NextResponse.json(await runCapitalMatching(tenantId))
}
