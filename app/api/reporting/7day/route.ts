// =============================================================================
// Agency Group — 7-Day Operational Report
// GET /api/reporting/7day
//
// Returns 7-day funnel metrics for measured operation:
//   - leads/day throughput
//   - scoring velocity
//   - matching rate
//   - price intelligence coverage
//   - deal evaluation coverage
//   - classification distribution
//   - SLA compliance
//   - conversion funnel
//   - top leads to attack now
//   - bottlenecks
//
// Auth: CRON_SECRET or session
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { auth } from '@/auth'

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const cronSecret = process.env.CRON_SECRET
    const incomingSecret = req.headers.get('x-cron-secret')
      ?? req.headers.get('authorization')?.replace('Bearer ', '')
    const isCron = cronSecret && incomingSecret === cronSecret
    if (!isCron) {
      const session = await auth()
      if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = supabaseAdmin as any
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const sevenDaysAgoISO = sevenDaysAgo.toISOString()

    // Run all queries in parallel
    const [
      r_all_leads,
      r_scored,
      r_matched,
      r_priced,
      r_evaluated,
      r_preclose,
      r_contacted,
      r_sla_breaches,
      r_top_attack,
      r_classifications,
      r_negotiations,
      r_cpcv,
      // FASE 18 — Bottleneck detail queries
      r_high_rank_no_action,
      r_no_contact_high_value,
      r_price_intel_missing,
      r_buyer_missing,
      r_preclose_not_contacted,
      // FASE 19 — Micro automation
      r_deal_stalled,
      r_cpcv_ready,
      // FASE 20 — Money Engine
      r_pipeline_value,
      r_cpcv_forecast,
    ] = await Promise.all([
      // All leads in last 7 days
      s.from('offmarket_leads')
        .select('id, created_at, score, status, sla_contacted_at, sla_breach')
        .gte('created_at', sevenDaysAgoISO)
        .order('created_at', { ascending: true }),

      // Scored leads (last 7 days)
      s.from('offmarket_leads')
        .select('id, score, last_score_at')
        .gte('last_score_at', sevenDaysAgoISO)
        .not('score', 'is', null),

      // Buyer-matched leads (last 7 days)
      s.from('offmarket_leads')
        .select('id, matched_buyers_count, buyer_matched_at')
        .gte('buyer_matched_at', sevenDaysAgoISO)
        .gt('matched_buyers_count', 0),

      // Price-intel leads (last 7 days)
      s.from('offmarket_leads')
        .select('id, price_opportunity_score, price_intelligence_updated_at')
        .gte('price_intelligence_updated_at', sevenDaysAgoISO)
        .not('price_opportunity_score', 'is', null),

      // Deal-eval leads (last 7 days)
      s.from('offmarket_leads')
        .select('id, deal_evaluation_score, master_attack_rank, deal_evaluation_updated_at')
        .gte('deal_evaluation_updated_at', sevenDaysAgoISO)
        .not('deal_evaluation_score', 'is', null),

      // Preclose candidates (active)
      s.from('offmarket_leads')
        .select('id, nome, score, master_attack_rank, status')
        .eq('preclose_candidate', true)
        .not('status', 'in', '("closed_won","closed_lost","not_interested")'),

      // Contacted leads (last 7 days)
      s.from('offmarket_leads')
        .select('id, sla_contacted_at, status')
        .gte('sla_contacted_at', sevenDaysAgoISO)
        .not('sla_contacted_at', 'is', null),

      // SLA breaches (active)
      s.from('offmarket_leads')
        .select('id, nome, score, created_at, sla_breach')
        .eq('sla_breach', true)
        .not('status', 'in', '("closed_won","closed_lost")'),

      // Top attack leads — ordered by money_priority_score (revenue × velocity)
      s.from('offmarket_leads')
        .select('id, nome, score, master_attack_rank, money_priority_score, deal_evaluation_score, execution_probability, deal_evaluation_reason, cidade, tipo_ativo, price_ask, cpcv_probability, deal_readiness_score, buyer_pressure_class, buyer_competition_flag, execution_blocker_reason, data_completeness_score, deal_kill_flag')
        .not('status', 'in', '("closed_won","closed_lost","not_interested")')
        .neq('execution_blocker_reason', 'deal_kill')
        .not('nome', 'ilike', '%test%')
        .not('nome', 'ilike', '%e2e%')
        .not('nome', 'ilike', '%direct%')
        .order('money_priority_score', { ascending: false, nullsFirst: false })
        .order('master_attack_rank', { ascending: false, nullsFirst: false })
        .limit(10),

      // Classification distribution
      s.from('offmarket_leads')
        .select('deal_evaluation_reason')
        .not('deal_evaluation_reason', 'is', null),

      // Active negotiations
      s.from('offmarket_leads')
        .select('id, nome, negotiation_status, offer_amount, deal_next_step_date')
        .not('negotiation_status', 'in', '("idle","withdrawn")')
        .not('status', 'in', '("closed_won","closed_lost")'),

      // CPCV pipeline
      s.from('offmarket_leads')
        .select('id, nome, cpcv_target_date, cpcv_signed_at, escritura_target_date, deal_risk_level')
        .or('cpcv_target_date.not.is.null,cpcv_signed_at.not.is.null')
        .is('escritura_done_at', null),

      // FASE 18 — Bottleneck detail: high rank but no SLA contact
      s.from('offmarket_leads')
        .select('id, nome, master_attack_rank, score, contacto, cidade, execution_blocker_reason')
        .gte('master_attack_rank', 70)
        .is('sla_contacted_at', null)
        .not('status', 'in', '("closed_won","closed_lost","not_interested")')
        .order('master_attack_rank', { ascending: false })
        .limit(10),

      // No contacto, high value (score ≥70)
      s.from('offmarket_leads')
        .select('id, nome, score, master_attack_rank, cidade, tipo_ativo, price_ask')
        .or('contacto.is.null,contacto.eq.')
        .gte('score', 70)
        .not('status', 'in', '("closed_won","closed_lost","not_interested")')
        .order('score', { ascending: false })
        .limit(10),

      // Has price_ask + area_m2 but no price-intel (gross_discount_pct null)
      s.from('offmarket_leads')
        .select('id, nome, score, price_ask, area_m2, cidade, tipo_ativo')
        .not('price_ask', 'is', null)
        .not('area_m2', 'is', null)
        .is('gross_discount_pct', null)
        .not('status', 'in', '("closed_won","closed_lost","not_interested")')
        .order('score', { ascending: false })
        .limit(10),

      // Has score ≥60 but 0 matched buyers
      s.from('offmarket_leads')
        .select('id, nome, score, master_attack_rank, cidade, tipo_ativo')
        .gte('score', 60)
        .or('matched_buyers_count.is.null,matched_buyers_count.eq.0')
        .not('status', 'in', '("closed_won","closed_lost","not_interested")')
        .order('score', { ascending: false })
        .limit(10),

      // Preclose candidates with no SLA contact
      s.from('offmarket_leads')
        .select('id, nome, score, master_attack_rank, contacto, cidade, tipo_ativo, price_ask')
        .eq('preclose_candidate', true)
        .is('sla_contacted_at', null)
        .not('status', 'in', '("closed_won","closed_lost","not_interested")')
        .order('master_attack_rank', { ascending: false })
        .limit(10),

      // FASE 19 — Micro automation: deals stalled (has contact, >48h no meeting in active negotiation)
      s.from('offmarket_leads')
        .select('id, nome, score, master_attack_rank, negotiation_status, offer_date, deal_readiness_score, cpcv_probability')
        .not('offer_date', 'is', null)
        .is('cpcv_signed_at', null)
        .not('negotiation_status', 'in', '("idle","withdrawn")')
        .lt('offer_date', new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString())
        .not('status', 'in', '("closed_won","closed_lost","not_interested")')
        .order('cpcv_probability', { ascending: false })
        .limit(10),

      // CPCV ready (deal_readiness_score ≥80)
      s.from('offmarket_leads')
        .select('id, nome, score, master_attack_rank, deal_readiness_score, cpcv_probability, buyer_pressure_class, money_priority_score')
        .gte('deal_readiness_score', 80)
        .not('status', 'in', '("closed_won","closed_lost","not_interested")')
        .order('cpcv_probability', { ascending: false })
        .limit(10),

      // FASE 20 — Pipeline value (active leads with price_ask)
      s.from('offmarket_leads')
        .select('price_ask')
        .not('status', 'in', '("closed_won","closed_lost","not_interested")')
        .not('price_ask', 'is', null)
        .not('nome', 'ilike', '%test%')
        .not('nome', 'ilike', '%e2e%'),

      // CPCV forecast — leads with cpcv_probability ≥65
      s.from('offmarket_leads')
        .select('id, nome, cpcv_probability, money_priority_score, price_ask, buyer_pressure_class')
        .gte('cpcv_probability', 65)
        .not('status', 'in', '("closed_won","closed_lost","not_interested")')
        .order('cpcv_probability', { ascending: false })
        .limit(10),
    ])

    const allLeads = r_all_leads.data ?? []
    const scored   = r_scored.data ?? []
    const matched  = r_matched.data ?? []
    const priced   = r_priced.data ?? []
    const evaluated = r_evaluated.data ?? []
    const preclose  = r_preclose.data ?? []
    const contacted = r_contacted.data ?? []
    const slaBreaches = r_sla_breaches.data ?? []
    const topAttack = r_top_attack.data ?? []
    const allClassifications = r_classifications.data ?? []
    const negotiations = r_negotiations.data ?? []
    const cpcvPipeline = r_cpcv.data ?? []
    // FASE 18 — Bottleneck detail
    const highRankNoAction     = r_high_rank_no_action.data ?? []
    const noContactHighValue   = r_no_contact_high_value.data ?? []
    const priceIntelMissing    = r_price_intel_missing.data ?? []
    const buyerMissing         = r_buyer_missing.data ?? []
    const precloseNotContacted = r_preclose_not_contacted.data ?? []
    // FASE 19 — Micro automation
    const dealStalled          = r_deal_stalled.data ?? []
    const cpcvReady            = r_cpcv_ready.data ?? []
    // FASE 20 — Money Engine
    const pipelineLeads        = r_pipeline_value.data ?? []
    const cpcvForecast         = r_cpcv_forecast.data ?? []
    const pipelineValueEur     = pipelineLeads
      .reduce((sum: number, l: { price_ask: number | null }) => sum + (l.price_ask ?? 0), 0)
    const cpcvForecastValueEur = cpcvForecast
      .reduce((sum: number, l: { price_ask: number | null }) => sum + (l.price_ask ?? 0), 0)

    // ── Daily breakdown (last 7 days) ────────────────────────────────────────
    const dailyBreakdown: Array<{
      date: string
      leads_created: number
      leads_scored: number
      avg_score: number | null
    }> = []

    for (let d = 6; d >= 0; d--) {
      const dayStart = new Date(now)
      dayStart.setDate(dayStart.getDate() - d)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(dayStart)
      dayEnd.setHours(23, 59, 59, 999)

      const dayLeads = allLeads.filter((l: { created_at: string }) => {
        const t = new Date(l.created_at)
        return t >= dayStart && t <= dayEnd
      })

      const dayScored = scored.filter((l: { last_score_at: string }) => {
        const t = new Date(l.last_score_at)
        return t >= dayStart && t <= dayEnd
      })

      const avgScore = dayLeads.length > 0
        ? Math.round(dayLeads.filter((l: { score: number | null }) => l.score !== null)
            .reduce((sum: number, l: { score: number }) => sum + l.score, 0) / Math.max(dayLeads.length, 1))
        : null

      dailyBreakdown.push({
        date: dayStart.toISOString().split('T')[0],
        leads_created: dayLeads.length,
        leads_scored: dayScored.length,
        avg_score: avgScore,
      })
    }

    // ── Classification distribution ──────────────────────────────────────────
    const classificationMap: Record<string, number> = {}
    for (const item of allClassifications) {
      const reason = (item.deal_evaluation_reason as string) ?? ''
      const match = reason.match(/^\[([^\]]+)\]/)
      const label = match ? match[1] : 'unknown'
      classificationMap[label] = (classificationMap[label] ?? 0) + 1
    }

    // ── Funnel metrics ────────────────────────────────────────────────────────
    // Total active leads (all time)
    const { count: totalActive } = await s
      .from('offmarket_leads')
      .select('id', { count: 'exact', head: true })
      .not('status', 'in', '("closed_won","closed_lost","not_interested")')

    const { count: totalScored } = await s
      .from('offmarket_leads')
      .select('id', { count: 'exact', head: true })
      .not('score', 'is', null)
      .not('status', 'in', '("closed_won","closed_lost","not_interested")')

    const { count: totalMatched } = await s
      .from('offmarket_leads')
      .select('id', { count: 'exact', head: true })
      .gt('matched_buyers_count', 0)
      .not('status', 'in', '("closed_won","closed_lost","not_interested")')

    const { count: totalPriced } = await s
      .from('offmarket_leads')
      .select('id', { count: 'exact', head: true })
      .not('price_opportunity_score', 'is', null)
      .not('status', 'in', '("closed_won","closed_lost","not_interested")')

    const { count: totalEvaluated } = await s
      .from('offmarket_leads')
      .select('id', { count: 'exact', head: true })
      .not('deal_evaluation_score', 'is', null)
      .not('status', 'in', '("closed_won","closed_lost","not_interested")')

    // ── SLA compliance ────────────────────────────────────────────────────────
    const p0Leads = allLeads.filter((l: { score: number | null }) => (l.score ?? 0) >= 80)
    const p0Contacted = p0Leads.filter((l: { sla_contacted_at: string | null }) => l.sla_contacted_at !== null)
    const slaComplianceRate = p0Leads.length > 0
      ? Math.round((p0Contacted.length / p0Leads.length) * 100)
      : null

    // ── Average scores ────────────────────────────────────────────────────────
    const evalScores = evaluated.map((l: { deal_evaluation_score: number }) => l.deal_evaluation_score).filter(Boolean)
    const avgEvalScore = evalScores.length > 0
      ? Math.round(evalScores.reduce((a: number, b: number) => a + b, 0) / evalScores.length)
      : null

    const rankScores = evaluated.map((l: { master_attack_rank: number }) => l.master_attack_rank).filter(Boolean)
    const avgRank = rankScores.length > 0
      ? Math.round(rankScores.reduce((a: number, b: number) => a + b, 0) / rankScores.length)
      : null

    // ── Bottleneck analysis ───────────────────────────────────────────────────
    const bottlenecks: string[] = []
    if ((totalScored ?? 0) < (totalActive ?? 0) * 0.8) {
      bottlenecks.push(`${(totalActive ?? 0) - (totalScored ?? 0)} leads sem score`)
    }
    if ((totalMatched ?? 0) < (totalScored ?? 0) * 0.5) {
      bottlenecks.push(`${(totalScored ?? 0) - (totalMatched ?? 0)} leads scored sem buyer match`)
    }
    if ((totalEvaluated ?? 0) < (totalScored ?? 0) * 0.6) {
      bottlenecks.push(`${(totalScored ?? 0) - (totalEvaluated ?? 0)} leads sem deal evaluation`)
    }
    if (slaBreaches.length > 0) {
      bottlenecks.push(`${slaBreaches.length} SLA breaches activos`)
    }

    return NextResponse.json({
      period: {
        from: sevenDaysAgoISO,
        to: now.toISOString(),
        days: 7,
      },

      // 7-day activity
      activity_7d: {
        leads_created: allLeads.length,
        leads_scored: scored.length,
        leads_matched: matched.length,
        leads_priced: priced.length,
        leads_evaluated: evaluated.length,
        leads_contacted: contacted.length,
        sla_breaches: slaBreaches.length,
        p0_sla_compliance_pct: slaComplianceRate,
      },

      // Daily breakdown
      daily_breakdown: dailyBreakdown,

      // Full pipeline funnel (all time)
      funnel_all_time: {
        active_leads: totalActive ?? 0,
        scored: totalScored ?? 0,
        buyer_matched: totalMatched ?? 0,
        price_intel_done: totalPriced ?? 0,
        deal_evaluated: totalEvaluated ?? 0,
        preclose_candidates: preclose.length,
        active_negotiations: negotiations.length,
        cpcv_pipeline: cpcvPipeline.length,
      },

      // Score quality
      score_quality: {
        avg_deal_evaluation_score: avgEvalScore,
        avg_master_attack_rank: avgRank,
      },

      // Classification distribution (all evaluated leads)
      classification_distribution: classificationMap,

      // Top leads to attack now
      top_attack_leads: topAttack,

      // Bottlenecks (string array — summary)
      bottlenecks,

      // FASE 18 — Structured bottleneck detail
      bottleneck_detail: {
        high_rank_no_action: {
          count: highRankNoAction.length,
          label: 'Rank alto sem contacto (≥70)',
          leads: highRankNoAction,
        },
        no_contact_high_value: {
          count: noContactHighValue.length,
          label: 'Score alto sem telefone/email (≥70)',
          leads: noContactHighValue,
        },
        price_intel_missing: {
          count: priceIntelMissing.length,
          label: 'Tem preço+área mas sem análise de desconto',
          leads: priceIntelMissing,
        },
        buyer_missing: {
          count: buyerMissing.length,
          label: 'Score ≥60 sem compradores matched',
          leads: buyerMissing,
        },
        preclose_not_contacted: {
          count: precloseNotContacted.length,
          label: 'Preclose candidate sem contacto SLA',
          leads: precloseNotContacted,
        },
        // FASE 19 — Micro automation flags
        deal_stalled: {
          count: dealStalled.length,
          label: 'Deal com proposta enviada >48h sem CPCV (stalled)',
          leads: dealStalled,
        },
        cpcv_ready: {
          count: cpcvReady.length,
          label: 'Deal readiness ≥80 — prontos para fechar CPCV',
          leads: cpcvReady,
        },
      },

      // FASE 19+20 — Money Engine metrics
      closing_metrics: {
        deals_ready_to_close:    cpcvReady.length,
        deals_stalled:           dealStalled.length,
        cpcv_forecast_30d:       cpcvForecast.length,
        avg_cpcv_probability:    (() => {
          const scores = cpcvForecast
            .map((l: { cpcv_probability: number | null }) => l.cpcv_probability)
            .filter(Boolean) as number[]
          return scores.length > 0
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            : null
        })(),
        pipeline_value_eur:      pipelineValueEur,
        cpcv_forecast_value_eur: cpcvForecastValueEur,
        commission_forecast_eur: Math.round(cpcvForecastValueEur * 0.05),
        cpcv_forecast_leads:     cpcvForecast,
      },

      // Upcoming deadlines
      upcoming: {
        cpcv_this_week: cpcvPipeline.filter((l: { cpcv_target_date: string | null }) => {
          if (!l.cpcv_target_date) return false
          const d = new Date(l.cpcv_target_date)
          return d <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
        }).length,
        escritura_this_month: cpcvPipeline.filter((l: { escritura_target_date: string | null }) => {
          if (!l.escritura_target_date) return false
          const d = new Date(l.escritura_target_date)
          return d <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        }).length,
      },
    })
  } catch (err) {
    console.error('[reporting/7day]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
