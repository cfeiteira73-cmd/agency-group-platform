// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Opportunities Feed API Route (Wave 42)
// app/api/opportunities/feed/route.ts
//
// GET  — feed generation, latest feed, history, active list, single detail,
//         run-detection cron-safe mode
// POST — run-detection (admin), rescore (admin), capture (requireAuth)
// =============================================================================

export const runtime    = 'nodejs'
export const maxDuration = 120

import { NextResponse }             from 'next/server'
import { requireAuth }              from '@/lib/middleware/portalAuthGuard'
import {
  generateFeed,
  getLatestFeed,
  getFeedHistory,
}                                   from '@/lib/opportunity/opportunityFeedEngine'
import {
  getActiveOpportunities,
  runDetectionCycle,
}                                   from '@/lib/opportunity/opportunityDetectionEngine'
import { batchRescoreOpportunities } from '@/lib/opportunity/opportunityScorer'
import { supabaseAdmin }            from '@/lib/supabase'
import log                          from '@/lib/logger'
import type { OpportunityType }     from '@/lib/opportunity/opportunityDetectionEngine'

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: Request): Promise<Response> {
  const authResult = await requireAuth(req)
  if (authResult instanceof Response) return authResult

  const { tenant_id } = authResult
  const url = new URL(req.url)
  const mode           = url.searchParams.get('mode') ?? 'feed'
  const market         = url.searchParams.get('market') ?? undefined
  const city           = url.searchParams.get('city')   ?? undefined
  const limitParam     = url.searchParams.get('limit')
  const limit          = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 200) : 50
  const opportunity_id = url.searchParams.get('opportunity_id')
  const type_param     = url.searchParams.get('type') as OpportunityType | null
  const min_score_param = url.searchParams.get('min_score')

  try {
    // Single opportunity detail
    if (opportunity_id) {
      const { data, error } = await (supabaseAdmin as any)
        .from('detected_opportunities')
        .select('*')
        .eq('tenant_id', tenant_id)
        .eq('opportunity_id', opportunity_id)
        .single()

      if (error || !data) {
        return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
      }

      return NextResponse.json({ opportunity: data })
    }

    // Run detection cycle (cron-safe GET)
    if (mode === 'run-detection') {
      const result = await runDetectionCycle(tenant_id)
      return NextResponse.json({ ok: true, ...result })
    }

    // Latest feed
    if (mode === 'latest') {
      const feed = await getLatestFeed(tenant_id, market)
      if (!feed) {
        return NextResponse.json({ error: 'No feed found' }, { status: 404 })
      }
      return NextResponse.json({ feed })
    }

    // Feed history
    if (mode === 'history') {
      const history = await getFeedHistory(tenant_id, limit)
      return NextResponse.json({ history, count: history.length })
    }

    // Active opportunities list
    if (mode === 'active') {
      const opportunities = await getActiveOpportunities(tenant_id, {
        market,
        city,
        type:      type_param ?? undefined,
        min_score: min_score_param ? parseFloat(min_score_param) : undefined,
        limit,
      })
      return NextResponse.json({
        opportunities,
        count: opportunities.length,
      })
    }

    // Default: generate fresh feed
    const feed = await generateFeed(tenant_id, { market, city, limit })
    return NextResponse.json({ feed })
  } catch (err) {
    log.error('[api/opportunities/feed] GET error', err, { route: 'GET /api/opportunities/feed' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  const authResult = await requireAuth(req)
  if (authResult instanceof Response) return authResult

  const { tenant_id, role } = authResult

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const action = String(body.action ?? '')

  try {
    // Admin-only actions
    if (action === 'run-detection') {
      if (!isAdminRole(role)) {
        return NextResponse.json({ error: 'Forbidden: admin role required' }, { status: 403 })
      }
      const result = await runDetectionCycle(tenant_id)
      return NextResponse.json({ ok: true, ...result })
    }

    if (action === 'rescore') {
      if (!isAdminRole(role)) {
        return NextResponse.json({ error: 'Forbidden: admin role required' }, { status: 403 })
      }
      const investorDemandMap = body.investor_demand_map as Record<string, number> | undefined
      const result = await batchRescoreOpportunities(tenant_id, investorDemandMap)
      return NextResponse.json({ ok: true, ...result })
    }

    // User action: capture opportunity
    if (action === 'capture') {
      const opportunity_id = String(body.opportunity_id ?? '')
      if (!opportunity_id) {
        return NextResponse.json({ error: 'opportunity_id required' }, { status: 400 })
      }

      const now = new Date().toISOString()
      const { error } = await (supabaseAdmin as any)
        .from('detected_opportunities')
        .update({ status: 'CAPTURED', captured_at: now })
        .eq('tenant_id', tenant_id)
        .eq('opportunity_id', opportunity_id)
        .eq('status', 'ACTIVE')

      if (error) {
        log.error('[api/opportunities/feed] capture failed', error, {
          route: 'POST /api/opportunities/feed',
          opportunity_id,
        })
        return NextResponse.json({ error: 'Failed to capture opportunity' }, { status: 500 })
      }

      log.info('[api/opportunities/feed] Opportunity captured', {
        tenant_id,
        opportunity_id,
        captured_by: authResult.user_id,
      })

      return NextResponse.json({ ok: true, opportunity_id, status: 'CAPTURED', captured_at: now })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (err) {
    log.error('[api/opportunities/feed] POST error', err, {
      route: 'POST /api/opportunities/feed',
      action,
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isAdminRole(role: string | null): boolean {
  return role === 'tenant_admin' || role === 'admin' || role === 'super_admin' || role === 'cron_service'
}
