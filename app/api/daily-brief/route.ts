// AGENCY GROUP — SH-ROS | AMI: 22506
// Daily Brief API — morning intelligence layer for the field agent
// GET /api/daily-brief
// Auth: isPortalAuth (cookie or CRON_SECRET/INTERNAL_API_TOKEN)
// Runtime: nodejs | maxDuration: 15

import { NextRequest, NextResponse } from 'next/server'
import { isPortalAuth } from '@/lib/portalAuth'
import { supabaseAdmin } from '@/lib/supabase'
import { opportunityRadar } from '@/lib/executive/opportunityRadar'
import { logger } from '@/lib/observability/logger'

export const runtime = 'nodejs'
export const maxDuration = 15

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseAdmin as unknown as { from: (t: string) => any }

// ─── Types ────────────────────────────────────────────────────────────────────

interface MorningAction {
  priority: number
  action: string
  why: string
  expected_impact_eur: number
  urgency: 'agora' | 'hoje' | 'esta_semana'
}

interface TopOpportunity {
  title: string
  expected_value_eur: number
  action_required: string
}

interface BriefAlert {
  type: 'warning' | 'info' | 'success'
  message: string
}

interface DailyBriefResponse {
  date: string
  greeting: string
  live_listings: number
  listings_needing_action: number
  hot_leads: number
  active_deals: number
  estimated_daily_opportunity_eur: number
  morning_actions: MorningAction[]
  top_opportunities: TopOpportunity[]
  alerts: BriefAlert[]
  generated_at: string
}

// ─── PT date helper ───────────────────────────────────────────────────────────

function ptDate(d: Date): string {
  const months = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  ]
  return `${d.getDate()} de ${months[d.getMonth()]}`
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  logger.info('[daily-brief] Building morning brief', {
    route: 'api/daily-brief',
    correlation_id: 'daily-brief',
  })

  // ── 1. Live submissions + demand_score < 40 ────────────────────────────────
  let live_listings = 0
  let listings_needing_action = 0
  try {
    const { data: allListings } = await sb
      .from('property_ai_intelligence')
      .select('id, demand_score')
    if (allListings) {
      live_listings = allListings.length
      listings_needing_action = allListings.filter(
        (l: { demand_score: number }) => l.demand_score < 40,
      ).length
    }
  } catch {
    // non-fatal — brief continues with zeros
  }

  // ── 2. Hot contacts (score >= 70, not contacted in 7d) ────────────────────
  let hot_leads = 0
  try {
    const { data: hotContacts } = await sb
      .from('contacts')
      .select('id')
      .gte('score', 70)
      .or(`last_contacted_at.is.null,last_contacted_at.lt.${sevenDaysAgo}`)
    hot_leads = hotContacts?.length ?? 0
  } catch {
    // non-fatal
  }

  // ── 3. Top 3 opportunities from opportunityRadar ──────────────────────────
  let top_opportunities: TopOpportunity[] = []
  try {
    const signals = opportunityRadar.getTopOpportunities('agency-group', 3)
    top_opportunities = signals.map(s => ({
      title: s.title,
      expected_value_eur: Math.round(s.expected_value_eur),
      action_required: s.recommended_action,
    }))
  } catch {
    // non-fatal — radar may be cold
  }

  // ── 4. Active deals updated in last 7 days ────────────────────────────────
  let active_deals = 0
  try {
    const { data: deals } = await sb
      .from('deals')
      .select('id')
      .gte('updated_at', sevenDaysAgo)
    active_deals = deals?.length ?? 0
  } catch {
    // non-fatal
  }

  // ── Revenue snapshot ──────────────────────────────────────────────────────
  // hot_leads × avg deal value (€500K) × commission (5%) × close rate (8%)
  const estimated_daily_opportunity_eur = Math.round(hot_leads * 500_000 * 0.05 * 0.08)

  // ── Morning actions ───────────────────────────────────────────────────────
  const morning_actions: MorningAction[] = []

  if (hot_leads > 0) {
    morning_actions.push({
      priority: 1,
      action: `Contactar ${hot_leads} lead${hot_leads > 1 ? 's' : ''} quente${hot_leads > 1 ? 's' : ''}`,
      why: 'Leads com score ≥70 sem follow-up há mais de 7 dias — janela de fecho a fechar.',
      expected_impact_eur: hot_leads * 40_000,
      urgency: 'agora',
    })
  }

  if (listings_needing_action > 0) {
    morning_actions.push({
      priority: morning_actions.length + 1,
      action: `Rever ${listings_needing_action} imóvel${listings_needing_action > 1 ? 'eis' : ''} com procura baixa`,
      why: 'Propriedades com demand_score < 40 estão a perder visibilidade — ajuste de preço ou campanha urgente.',
      expected_impact_eur: listings_needing_action * 10_000,
      urgency: 'hoje',
    })
  }

  if (active_deals > 0) {
    morning_actions.push({
      priority: morning_actions.length + 1,
      action: `Acompanhar ${active_deals} negócio${active_deals > 1 ? 's' : ''} activo${active_deals > 1 ? 's' : ''}`,
      why: 'Negócios com actividade recente requerem follow-up consistente para manter momentum.',
      expected_impact_eur: active_deals * 50_000,
      urgency: 'hoje',
    })
  }

  // ── Alerts ────────────────────────────────────────────────────────────────
  const alerts: BriefAlert[] = []

  if (hot_leads > 3) {
    alerts.push({
      type: 'warning',
      message: `Atenção: ${hot_leads} leads quentes sem follow-up há mais de 7 dias`,
    })
  }

  if (listings_needing_action > 5) {
    alerts.push({
      type: 'warning',
      message: `${listings_needing_action} imóveis com procura baixa — possível perda de receita`,
    })
  }

  if (live_listings > 0) {
    alerts.push({
      type: 'success',
      message: `Sistema operacional com ${live_listings} imóvel${live_listings > 1 ? 'eis' : ''} live`,
    })
  }

  const brief: DailyBriefResponse = {
    date: ptDate(now),
    greeting: 'Bom dia! Aqui está o seu brief de hoje.',
    live_listings,
    listings_needing_action,
    hot_leads,
    active_deals,
    estimated_daily_opportunity_eur,
    morning_actions,
    top_opportunities,
    alerts,
    generated_at: now.toISOString(),
  }

  logger.info('[daily-brief] Brief built successfully', {
    route: 'api/daily-brief',
    correlation_id: 'daily-brief',
  })

  return NextResponse.json(brief)
}
