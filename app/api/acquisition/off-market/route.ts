// GET|POST /api/acquisition/off-market
// Wave 54 Phase 3 — Off-Market Acquisition Engine

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { getSourceRegistry, runAcquisitionPipeline } from '@/lib/acquisition/offMarketAcquisitionEngine'

export const runtime = 'nodejs'
export const maxDuration = 30

function authorized(req: NextRequest): boolean {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) return false
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  try { return timingSafeEqual(Buffer.from(token), Buffer.from(secret)) }
  catch { return false }
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sp  = req.nextUrl.searchParams
  const view = sp.get('view') ?? 'pipeline'
  if (view === 'sources') {
    const registry = await getSourceRegistry()
    return NextResponse.json({ status: 'SOURCE_REGISTRY', total_sources: registry.total_sources, active_sources: registry.active_sources, sources_by_type: registry.sources_by_type, avg_reliability: registry.avg_reliability, high_frequency_sources: registry.high_frequency_sources })
  }
  const pipeline = await runAcquisitionPipeline()
  return NextResponse.json({ status: 'ACQUISITION_PIPELINE', total_opportunities: pipeline.total_opportunities, avg_opportunity_score: pipeline.avg_opportunity_score, duplicates_detected: pipeline.duplicates_detected, by_stage: pipeline.by_stage })
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /**/ }
  const tenantId = typeof body['tenant_id'] === 'string' ? body['tenant_id'] : undefined
  const view = body['view'] ?? 'pipeline'
  if (view === 'sources') {
    return NextResponse.json(await getSourceRegistry(tenantId))
  }
  return NextResponse.json(await runAcquisitionPipeline(tenantId))
}
