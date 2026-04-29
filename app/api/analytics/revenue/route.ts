// =============================================================================
// Agency Group — Revenue Analytics Engine
// GET /api/analytics/revenue — real revenue KPIs from Supabase
// Metrics: GCI, pipeline, fees, funnel rates, by zona/partner
// Auth: requirePortalAuth
//
// Production deals columns (portal-compat layer — migration 003):
//   fase        TEXT    — stage in PT: "Contacto","Qualificação","CPCV","Escritura"
//   comissao    NUMERIC — commission earned (GCI)
//   deal_value  NUMERIC — raw deal value
//   valor       TEXT    — formatted "€ 1.250.000"
//   zona        TEXT    — geographic zone
//   contact_id  UUID    — nullable
//   partner_id  UUID    — nullable (migration 002)
//   partner_fee_pct NUMERIC — nullable (migration 002)
//   expected_fee    NUMERIC — nullable (migration 002)
//   realized_fee    NUMERIC — nullable (migration 002)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth } from '@/lib/requirePortalAuth'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

// ── Normalize fase string for map lookups ─────────────────────────────────────
function normFase(s: unknown): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // strip diacritics
    .replace(/[\s\-_]+/g, '')          // strip separators
}

// ── Stage probability — covers PT portal values + EN enum fallbacks ───────────
const STAGE_PROB_MAP: Record<string, number> = {
  contacto: 0.05, angariacao: 0.05, lead: 0.05,
  qualificacao: 0.20, qualificado: 0.20, qualification: 0.20,
  visitaagendada: 0.35, visitascheduled: 0.35,
  visitarealizada: 0.45, visitadone: 0.45, visita: 0.40,
  proposta: 0.60, proposal: 0.60,
  negociacao: 0.70, negotiation: 0.70,
  cpcv: 0.85,
  escritura: 1.0, fechado: 1.0, posvenda: 1.0, postsale: 1.0,
}

function stagePct(fase: unknown): number {
  const key = normFase(fase)
  if (STAGE_PROB_MAP[key] !== undefined) return STAGE_PROB_MAP[key]
  for (const [k, v] of Object.entries(STAGE_PROB_MAP)) {
    if (key.includes(k) || k.includes(key)) return v
  }
  return 0.10
}

// ── Closed-deal detection (any PT/EN closed stage) ────────────────────────────
function isClosedFase(fase: unknown): boolean {
  const n = normFase(fase)
  return n.includes('escritura') || n.includes('fechado')
    || n.includes('posvenda') || n.includes('postsale')
}

// ── Safe division → 1 decimal ─────────────────────────────────────────────────
function pct(num: number, den: number): number {
  if (!den) return 0
  return Math.round((num / den) * 1000) / 10
}

// ── Parse revenue field (NUMERIC or TEXT "€ 1.250.000") ──────────────────────
function parseRev(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') return parseFloat(v.replace(/[^0-9.]/g, '')) || 0
  return 0
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── Auth ─────────────────────────────────────────────────────────────────────
  const auth = await requirePortalAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })

  const sp     = req.nextUrl.searchParams
  const period = sp.get('period') ?? 'ytd'  // ytd | month | quarter | all

  // ── Date window ──────────────────────────────────────────────────────────────
  const now = new Date()
  let since: string
  switch (period) {
    case 'month':
      since = new Date(now.getFullYear(), now.getMonth(), 1).toISOString(); break
    case 'quarter':
      since = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).toISOString(); break
    case 'all':
      since = '2020-01-01T00:00:00Z'; break
    default: // ytd
      since = new Date(now.getFullYear(), 0, 1).toISOString()
  }

  try {
    // ── Fetch deals — try with migration-002 columns; fall back to core only ──
    // Migration 002 added: expected_fee, realized_fee, partner_id, partner_fee_pct
    // If that migration was not applied, retry with confirmed-only columns.
    let dealsResult = await (supabaseAdmin as any)
      .from('deals')
      .select(`
        id, fase, valor, comissao, deal_value, zona,
        contact_id, partner_id, partner_fee_pct,
        expected_fee, realized_fee,
        created_at
      `)
      .gte('created_at', since)
      .not('fase', 'ilike', '%cancelad%')

    // 42703 = column does not exist — retry without optional columns
    if (dealsResult.error && String(dealsResult.error.code) === '42703') {
      dealsResult = await (supabaseAdmin as any)
        .from('deals')
        .select('id, fase, valor, comissao, deal_value, zona, contact_id, created_at')
        .gte('created_at', since)
        .not('fase', 'ilike', '%cancelad%')
    }

    const dealsError = dealsResult.error
    if (dealsError) throw dealsError
    const deals = dealsResult.data

    const allDeals: Record<string, unknown>[] = deals ?? []
    const closedDeals = allDeals.filter(d => isClosedFase(d.fase))
    const activeDeals = allDeals.filter(d => !isClosedFase(d.fase))

    // ── Core revenue metrics ──────────────────────────────────────────────────
    const revenue_closed = closedDeals.reduce((sum, d) =>
      sum + (parseRev(d.realized_fee) || parseRev(d.comissao)), 0)

    const revenue_expected = activeDeals.reduce((sum, d) => {
      const fee = parseRev(d.expected_fee) || parseRev(d.deal_value) * 0.05
      return sum + fee
    }, 0)

    const pipeline_value = allDeals.reduce((sum, d) => {
      const val  = parseRev(d.deal_value) || parseRev(d.valor)
      return sum + val * stagePct(d.fase)
    }, 0)

    const agency_net = closedDeals.reduce((sum, d) => {
      const fee = parseRev(d.realized_fee) || parseRev(d.comissao)
      return sum + fee * (1 - (Number(d.partner_fee_pct) || 0))
    }, 0)

    const partner_fee = closedDeals.reduce((sum, d) => {
      const fee = parseRev(d.realized_fee) || parseRev(d.comissao)
      return sum + fee * (Number(d.partner_fee_pct) || 0)
    }, 0)

    // ── Revenue by zona ───────────────────────────────────────────────────────
    const zonaMap: Record<string, { count: number; value: number; closed: number }> = {}
    for (const d of allDeals) {
      const z = String(d.zona || 'Desconhecida')
      if (!zonaMap[z]) zonaMap[z] = { count: 0, value: 0, closed: 0 }
      zonaMap[z].count++
      zonaMap[z].value += parseRev(d.deal_value) || parseRev(d.valor)
      if (isClosedFase(d.fase))
        zonaMap[z].closed += parseRev(d.realized_fee) || parseRev(d.comissao)
    }
    const revenue_by_zone = Object.entries(zonaMap)
      .map(([zone, v]) => ({ zone, ...v }))
      .sort((a, b) => b.closed - a.closed)

    // revenue_by_source: zona used as source proxy (no confirmed source column)
    const revenue_by_source = revenue_by_zone.map(r => ({
      source: r.zone, count: r.count, value: r.value, closed: r.closed,
    }))

    // ── Revenue by partner ────────────────────────────────────────────────────
    const partnerMap: Record<string, { count: number; fee: number }> = {}
    for (const d of closedDeals) {
      if (d.partner_id) {
        const pid = String(d.partner_id)
        if (!partnerMap[pid]) partnerMap[pid] = { count: 0, fee: 0 }
        partnerMap[pid].count++
        const fee = parseRev(d.realized_fee) || parseRev(d.comissao)
        partnerMap[pid].fee += fee * (Number(d.partner_fee_pct) || 0)
      }
    }
    let revenue_by_partner: unknown[] = []
    if (Object.keys(partnerMap).length > 0) {
      const { data: partners } = await (supabaseAdmin as any)
        .from('institutional_partners')
        .select('id, nome')
        .in('id', Object.keys(partnerMap))
      const names: Record<string, string> = {}
      if (partners) partners.forEach((p: { id: string; nome: string }) => { names[p.id] = p.nome })
      revenue_by_partner = Object.entries(partnerMap)
        .map(([id, v]) => ({
          partner_id: id,
          name:       names[id] ?? 'Desconhecido',
          deals:      v.count,
          fee:        Math.round(v.fee),
        }))
        .sort((a: { fee: number }, b: { fee: number }) => b.fee - a.fee)
    }

    // ── Conversion funnel ─────────────────────────────────────────────────────
    const { count: totalLeads } = await (supabaseAdmin as any)
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since)

    const contactIdsWithDeals = allDeals
      .map((d) => d.contact_id)
      .filter(Boolean) as string[]

    const { count: leadsWithDeals } = contactIdsWithDeals.length > 0
      ? await (supabaseAdmin as any)
          .from('contacts')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', since)
          .in('id', contactIdsWithDeals)
      : { count: 0 }

    const { data: dpStats, error: dpErr } = await (supabaseAdmin as any)
      .from('deal_packs')
      .select('status, view_count')
      .gte('created_at', since)

    const dpSent   = dpErr ? 0
      : (dpStats?.filter((d: { status: string }) => ['sent','viewed'].includes(d.status)).length ?? 0)
    const dpViewed = dpErr ? 0
      : (dpStats?.filter((d: { status: string; view_count: number }) =>
          d.status === 'viewed' || (d.view_count ?? 0) > 0).length ?? 0)

    // Stage funnel counts — using normalized fase
    const isPastProposal = (f: unknown) => {
      const n = normFase(f)
      return ['proposta','proposal','negociacao','negotiation','cpcv',
              'escritura','fechado','posvenda','postsale'].some(k => n.includes(k))
    }
    const isPastVisit = (f: unknown) => {
      const n = normFase(f)
      return ['visita','visit','proposta','proposal','negociacao','negotiation',
              'cpcv','escritura','fechado','posvenda','postsale'].some(k => n.includes(k))
    }
    const atProposal = allDeals.filter(d => isPastProposal(d.fase)).length
    const atVisit    = allDeals.filter(d => isPastVisit(d.fase)).length

    const funnel = {
      total_leads:                totalLeads ?? 0,
      leads_with_deals:           leadsWithDeals ?? 0,
      lead_to_deal_rate:          pct(leadsWithDeals ?? 0, totalLeads ?? 0),
      deals_to_proposal:          atProposal,
      call_to_proposal_rate:      pct(atProposal, atVisit),
      proposal_to_close_rate:     pct(closedDeals.length, atProposal),
      deal_pack_sent:             dpSent,
      deal_pack_viewed:           dpViewed,
      deal_pack_to_response_rate: pct(dpViewed, dpSent),
    }

    // ── 12-month GCI trend ────────────────────────────────────────────────────
    const gci12m: { month: string; gci: number; deals: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const d          = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthStart = d.toISOString()
      const monthEnd   = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString()
      const monthDeals = closedDeals.filter(deal => {
        const dt = String(deal.created_at ?? '')
        return dt >= monthStart && dt < monthEnd
      })
      gci12m.push({
        month: d.toLocaleString('pt-PT', { month: 'short', year: '2-digit' }),
        gci:   Math.round(monthDeals.reduce((s, deal) =>
          s + (parseRev(deal.realized_fee) || parseRev(deal.comissao)), 0)),
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
      total_deals:   allDeals.length,
      closed_deals:  closedDeals.length,
      active_deals:  activeDeals.length,
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
    const msg = e instanceof Error
      ? e.message
      : (typeof e === 'object' && e !== null)
        ? JSON.stringify(e)
        : String(e ?? 'unknown error')
    console.error('[revenue analytics]', msg, e)
    return NextResponse.json({ error: msg, source: 'error' }, { status: 500 })
  }
}
