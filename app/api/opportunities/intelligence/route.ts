// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Global Opportunity Intelligence API (Wave 42)
// app/api/opportunities/intelligence/route.ts
//
// Master intelligence API — the Bloomberg terminal for opportunities.
//
// GET  (requireAuth):
//   default           → getLatestGlobalReport
//   ?mode=fresh       → generateGlobalIntelligenceReport
//   ?market=PT:Lisboa → generateMarketSnapshot for specific market
//   ?mode=scoring-weights → getCurrentScoringWeights + getOptimizationHistory
//   ?mode=feed        → latest opportunity feed from opportunity_feeds
//   ?mode=stats       → aggregated stats (supply, opportunities, capital)
//
// POST (admin Bearer):
//   { action: 'run-optimization' } → runOptimizationCycle
//   { action: 'apply-feedback' }   → applyFeedbackToOpportunityScores
// =============================================================================

export const runtime     = 'nodejs'
export const maxDuration = 120

import { NextResponse }                 from 'next/server'
import { requireAuth }                  from '@/lib/middleware/portalAuthGuard'
import {
  getLatestGlobalReport,
  generateGlobalIntelligenceReport,
  generateMarketSnapshot,
}                                       from '@/lib/ml-opportunity/marketIntelligenceAggregator'
import {
  getCurrentScoringWeights,
  getOptimizationHistory,
  runOptimizationCycle,
  applyFeedbackToOpportunityScores,
}                                       from '@/lib/ml-opportunity/opportunityMLOptimizer'
import { supabaseAdmin }                from '@/lib/supabase'
import log                              from '@/lib/logger'

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: Request): Promise<Response> {
  const authResult = await requireAuth(req)
  if (authResult instanceof Response) return authResult

  const { tenant_id } = authResult
  const url    = new URL(req.url)
  const mode   = url.searchParams.get('mode') ?? 'default'
  const market = url.searchParams.get('market')

  try {
    // ── ?market=PT:Lisboa → single market snapshot ─────────────────────────
    if (market) {
      const snapshot = await generateMarketSnapshot(market, tenant_id)
      return NextResponse.json({ ok: true, snapshot }, { status: 200 })
    }

    switch (mode) {
      // ── fresh → generate a new global report ────────────────────────────
      case 'fresh': {
        const report = await generateGlobalIntelligenceReport(tenant_id)
        return NextResponse.json({ ok: true, report }, { status: 200 })
      }

      // ── scoring-weights → weights + optimization history ─────────────────
      case 'scoring-weights': {
        const [weights, history] = await Promise.all([
          getCurrentScoringWeights(tenant_id),
          getOptimizationHistory(tenant_id, 10),
        ])
        return NextResponse.json({ ok: true, weights, optimization_history: history }, { status: 200 })
      }

      // ── feed → latest opportunity feed ───────────────────────────────────
      case 'feed': {
        const { data: feed, error: feedErr } = await (supabaseAdmin as any)
          .from('opportunity_feeds')
          .select('*')
          .eq('tenant_id', tenant_id)
          .order('generated_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (feedErr) {
          log.warn('[intelligence] feed fetch failed', { detail: feedErr.message })
          return NextResponse.json({ error: feedErr.message }, { status: 500 })
        }

        return NextResponse.json({ ok: true, feed: feed ?? null }, { status: 200 })
      }

      // ── stats → aggregated stats ──────────────────────────────────────────
      case 'stats': {
        const [supplyRes, oppRes, capitalRes] = await Promise.all([
          (supabaseAdmin as any)
            .from('raw_opportunity_stream')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenant_id),
          (supabaseAdmin as any)
            .from('detected_opportunities')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenant_id)
            .eq('status', 'ACTIVE'),
          (supabaseAdmin as any)
            .from('investor_capital_profiles')
            .select('available_capital_eur_cents')
            .eq('tenant_id', tenant_id),
        ])

        const supplyCount     = (supplyRes as { count: number | null }).count ?? 0
        const opportunityCount = (oppRes as { count: number | null }).count ?? 0

        const capitalRows = ((capitalRes as { data: Array<{ available_capital_eur_cents: number | null }> | null }).data ?? [])
        const totalCapital = capitalRows.reduce(
          (sum, row) => sum + (typeof row.available_capital_eur_cents === 'number' ? row.available_capital_eur_cents : 0),
          0,
        )

        return NextResponse.json({
          ok: true,
          stats: {
            supply_count:             supplyCount,
            opportunity_count:        opportunityCount,
            available_capital_eur_cents: totalCapital,
            generated_at:             new Date().toISOString(),
          },
        }, { status: 200 })
      }

      // ── default → latest global report ───────────────────────────────────
      default: {
        const report = await getLatestGlobalReport(tenant_id)
        if (!report) {
          // No report yet — generate one on first call
          const fresh = await generateGlobalIntelligenceReport(tenant_id)
          return NextResponse.json({ ok: true, report: fresh, generated: true }, { status: 200 })
        }
        return NextResponse.json({ ok: true, report }, { status: 200 })
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.error('[intelligence] GET error', err instanceof Error ? err : new Error(message), {
      tenant_id,
      mode,
      market,
    })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  // Admin Bearer required for POST mutations
  const authResult = await requireAuth(req)
  if (authResult instanceof Response) return authResult

  const { tenant_id, role } = authResult
  if (role !== 'tenant_admin' && role !== 'cron_service') {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const action = body.action as string | undefined

  try {
    switch (action) {
      case 'run-optimization': {
        const cycle = await runOptimizationCycle(tenant_id)
        return NextResponse.json({ ok: true, cycle }, { status: 200 })
      }

      case 'apply-feedback': {
        const result = await applyFeedbackToOpportunityScores(tenant_id)
        return NextResponse.json({ ok: true, ...result }, { status: 200 })
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${String(action)}. Supported: run-optimization, apply-feedback` },
          { status: 400 },
        )
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.error('[intelligence] POST error', err instanceof Error ? err : new Error(message), {
      tenant_id,
      action,
    })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
