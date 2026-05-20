// AGENCY GROUP — SH-ROS | AMI: 22506
// GET /api/agent/actions — AI-powered priority action queue for agents
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { isPortalAuth } from '@/lib/portalAuth'
import { supabaseAdmin } from '@/lib/supabase'
import { opportunityRadar } from '@/lib/executive/opportunityRadar'
import { logger } from '@/lib/observability/logger'
import { randomUUID } from 'crypto'
import { COMMISSION_RATE } from '@/lib/constants/pipeline'

export const runtime = 'nodejs'
export const maxDuration = 15

// ─── Types ────────────────────────────────────────────────────────────────────

type ActionType =
  | 'follow_up'
  | 'photo_improvement'
  | 'price_adjustment'
  | 'listing_boost'
  | 'inquiry_response'
  | 'deal_risk'
  | 'opportunity'

type Urgency = 'hoje' | 'esta_semana' | 'este_mes'

interface ActionItem {
  id: string
  type: ActionType
  title: string
  description: string
  urgency: Urgency
  impact_eur: number
  property_id?: string
  contact_id?: string
  cta_label: string
  cta_href: string
}

// ─── Urgency mapping ──────────────────────────────────────────────────────────

function radarUrgencyToAG(urgency: string): Urgency {
  if (urgency === 'immediate' || urgency === 'today') return 'hoje'
  if (urgency === 'this_week') return 'esta_semana'
  return 'este_mes'
}

// ─── Impact formatting ─────────────────────────────────────────────────────────

function formatImpact(value: number): number {
  return Math.round(value / 100) * 100  // round to nearest €100
}

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const actions: ActionItem[] = []
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // ── 1. Live submissions with intelligence scores ──────────────────────────────
  try {
    type SubmissionRow = {
      submission_id: string
      created_at: string
      property_ai_intelligence: { demand_score: number; homepage_placement_score: number } | null
      property_ai_listings: { estimated_price_eur: number } | null
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: submissions, error: subErr } = await (supabaseAdmin as any)
      .from('property_ai_submissions')
      .select(`
        submission_id,
        created_at,
        property_ai_intelligence ( demand_score, homepage_placement_score ),
        property_ai_listings ( estimated_price_eur )
      `)
      .eq('status', 'live') as { data: SubmissionRow[] | null; error: { message: string } | null }

    if (!subErr && submissions) {
      for (const sub of submissions) {
        const intel = sub.property_ai_intelligence
        const listing = sub.property_ai_listings
        const priceEur = listing?.estimated_price_eur ?? 320_000
        const commission = priceEur * COMMISSION_RATE

        const createdAt = new Date(sub.created_at)
        const ageMs = Date.now() - createdAt.getTime()
        const olderThan7Days = ageMs > 7 * 24 * 60 * 60 * 1000

        if (intel) {
          // listing_boost: low homepage placement AND older than 7 days
          if (intel.homepage_placement_score < 50 && olderThan7Days) {
            actions.push({
              id: randomUUID(),
              type: 'listing_boost',
              title: 'Imóvel com baixa visibilidade na homepage',
              description: `Score de posicionamento ${intel.homepage_placement_score}/100 — optimizar para aumentar exposição e leads qualificadas.`,
              urgency: 'esta_semana',
              impact_eur: formatImpact(commission * 0.4),
              property_id: sub.submission_id,
              cta_label: 'Optimizar Listagem',
              cta_href: `/dashboard/properties/${sub.submission_id}`,
            })
          }

          // photo_improvement or price_adjustment: low demand score
          if (intel.demand_score < 40) {
            const isVeryLow = intel.demand_score < 25
            if (isVeryLow) {
              actions.push({
                id: randomUUID(),
                type: 'price_adjustment',
                title: 'Ajuste de preço recomendado',
                description: `Score de procura ${intel.demand_score}/100 — considerar revisão de preço para reactivar interesse de compradores.`,
                urgency: olderThan7Days ? 'hoje' : 'esta_semana',
                impact_eur: formatImpact(commission * 0.6),
                property_id: sub.submission_id,
                cta_label: 'Rever Preço',
                cta_href: `/dashboard/properties/${sub.submission_id}`,
              })
            } else {
              actions.push({
                id: randomUUID(),
                type: 'photo_improvement',
                title: 'Qualidade visual abaixo do ideal',
                description: `Score de procura ${intel.demand_score}/100 — melhorar fotos e descrição para aumentar taxa de conversão.`,
                urgency: 'esta_semana',
                impact_eur: formatImpact(commission * 0.3),
                property_id: sub.submission_id,
                cta_label: 'Melhorar Apresentação',
                cta_href: `/dashboard/properties/${sub.submission_id}`,
              })
            }
          }
        }
      }
    }
  } catch (err) {
    logger.warn('[agent/actions] submissions fetch failed — skipping', { err })
  }

  // ── 2. Contacts with high score or recent activity ────────────────────────────
  try {
    type ContactRow = {
      id: string
      name?: string
      score?: number
      last_contact_at?: string
      budget_max?: number
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: contacts, error: cErr } = await (supabaseAdmin as any)
      .from('contacts')
      .select('id, name, score, last_contact_at, budget_max')
      .gte('score', 70)
      .order('score', { ascending: false })
      .limit(10) as { data: ContactRow[] | null; error: { message: string } | null }

    if (!cErr && contacts) {
      for (const contact of contacts) {
        const lastContact = contact.last_contact_at ? new Date(contact.last_contact_at) : null
        const daysSinceContact = lastContact
          ? (Date.now() - lastContact.getTime()) / (1000 * 60 * 60 * 24)
          : 999

        if (daysSinceContact > 7) {
          const budget = contact.budget_max ?? 320_000
          actions.push({
            id: randomUUID(),
            type: 'follow_up',
            title: `Follow-up pendente — ${contact.name ?? 'Comprador qualificado'}`,
            description: `Lead com score ${contact.score ?? '–'}/100 sem contacto há ${Math.round(daysSinceContact)} dias — janela de engagement a fechar.`,
            urgency: daysSinceContact > 14 ? 'hoje' : 'esta_semana',
            impact_eur: formatImpact(budget * COMMISSION_RATE * 0.3),
            contact_id: contact.id,
            cta_label: 'Contactar Agora',
            cta_href: `/dashboard/crm/${contact.id}`,
          })
        }
      }
    }
  } catch (err) {
    logger.warn('[agent/actions] contacts fetch failed — skipping', { err })
  }

  // ── 3. Opportunity Radar signals ──────────────────────────────────────────────
  try {
    const scan = opportunityRadar.scan('agency-group')

    for (const signal of scan.signals) {
      const typeMap: Record<string, ActionType> = {
        hot_lead:          'follow_up',
        stale_deal:        'deal_risk',
        market_timing:     'opportunity',
        competitor_gap:    'opportunity',
        price_reduction:   'listing_boost',
        follow_up_overdue: 'follow_up',
        high_value_match:  'opportunity',
      }

      const actionType: ActionType = typeMap[signal.type] ?? 'opportunity'

      const ctaMap: Record<string, { label: string; href: string }> = {
        hot_lead:          { label: 'Enviar Proposta',    href: '/dashboard/crm' },
        stale_deal:        { label: 'Reactivar Deal',     href: '/dashboard/deals' },
        market_timing:     { label: 'Acelerar Negócios',  href: '/dashboard/deals' },
        competitor_gap:    { label: 'Lançar Campanha',    href: '/dashboard/campanhas' },
        price_reduction:   { label: 'Notificar Compradores', href: '/dashboard/crm' },
        follow_up_overdue: { label: 'Contactar Lead',     href: '/dashboard/crm' },
        high_value_match:  { label: 'Agendar Visita',     href: '/dashboard/properties' },
      }

      const cta = ctaMap[signal.type] ?? { label: 'Ver Detalhes', href: '/dashboard' }

      actions.push({
        id: signal.signal_id,
        type: actionType,
        title: signal.title,
        description: signal.recommended_action,
        urgency: radarUrgencyToAG(signal.urgency),
        impact_eur: formatImpact(signal.expected_value_eur * signal.probability),
        cta_label: cta.label,
        cta_href: cta.href,
      })
    }
  } catch (err) {
    logger.warn('[agent/actions] radar scan failed — skipping', { err })
  }

  // ── 4. Stale deals (no update in 7+ days, not closed) ────────────────────────
  try {
    type DealRow = {
      id: string
      title?: string
      valor?: number
      stage?: string
      updated_at: string
      contact_name?: string
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: deals, error: dealErr } = await (supabaseAdmin as any)
      .from('deals')
      .select('id, title, valor, stage, updated_at, contact_name')
      .neq('stage', 'closed_won')
      .neq('stage', 'closed_lost')
      .lt('updated_at', sevenDaysAgo)
      .order('updated_at', { ascending: true })
      .limit(10) as { data: DealRow[] | null; error: { message: string } | null }

    if (!dealErr && deals) {
      for (const deal of deals) {
        const daysStale = Math.round(
          (Date.now() - new Date(deal.updated_at).getTime()) / (1000 * 60 * 60 * 24)
        )
        const dealValue = deal.valor ?? 320_000
        actions.push({
          id: randomUUID(),
          type: 'deal_risk',
          title: `Deal parado — ${deal.title ?? deal.contact_name ?? 'Negócio em risco'}`,
          description: `Sem actividade há ${daysStale} dias em fase "${deal.stage ?? 'desconhecida'}" — risco de perda elevado.`,
          urgency: daysStale > 14 ? 'hoje' : 'esta_semana',
          impact_eur: formatImpact(dealValue * COMMISSION_RATE * 0.5),
          cta_label: 'Rever Deal',
          cta_href: `/dashboard/deals/${deal.id}`,
        })
      }
    }
  } catch (err) {
    logger.warn('[agent/actions] deals fetch failed — skipping', { err })
  }

  // ── 5. Sort: urgency (hoje first) then impact_eur desc ────────────────────────

  const urgencyOrder: Record<Urgency, number> = { hoje: 0, esta_semana: 1, este_mes: 2 }

  actions.sort((a, b) => {
    const uDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
    if (uDiff !== 0) return uDiff
    return b.impact_eur - a.impact_eur
  })

  const top20 = actions.slice(0, 20)
  const total_impact_eur = top20.reduce((sum, a) => sum + a.impact_eur, 0)

  logger.info('[agent/actions] generated', { count: top20.length, total_impact_eur })

  return NextResponse.json({
    actions: top20,
    total_impact_eur,
    generated_at: new Date().toISOString(),
  })
}
