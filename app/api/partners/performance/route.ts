// =============================================================================
// Agency Group — Partner Performance Analytics
// GET /api/partners/performance — partner sourcing metrics from Supabase
// Returns: top by properties, top by revenue, inactive, next actions
// Auth: requirePortalAuth
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth } from '@/lib/requirePortalAuth'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const auth = await requirePortalAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const limit  = Math.min(100, parseInt(sp.get('limit') ?? '20', 10))
  const inactiveDays = parseInt(sp.get('inactive_days') ?? '60', 10)

  try {
    // ── 1. Fetch all partners ─────────────────────────────────────────────────
    const { data: partners, error: pErr } = await (supabaseAdmin as any)
      .from('institutional_partners')
      .select(`
        id, nome, tipo, email, phone, cidade, estado, nivel_prioridade,
        owner, deals_referidos, volume_referido,
        last_contact_at, next_followup_at, contact_attempts,
        segmento, ticket_medio, tags, created_at
      `)
      .not('estado', 'eq', 'inactivo')
      .order('nivel_prioridade', { ascending: true })
      .order('volume_referido', { ascending: false })
      .limit(limit)

    if (pErr) throw pErr

    const all: Record<string, unknown>[] = partners ?? []

    // ── 2. Fetch deals with partner_id populated ──────────────────────────────
    const { data: partnerDeals } = await (supabaseAdmin as any)
      .from('deals')
      .select('id, partner_id, stage, deal_value, gci_net, realized_fee, zone, source, created_at')
      .not('partner_id', 'is', null)

    const dealsByPartner: Record<string, Record<string, unknown>[]> = {}
    if (partnerDeals) {
      for (const d of partnerDeals) {
        const pid = String(d.partner_id)
        if (!dealsByPartner[pid]) dealsByPartner[pid] = []
        dealsByPartner[pid].push(d)
      }
    }

    const CLOSED = ['escritura', 'post_sale']
    const now = Date.now()
    const inactiveCutoff = new Date(now - inactiveDays * 24 * 60 * 60 * 1000).toISOString()

    // ── 3. Enrich partners with deal metrics ──────────────────────────────────
    const enriched = all.map(p => {
      const pid = String(p.id)
      const pDeals = dealsByPartner[pid] ?? []
      const closedDeals = pDeals.filter(d => CLOSED.includes(String(d.stage ?? '')))

      const revenue_generated = closedDeals.reduce((s, d) => {
        return s + (Number(d.realized_fee) || Number(d.gci_net) || 0)
      }, 0)

      const pipeline_value = pDeals
        .filter(d => !CLOSED.includes(String(d.stage ?? '')))
        .reduce((s, d) => s + (Number(d.deal_value) || 0), 0)

      const inactive = p.last_contact_at
        ? String(p.last_contact_at) < inactiveCutoff
        : true

      const overdue_followup = p.next_followup_at
        ? new Date(String(p.next_followup_at)).getTime() < now
        : false

      // Priority score: revenue + recency + deal count
      const recencyScore = p.last_contact_at
        ? Math.max(0, 100 - Math.round((now - new Date(String(p.last_contact_at)).getTime()) / (24 * 60 * 60 * 1000)))
        : 0
      const dealScore = Math.min(50, (Number(p.deals_referidos) || closedDeals.length) * 5)
      const revenueScore = Math.min(30, Math.round(revenue_generated / 10000))
      const performance_score = Math.min(100, recencyScore * 0.4 + dealScore + revenueScore)

      return {
        id:                 p.id,
        name:               p.nome,
        type:               p.tipo,
        email:              p.email,
        phone:              p.phone,
        city:               p.cidade,
        status:             p.estado,
        priority:           p.nivel_prioridade,
        owner:              p.owner,
        segment:            p.segmento,
        avg_ticket:         p.ticket_medio,
        // Activity
        last_contact_at:    p.last_contact_at,
        next_followup_at:   p.next_followup_at,
        contact_attempts:   p.contact_attempts,
        inactive,
        overdue_followup,
        // Deal metrics (from institutional_partners table + deals table)
        deals_introduced:   Math.max(Number(p.deals_referidos) || 0, closedDeals.length),
        properties_introduced: Number(p.deals_referidos) || 0,  // proxy until property tracking exists
        revenue_generated:  Math.round(revenue_generated),
        volume_referred:    Number(p.volume_referido) || Math.round(pipeline_value + revenue_generated),
        pipeline_value:     Math.round(pipeline_value),
        // Score
        performance_score:  Math.round(performance_score),
        // Next action
        next_action:        overdue_followup
          ? 'OVERDUE: Contact immediately'
          : inactive
            ? `Reactivate — no contact in ${inactiveDays}+ days`
            : p.next_followup_at
              ? `Follow up scheduled: ${new Date(String(p.next_followup_at)).toLocaleDateString('pt-PT')}`
              : 'Schedule next touchpoint',
      }
    })

    // ── 4. Segment results ────────────────────────────────────────────────────
    const top_by_revenue = [...enriched]
      .sort((a, b) => (b.revenue_generated as number) - (a.revenue_generated as number))
      .slice(0, 10)

    const top_by_properties = [...enriched]
      .sort((a, b) => (b.deals_introduced as number) - (a.deals_introduced as number))
      .slice(0, 10)

    const inactive_partners = enriched
      .filter(p => p.inactive)
      .sort((a, b) => (b.performance_score as number) - (a.performance_score as number))  // reactivate high-performers first
      .slice(0, 10)

    const overdue_actions = enriched
      .filter(p => p.overdue_followup || p.inactive)
      .sort((a, b) => (b.performance_score as number) - (a.performance_score as number))
      .slice(0, 10)

    // ── 5. Aggregate KPIs ─────────────────────────────────────────────────────
    const total_revenue_from_partners = enriched.reduce((s, p) => s + (p.revenue_generated as number), 0)
    const total_pipeline_from_partners = enriched.reduce((s, p) => s + (p.pipeline_value as number), 0)
    const active_partners = enriched.filter(p => !p.inactive).length

    return NextResponse.json({
      // ── Summary ──
      total_partners:                  all.length,
      active_partners,
      inactive_partners_count:         enriched.filter(p => p.inactive).length,
      overdue_followups:               enriched.filter(p => p.overdue_followup).length,
      total_revenue_from_partners:     Math.round(total_revenue_from_partners),
      total_pipeline_from_partners:    Math.round(total_pipeline_from_partners),
      // ── Segmented views ──
      top_by_revenue,
      top_by_properties,
      inactive_partners,
      overdue_actions,
      // ── All enriched ──
      all: enriched,
      // ── Meta ──
      source:    'supabase',
      generated: new Date().toISOString(),
      inactive_threshold_days: inactiveDays,
    })

  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    console.error('[partners/performance]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
