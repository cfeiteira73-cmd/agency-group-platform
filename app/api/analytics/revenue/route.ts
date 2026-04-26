// =============================================================================
// Agency Group — Revenue Analytics Engine
// GET /api/analytics/revenue — real revenue KPIs from Supabase
// Metrics: GCI, pipeline, fees, funnel rates, by source/zone/partner
// Auth: requirePortalAuth
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth } from '@/lib/requirePortalAuth'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

// ── Stage probability map (mirrors KPI snapshot) ─────────────────────────────
const STAGE_PROB: Record<string, number> = {
  lead: 0.05, qualification: 0.20, visit_scheduled: 0.35,
  visit_done: 0.45, proposal: 0.60, negotiation: 0.70,
  cpcv: 0.85, escritura: 1.0, post_sale: 1.0,
}

const CLOSED_STAGES = ['escritura', 'post_sale']

// ── Safe division ──────────────────────────────────────────────────────────────
function pct(num: number, den: number): number {
  if (!den) return 0
  return Math.round((num / den) * 1000) / 10  // 1 decimal place
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const auth = await requirePortalAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const period = sp.get('period') ?? 'ytd'  // ytd | month | quarter | all

  // ── Date window ─────────────────────────────────────────────────────────────
  const now = new Date()
  let since: string
  switch (period) {
    case 'month':
      since = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      break
    case 'quarter':
      since = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).toISOString()
      break
    case 'all':
      since = '2020-01-01T00:00:00Z'
      break
    default: // ytd
      since = new Date(now.getFullYear(), 0, 1).toISOString()
  }

  try {
    // ── Fetch all active/closed deals ───────────────────────────────────────────
    const { data: deals, error: dealsError } = await (supabaseAdmin as any)
      .from('deals')
      .select(`
        id, stage, deal_value, commission_rate, gci_net,
        expected_fee, realized_fee, fee_type, partner_id, partner_fee_pct,
        source, zone, probability, created_at, actual_close_date
      `)
      .gte('created_at', since)
      .not('stage', 'in', '("cancelled")')

    if (dealsError) throw dealsError

    const allDeals: Record<string, unknown>[] = deals ?? []
    const closedDeals = allDeals.filter(d => CLOSED_STAGES.includes(String(d.stage ?? '')))
    const activeDeals = allDeals.filter(d => !CLOSED_STAGES.includes(String(d.stage ?? '')))

    // ── Core revenue metrics ────────────────────────────────────────────────────
    const revenue_closed = closedDeals.reduce((sum, d) => {
      return sum + (Number(d.realized_fee) || Number(d.gci_net) || 0)
    }, 0)

    const revenue_expected = activeDeals.reduce((sum, d) => {
      const fee = Number(d.expected_fee) || (Number(d.deal_value) * Number(d.commission_rate || 0.05))
      return sum + fee
    }, 0)

    const pipeline_value = allDeals.reduce((sum, d) => {
      const val = Number(d.deal_value) || 0
      const prob = STAGE_PROB[String(d.stage ?? 'qualification')] ?? Number(d.probability ?? 0) / 100
      return sum + val * prob
    }, 0)

    const agency_net = closedDeals.reduce((sum, d) => {
      const fee = Number(d.realized_fee) || Number(d.gci_net) || 0
      const partnerPct = Number(d.partner_fee_pct) || 0
      return sum + fee * (1 - partnerPct)
    }, 0)

    const partner_fee = closedDeals.reduce((sum, d) => {
      const fee = Number(d.realized_fee) || Number(d.gci_net) || 0
      return sum + fee * (Number(d.partner_fee_pct) || 0)
    }, 0)

    // ── Revenue by source ────────────────────────────────────────────────────────
    const sourceMap: Record<string, { count: number; value: number; closed: number }> = {}
    for (const d of allDeals) {
      const src = String(d.source || 'direct')
      if (!sourceMap[src]) sourceMap[src] = { count: 0, value: 0, closed: 0 }
      sourceMap[src].count++
      sourceMap[src].value += Number(d.deal_value) || 0
      if (CLOSED_STAGES.includes(String(d.stage ?? ''))) {
        sourceMap[src].closed += Number(d.realized_fee) || Number(d.gci_net) || 0
      }
    }
    const revenue_by_source = Object.entries(sourceMap)
      .map(([source, v]) => ({ source, ...v }))
      .sort((a, b) => b.closed - a.closed)

    // ── Revenue by zone ──────────────────────────────────────────────────────────
    const zoneMap: Record<string, { count: number; value: number; closed: number }> = {}
    for (const d of allDeals) {
      const z = String(d.zone || 'Unknown')
      if (!zoneMap[z]) zoneMap[z] = { count: 0, value: 0, closed: 0 }
      zoneMap[z].count++
      zoneMap[z].value += Number(d.deal_value) || 0
      if (CLOSED_STAGES.includes(String(d.stage ?? ''))) {
        zoneMap[z].closed += Number(d.realized_fee) || Number(d.gci_net) || 0
      }
    }
    const revenue_by_zone = Object.entries(zoneMap)
      .map(([zone, v]) => ({ zone, ...v }))
      .sort((a, b) => b.closed - a.closed)

    // ── Revenue by partner ───────────────────────────────────────────────────────
    const partnerMap: Record<string, { count: number; fee: number }> = {}
    for (const d of closedDeals) {
      if (d.partner_id) {
        const pid = String(d.partner_id)
        if (!partnerMap[pid]) partnerMap[pid] = { count: 0, fee: 0 }
        partnerMap[pid].count++
        const fee = Number(d.realized_fee) || Number(d.gci_net) || 0
        partnerMap[pid].fee += fee * (Number(d.partner_fee_pct) || 0)
      }
    }
    // Enrich with partner names
    let revenue_by_partner: unknown[] = []
    if (Object.keys(partnerMap).length > 0) {
      const { data: partners } = await (supabaseAdmin as any)
        .from('institutional_partners')
        .select('id, nome, tipo')
        .in('id', Object.keys(partnerMap))
      const partnerNames: Record<string, string> = {}
      if (partners) partners.forEach((p: { id: string; nome: string; tipo: string }) => { partnerNames[p.id] = p.nome })
      revenue_by_partner = Object.entries(partnerMap).map(([id, v]) => ({
        partner_id: id,
        name: partnerNames[id] ?? 'Unknown',
        deals: v.count,
        fee: Math.round(v.fee),
      })).sort((a: { fee: number }, b: { fee: number }) => b.fee - a.fee)
    }

    // ── Conversion funnel ────────────────────────────────────────────────────────
    // Lead → Call rate: contacts with at least 1 activity vs total contacts in period
    const { count: totalLeads } = await (supabaseAdmin as any)
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since)

    const { count: leadsWithDeals } = await (supabaseAdmin as any)
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since)
      .not('id', 'is', null)
      // We check if they have a deal (proxy for "called")
      .in('id', allDeals.map((d) => d.contact_id).filter(Boolean))

    // Deal pack stats
    const { data: dpStats } = await (supabaseAdmin as any)
      .from('deal_packs')
      .select('status, view_count')
      .gte('created_at', since)

    const dpAll     = dpStats?.length ?? 0
    const dpSent    = dpStats?.filter((d: { status: string }) => ['sent','viewed'].includes(d.status)).length ?? 0
    const dpViewed  = dpStats?.filter((d: { status: string; view_count: number }) => d.status === 'viewed' || d.view_count > 0).length ?? 0

    const stageGroups: Record<string, number> = {}
    for (const d of allDeals) {
      const s = String(d.stage ?? 'unknown')
      stageGroups[s] = (stageGroups[s] ?? 0) + 1
    }
    const atProposal  = Object.entries(stageGroups)
      .filter(([s]) => ['proposal','negotiation','cpcv','escritura','post_sale'].includes(s))
      .reduce((sum, [, c]) => sum + c, 0)
    const atVisit     = Object.entries(stageGroups)
      .filter(([s]) => ['visit_scheduled','visit_done','proposal','negotiation','cpcv','escritura','post_sale'].includes(s))
      .reduce((sum, [, c]) => sum + c, 0)

    const funnel = {
      total_leads:            totalLeads ?? 0,
      leads_with_deals:       leadsWithDeals ?? 0,
      lead_to_deal_rate:      pct(leadsWithDeals ?? 0, totalLeads ?? 0),
      deals_to_proposal:      atProposal,
      call_to_proposal_rate:  pct(atProposal, atVisit),
      proposal_to_close_rate: pct(closedDeals.length, atProposal),
      deal_pack_sent:         dpSent,
      deal_pack_viewed:       dpViewed,
      deal_pack_to_response_rate: pct(dpViewed, dpSent),
    }

    // ── 12-month GCI trend ───────────────────────────────────────────────────────
    const gci12m: { month: string; gci: number; deals: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthStart = d.toISOString()
      const monthEnd   = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString()
      const monthDeals = closedDeals.filter(deal => {
        const closeDate = String(deal.actual_close_date ?? deal.created_at ?? '')
        return closeDate >= monthStart && closeDate < monthEnd
      })
      gci12m.push({
        month: d.toLocaleString('pt-PT', { month: 'short', year: '2-digit' }),
        gci:   Math.round(monthDeals.reduce((s, d) => s + (Number(d.realized_fee) || Number(d.gci_net) || 0), 0)),
        deals: monthDeals.length,
      })
    }

    return NextResponse.json({
      period,
      since,
      // ── Core ──
      revenue_closed:   Math.round(revenue_closed),
      revenue_expected: Math.round(revenue_expected),
      pipeline_value:   Math.round(pipeline_value),
      agency_net:       Math.round(agency_net),
      partner_fee:      Math.round(partner_fee),
      // ── Counts ──
      total_deals:      allDeals.length,
      closed_deals:     closedDeals.length,
      active_deals:     activeDeals.length,
      // ── By dimension ──
      revenue_by_source,
      revenue_by_zone,
      revenue_by_partner,
      // ── Funnel ──
      funnel,
      // ── Trend ──
      gci12m,
      // ── Meta ──
      source:    'supabase',
      generated: new Date().toISOString(),
    })

  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    console.error('[revenue analytics]', msg)
    return NextResponse.json({ error: msg, source: 'error' }, { status: 500 })
  }
}
