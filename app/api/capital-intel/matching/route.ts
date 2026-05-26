// Agency Group — Capital Intel Matching API
// app/api/capital-intel/matching/route.ts
// TypeScript strict — 0 errors

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware/portalAuthGuard'
import {
  buildInvestorCapitalProfile,
  getCapitalAppetiteSummary,
  getTopInvestorsForOpportunity,
  updateDemandSignal,
} from '@/lib/capital-intel/capitalIntelligenceEngine'
import {
  matchOpportunityToInvestors,
  runBatchMatching,
  recordInvestorResponse,
  getMatchesForInvestor,
  getMatchesForOpportunity,
  type OpportunityInvestorMatch,
} from '@/lib/capital-intel/investorMatchingEngine'
import {
  simulateROI,
  getLatestSimulation,
  batchSimulate,
} from '@/lib/capital-intel/roiDistributionSimulator'

export const runtime = 'nodejs'
export const maxDuration = 120

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: Request): Promise<NextResponse> {
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth as NextResponse

  const { searchParams } = new URL(req.url)
  const tenantId = auth.tenant_id
  const investorId = searchParams.get('investor_id')
  const opportunityId = searchParams.get('opportunity_id')
  const mode = searchParams.get('mode')

  try {
    // ?mode=top-matches&opportunity_id=...
    if (mode === 'top-matches' && opportunityId) {
      const limitParam = searchParams.get('limit')
      const limit = limitParam != null ? parseInt(limitParam, 10) : 10
      const topInvestors = await getTopInvestorsForOpportunity(opportunityId, tenantId, limit)
      return NextResponse.json({ data: topInvestors })
    }

    // ?mode=simulate&opportunity_id=...
    if (mode === 'simulate' && opportunityId) {
      const simulation = await simulateROI(opportunityId, tenantId)
      return NextResponse.json({ data: simulation })
    }

    // ?investor_id=...
    if (investorId) {
      const [profile, matches] = await Promise.all([
        buildInvestorCapitalProfile(investorId, tenantId),
        getMatchesForInvestor(investorId, tenantId),
      ])
      return NextResponse.json({ data: { profile, matches } })
    }

    // ?opportunity_id=...
    if (opportunityId) {
      const [matches, simulation] = await Promise.all([
        getMatchesForOpportunity(opportunityId, tenantId),
        getLatestSimulation(opportunityId, tenantId),
      ])
      return NextResponse.json({ data: { matches, simulation } })
    }

    // default: capital appetite summary
    const summary = await getCapitalAppetiteSummary(tenantId)
    return NextResponse.json({ data: summary })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Internal error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<NextResponse> {
  // Admin Bearer required for POST actions
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth as NextResponse
  if (auth.method !== 'bearer' && auth.method !== 'cron') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const tenantId = auth.tenant_id

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const action = body.action as string | undefined

  try {
    switch (action) {
      case 'run-batch-matching': {
        const result = await runBatchMatching(tenantId)
        return NextResponse.json({ data: result })
      }

      case 'batch-simulate': {
        const oppIds = Array.isArray(body.opportunity_ids)
          ? (body.opportunity_ids as string[])
          : undefined
        const result = await batchSimulate(tenantId, oppIds)
        return NextResponse.json({ data: result })
      }

      case 'record-response': {
        const matchId = body.match_id as string | undefined
        const response = body.response as OpportunityInvestorMatch['investor_response']
        if (!matchId || !response) {
          return NextResponse.json({ error: 'match_id and response required' }, { status: 400 })
        }
        await recordInvestorResponse(matchId, response, tenantId)
        return NextResponse.json({ data: { ok: true } })
      }

      case 'update-demand': {
        const opportunityId = body.opportunity_id as string | undefined
        const eventType = body.event_type as 'VIEW' | 'BID' | 'CLOSE' | 'REJECT' | undefined
        if (!opportunityId || !eventType) {
          return NextResponse.json({ error: 'opportunity_id and event_type required' }, { status: 400 })
        }
        const validEvents: Array<'VIEW' | 'BID' | 'CLOSE' | 'REJECT'> = ['VIEW', 'BID', 'CLOSE', 'REJECT']
        if (!validEvents.includes(eventType)) {
          return NextResponse.json({ error: 'Invalid event_type' }, { status: 400 })
        }
        await updateDemandSignal(opportunityId, tenantId, eventType)
        return NextResponse.json({ data: { ok: true } })
      }

      case 'match-opportunity': {
        const opportunityId = body.opportunity_id as string | undefined
        if (!opportunityId) {
          return NextResponse.json({ error: 'opportunity_id required' }, { status: 400 })
        }
        const matches = await matchOpportunityToInvestors(opportunityId, tenantId)
        return NextResponse.json({ data: { matches_created: matches.length, matches } })
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action ?? '(none)'}` }, { status: 400 })
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Internal error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
