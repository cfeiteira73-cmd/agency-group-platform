// AGENCY GROUP — SH-ROS | AMI: 22506
// GET /api/executive/dashboard
// Executive Revenue Dashboard — aggregated KPIs, pipeline, leads, deals, opportunities, narrative.
// Auth: portal cookie (isPortalAuth) — nodejs runtime only.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { isPortalAuth } from '@/lib/portalAuth'
import { supabaseAdmin } from '@/lib/supabase'
import { opportunityRadar, RadarSignal } from '@/lib/executive/opportunityRadar'
import { logger } from '@/lib/observability/logger'
import { detectRevenueLeakage, buildExecutiveSnapshot } from '@/lib/executive-revenue-v2'
import type { ListingRevenueSummary, AgentPerformanceSummary } from '@/lib/executive-revenue-v2'
import { getRequestCorrelationId } from '@/lib/observability/correlation'
import { COMMISSION_RATE } from '@/lib/constants/pipeline'

export const runtime = 'nodejs'
export const maxDuration = 15

// ─── Supabase helper (type-safe escape hatch matching codebase pattern) ────────

const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }

// ─── Response shape ────────────────────────────────────────────────────────────

export interface ExecutiveDashboardResponse {
  pipeline_value_eur: number
  commission_estimate_eur: number
  live_listings: number
  processing_listings: number
  total_submissions: number
  avg_demand_score: number
  homepage_ready: number
  contacts_total: number
  hot_leads: number
  deals_active: number
  deals_value_eur: number
  revenue_this_month_eur: number
  opportunities: RadarSignal[]
  narrative: string
  generated_at: string
  // ── Revenue intelligence extensions ────────────────────────────────────────
  leakage_items: import('@/lib/executive-revenue-v2').RevenueLeakageItem[]
  total_leakage_monthly_eur: number
  snapshot_narrative: string
  agent_rankings: import('@/lib/executive-revenue-v2').AgentRankEntry[]
}

// ─── Supabase fetchers (each silently returns zeros on error) ──────────────────

interface SubmissionAgg {
  live_listings: number
  processing_listings: number
  total_submissions: number
}

async function fetchSubmissionAgg(): Promise<SubmissionAgg> {
  try {
    const t = sb.from('property_ai_submissions') as {
      select: (cols: string) => Promise<{ data: Array<{ status: string }> | null; error: unknown }>
    }
    const { data, error } = await t.select('status')
    if (error || !data) return { live_listings: 0, processing_listings: 0, total_submissions: 0 }

    const live = data.filter(r => r.status === 'live').length
    const processing = data.filter(r =>
      ['analyzing', 'enriching', 'generating', 'ingesting'].includes(r.status)
    ).length

    return { live_listings: live, processing_listings: processing, total_submissions: data.length }
  } catch {
    return { live_listings: 0, processing_listings: 0, total_submissions: 0 }
  }
}

interface IntelligenceAgg {
  avg_demand_score: number
  homepage_ready: number
}

async function fetchIntelligenceAgg(): Promise<IntelligenceAgg> {
  try {
    const t = sb.from('property_ai_intelligence') as {
      select: (cols: string) => Promise<{
        data: Array<{ demand_score: number; homepage_placement_score: number }> | null
        error: unknown
      }>
    }
    const { data, error } = await t.select('demand_score, homepage_placement_score')
    if (error || !data || data.length === 0) return { avg_demand_score: 0, homepage_ready: 0 }

    const totalDemand = data.reduce((s, r) => s + (Number(r.demand_score) || 0), 0)
    const avgDemand = Math.round(totalDemand / data.length)
    const homepageReady = data.filter(r => (Number(r.homepage_placement_score) || 0) >= 60).length

    return { avg_demand_score: avgDemand, homepage_ready: homepageReady }
  } catch {
    return { avg_demand_score: 0, homepage_ready: 0 }
  }
}

async function fetchPipelineValue(liveCount: number): Promise<number> {
  if (liveCount === 0) return 0
  try {
    // We need live submission IDs first
    const subT = sb.from('property_ai_submissions') as {
      select: (cols: string) => {
        eq: (col: string, val: string) => Promise<{
          data: Array<{ submission_id: string }> | null
          error: unknown
        }>
      }
    }
    const { data: subs, error: subErr } = await (subT.select('submission_id') as ReturnType<typeof subT.select>)
      .eq('status', 'live')
    if (subErr || !subs || subs.length === 0) return 0

    const ids = subs.map(s => s.submission_id)

    const listT = sb.from('property_ai_listings') as {
      select: (cols: string) => {
        in: (col: string, vals: string[]) => Promise<{
          data: Array<{ estimated_price_eur: number | null }> | null
          error: unknown
        }>
      }
    }
    const { data: listings, error: listErr } = await (listT.select('estimated_price_eur') as ReturnType<typeof listT.select>)
      .in('submission_id', ids)
    if (listErr || !listings) return 0

    return listings.reduce((sum, l) => sum + (Number(l.estimated_price_eur) || 0), 0)
  } catch {
    return 0
  }
}

interface ContactsAgg {
  contacts_total: number
  hot_leads: number
}

async function fetchContactsAgg(): Promise<ContactsAgg> {
  try {
    const t = sb.from('contacts') as {
      select: (cols: string) => Promise<{
        data: Array<{ score?: number | null }> | null
        error: unknown
      }>
    }
    const { data, error } = await t.select('score')
    if (error || !data) return { contacts_total: 0, hot_leads: 0 }

    const hot = data.filter(c => (Number(c.score) || 0) > 70).length
    return { contacts_total: data.length, hot_leads: hot }
  } catch {
    return { contacts_total: 0, hot_leads: 0 }
  }
}

interface DealsAgg {
  deals_active: number
  deals_value_eur: number
}

async function fetchDealsAgg(): Promise<DealsAgg> {
  try {
    const t = sb.from('deals') as {
      select: (cols: string) => Promise<{
        data: Array<{ status?: string | null; value_eur?: number | null; amount?: number | null }> | null
        error: unknown
      }>
    }
    const { data, error } = await t.select('status, value_eur, amount')
    if (error || !data) return { deals_active: 0, deals_value_eur: 0 }

    const active = data.filter(d => {
      const s = (d.status ?? '').toLowerCase()
      return !['closed', 'lost', 'cancelled', 'archived'].includes(s)
    })

    const valueSum = active.reduce((sum, d) => {
      const v = Number(d.value_eur ?? d.amount ?? 0)
      return sum + v
    }, 0)

    return { deals_active: active.length, deals_value_eur: valueSum }
  } catch {
    return { deals_active: 0, deals_value_eur: 0 }
  }
}

// ─── Revenue intelligence fetchers ────────────────────────────────────────────

async function fetchListingRevenueSummaries(): Promise<ListingRevenueSummary[]> {
  try {
    // Fetch live submission IDs
    const subT = sb.from('property_ai_submissions') as {
      select: (cols: string) => {
        eq: (col: string, val: string) => Promise<{
          data: Array<{ submission_id: string }> | null
          error: unknown
        }>
      }
    }
    const { data: subs, error: subErr } = await (subT.select('submission_id') as ReturnType<typeof subT.select>)
      .eq('status', 'live')
    if (subErr || !subs || subs.length === 0) return []

    const ids = subs.map(s => s.submission_id)

    // Fetch listings with pricing data
    const listT = sb.from('property_ai_listings') as {
      select: (cols: string) => {
        in: (col: string, vals: string[]) => Promise<{
          data: Array<{
            submission_id: string
            estimated_price_eur: number | null
            avm_base?: number | null
          }> | null
          error: unknown
        }>
      }
    }
    const { data: listings, error: listErr } = await (listT.select('submission_id, estimated_price_eur, avm_base') as ReturnType<typeof listT.select>)
      .in('submission_id', ids)
    if (listErr || !listings) return []

    // Fetch intelligence data for demand_score and inquiry_count
    const intT = sb.from('property_ai_intelligence') as {
      select: (cols: string) => {
        in: (col: string, vals: string[]) => Promise<{
          data: Array<{
            submission_id: string
            demand_score: number | null
            inquiry_count?: number | null
          }> | null
          error: unknown
        }>
      }
    }
    const { data: intelligence } = await (intT.select('submission_id, demand_score, inquiry_count') as ReturnType<typeof intT.select>)
      .in('submission_id', ids)
    const intelMap = new Map<string, { demand_score: number; inquiry_count: number }>()
    for (const row of intelligence ?? []) {
      intelMap.set(row.submission_id, {
        demand_score: Number(row.demand_score ?? 0),
        inquiry_count: Number(row.inquiry_count ?? 0),
      })
    }

    return listings.map(l => {
      const intel = intelMap.get(l.submission_id) ?? { demand_score: 0, inquiry_count: 0 }
      return {
        property_id: l.submission_id,
        listing_price_eur: Number(l.estimated_price_eur ?? 0),
        avm_base_eur: Number(l.avm_base ?? 0),
        days_on_market: 0, // not available in this query; default safe value
        demand_score: intel.demand_score,
        inquiry_count: intel.inquiry_count,
      } satisfies ListingRevenueSummary
    })
  } catch {
    return []
  }
}

async function fetchAgentPerformanceSummaries(): Promise<AgentPerformanceSummary[]> {
  try {
    const t = sb.from('contacts') as {
      select: (cols: string) => {
        eq: (col: string, val: string) => Promise<{
          data: Array<{
            id: string
            contact_type?: string | null
            score?: number | null
          }> | null
          error: unknown
        }>
      }
    }
    const { data, error } = await (t.select('id, contact_type, score') as ReturnType<typeof t.select>)
      .eq('contact_type', 'agent')
    if (error || !data || data.length === 0) return []

    // Build minimal summaries from available contacts data
    return data.map(agent => ({
      agent_id: agent.id,
      deals_closed: 0,
      total_commission_eur: 0,
      avg_days_to_close: null, // No closed deals — cannot compute; display as '—'
      listings_active: 0,
      conversion_rate: 0,
    } satisfies AgentPerformanceSummary))
  } catch {
    return []
  }
}

async function fetchRevenueThisMonth(): Promise<number> {
  try {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const t = sb.from('deals') as {
      select: (cols: string) => {
        gte: (col: string, val: string) => {
          in: (col: string, vals: string[]) => Promise<{
            data: Array<{ commission_eur?: number | null; value_eur?: number | null }> | null
            error: unknown
          }>
        }
      }
    }
    const { data, error } = await (t.select('commission_eur, value_eur') as ReturnType<typeof t.select>)
      .gte('closed_at', monthStart)
      .in('status', ['closed', 'completed', 'escritura'])

    if (error || !data) return 0

    return data.reduce((sum, d) => {
      // Prefer explicit commission field; fall back to 5% of deal value
      const comm = Number(d.commission_eur ?? 0)
      const derived = Number(d.value_eur ?? 0) * COMMISSION_RATE
      return sum + (comm > 0 ? comm : derived)
    }, 0)
  } catch {
    return 0
  }
}

// ─── Narrative builder ─────────────────────────────────────────────────────────

function buildNarrative(
  live: number,
  pipeline: number,
  hot_leads: number,
  commission: number,
  topSignal: RadarSignal | null,
): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

  const pipelineStr = pipeline > 0 ? fmt(pipeline) : 'valor a apurar'
  const commStr = commission > 0 ? fmt(commission) : 'a calcular'
  const topAction = topSignal
    ? `Oportunidade prioritária: ${topSignal.title} — ${topSignal.recommended_action}.`
    : 'Execute o radar de oportunidades para activar sinais de receita.'

  return (
    `Tem ${live} imóvel${live !== 1 ? 'is' : ''} live com valor de pipeline estimado em ${pipelineStr}, ` +
    `representando ${commStr} em comissões Agency Group (5%). ` +
    `${hot_leads} lead${hot_leads !== 1 ? 's quentes' : ' quente'} aguarda${hot_leads !== 1 ? 'm' : ''} acompanhamento imediato. ` +
    topAction
  )
}

// ─── GET handler ───────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const corrId = getRequestCorrelationId(req)
  if (!(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Run all aggregations in parallel — each handles its own errors
    const [
      submissionAgg,
      intelligenceAgg,
      contactsAgg,
      dealsAgg,
      revenueThisMonth,
      listingRevenueSummaries,
      agentPerformanceSummaries,
    ] = await Promise.all([
      fetchSubmissionAgg(),
      fetchIntelligenceAgg(),
      fetchContactsAgg(),
      fetchDealsAgg(),
      fetchRevenueThisMonth(),
      fetchListingRevenueSummaries(),
      fetchAgentPerformanceSummaries(),
    ])

    // Pipeline value requires live count — run after submissions agg
    const pipelineValue = await fetchPipelineValue(submissionAgg.live_listings)
    const commissionEstimate = pipelineValue * COMMISSION_RATE

    // Opportunity radar scan (synchronous — template-based)
    let opportunities: RadarSignal[] = []
    try {
      const scan = opportunityRadar.scan('agency-group')
      opportunities = scan.signals.slice(0, 5)
    } catch {
      opportunities = []
    }

    const topSignal = opportunities[0] ?? null

    // ── Revenue intelligence (leakage + snapshot) ─────────────────────────────
    let leakage_items: import('@/lib/executive-revenue-v2').RevenueLeakageItem[] = []
    let total_leakage_monthly_eur = 0
    let snapshot_narrative = ''
    let agent_rankings: import('@/lib/executive-revenue-v2').AgentRankEntry[] = []

    try {
      leakage_items = detectRevenueLeakage(listingRevenueSummaries)
      total_leakage_monthly_eur = leakage_items.reduce((s, i) => s + i.estimated_leakage_eur, 0)

      const snapshot = buildExecutiveSnapshot(listingRevenueSummaries, agentPerformanceSummaries)
      snapshot_narrative = snapshot.narrative
      agent_rankings = snapshot.agent_rankings
    } catch {
      // Silently degrade — these are additive enrichments
    }

    const narrative = buildNarrative(
      submissionAgg.live_listings,
      pipelineValue,
      contactsAgg.hot_leads,
      commissionEstimate,
      topSignal,
    )

    const payload: ExecutiveDashboardResponse = {
      pipeline_value_eur: Math.round(pipelineValue),
      commission_estimate_eur: Math.round(commissionEstimate),
      live_listings: submissionAgg.live_listings,
      processing_listings: submissionAgg.processing_listings,
      total_submissions: submissionAgg.total_submissions,
      avg_demand_score: intelligenceAgg.avg_demand_score,
      homepage_ready: intelligenceAgg.homepage_ready,
      contacts_total: contactsAgg.contacts_total,
      hot_leads: contactsAgg.hot_leads,
      deals_active: dealsAgg.deals_active,
      deals_value_eur: Math.round(dealsAgg.deals_value_eur),
      revenue_this_month_eur: Math.round(revenueThisMonth),
      opportunities,
      narrative,
      generated_at: new Date().toISOString(),
      leakage_items,
      total_leakage_monthly_eur,
      snapshot_narrative,
      agent_rankings,
    }

    logger.info('[executive/dashboard] KPIs generated', {
      route: 'executive/dashboard',
      live_listings: payload.live_listings,
      pipeline_value_eur: payload.pipeline_value_eur,
      hot_leads: payload.hot_leads,
    })

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    logger.error('[executive/dashboard] unhandled error', { err, corrId })
    // Return zeros — dashboard degrades gracefully
    const empty: ExecutiveDashboardResponse = {
      pipeline_value_eur: 0,
      commission_estimate_eur: 0,
      live_listings: 0,
      processing_listings: 0,
      total_submissions: 0,
      avg_demand_score: 0,
      homepage_ready: 0,
      contacts_total: 0,
      hot_leads: 0,
      deals_active: 0,
      deals_value_eur: 0,
      revenue_this_month_eur: 0,
      opportunities: [],
      narrative: 'Sistema executivo a inicializar. Dados disponíveis em breve.',
      generated_at: new Date().toISOString(),
      leakage_items: [],
      total_leakage_monthly_eur: 0,
      snapshot_narrative: '',
      agent_rankings: [],
    }
    return NextResponse.json(empty)
  }
}
