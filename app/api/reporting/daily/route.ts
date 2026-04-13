// =============================================================================
// Agency Group — Daily Execution Report
// GET /api/reporting/daily
// Returns: leads nova, SLA alerts, priority queue, pre-close, follow-ups due
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { auth } from '@/auth'

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const cronSecret = process.env.CRON_SECRET
    const incomingSecret = req.headers.get('x-cron-secret') ?? req.headers.get('authorization')?.replace('Bearer ', '')
    const isCron = cronSecret && incomingSecret === cronSecret
    if (!isCron) {
      const session = await auth()
      if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = supabaseAdmin as any

    const now = new Date()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(now)
    todayEnd.setHours(23, 59, 59, 999)
    // stale_hot_lead threshold = 14 days (consistent with risk-flags.ts fallback)
    const staleAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    const [
      r_today_leads,
      r_p0,
      r_p1,
      r_preclose,
      r_followup_due,
      r_stale,
      r_active_negotiations,
      r_cpcv_pipeline,
      r_sla_breach,
    ] = await Promise.all([
      // New leads today
      s.from('offmarket_leads')
        .select('id,nome,cidade,score,urgency,status,contacto,assigned_to,created_at')
        .gte('created_at', todayStart.toISOString())
        .order('score', { ascending: false }),

      // P0: score >= 80, status = new — include buyer + price + deal evaluation
      // Excludes test leads (migration 011 sets them to not_interested, but double-filter)
      s.from('offmarket_leads')
        .select('id,nome,cidade,score,urgency,contacto,sla_contacted_at,created_at,assigned_to,score_reason,deal_priority_score,attack_recommendation,buyer_triad_notes,matched_buyers_count,best_buyer_match_score,price_ask,area_m2,price_ask_per_m2,gross_discount_pct,comp_confidence_score,price_opportunity_score,price_reason,estimated_fair_value,preclose_candidate,outreach_ready,negotiation_status,offer_amount,counter_offer_amount,cpcv_target_date,cpcv_signed_at,deposit_received,legal_status,docs_pending,escritura_target_date,escritura_done_at,deal_risk_level,deal_risk_reason,deal_owner,deal_next_step,deal_next_step_date,primary_buyer_id,secondary_buyer_id,tertiary_buyer_id,buyer_match_notes,deal_evaluation_score,master_attack_rank,execution_probability,adjusted_discount_score,liquidity_score,best_buyer_execution_score,risk_adjusted_upside_score,deal_evaluation_reason,master_attack_reason,execution_blocker_reason,data_completeness_score,sla_breach,money_priority_score,cpcv_probability,deal_readiness_score,buyer_pressure_class,buyer_competition_flag,deal_kill_flag')
        .gte('score', 80)
        .eq('status', 'new')
        .not('nome', 'ilike', '%test%')
        .not('nome', 'ilike', '%e2e%')
        .not('nome', 'ilike', '%direct%')
        .order('money_priority_score', { ascending: false, nullsFirst: false })
        .order('master_attack_rank', { ascending: false, nullsFirst: false })
        .limit(20),

      // P1: score 70-79, status = new — include buyer + price + deal evaluation
      s.from('offmarket_leads')
        .select('id,nome,cidade,score,urgency,contacto,sla_contacted_at,created_at,assigned_to,score_reason,deal_priority_score,attack_recommendation,buyer_triad_notes,matched_buyers_count,best_buyer_match_score,price_ask,area_m2,price_ask_per_m2,gross_discount_pct,comp_confidence_score,price_opportunity_score,price_reason,estimated_fair_value,preclose_candidate,outreach_ready,negotiation_status,offer_amount,counter_offer_amount,cpcv_target_date,cpcv_signed_at,deposit_received,legal_status,docs_pending,escritura_target_date,escritura_done_at,deal_risk_level,deal_risk_reason,deal_owner,deal_next_step,deal_next_step_date,primary_buyer_id,secondary_buyer_id,tertiary_buyer_id,buyer_match_notes,deal_evaluation_score,master_attack_rank,execution_probability,adjusted_discount_score,liquidity_score,best_buyer_execution_score,risk_adjusted_upside_score,deal_evaluation_reason,master_attack_reason,execution_blocker_reason,data_completeness_score,sla_breach,money_priority_score,cpcv_probability,deal_readiness_score,buyer_pressure_class,buyer_competition_flag,deal_kill_flag')
        .gte('score', 70)
        .lt('score', 80)
        .eq('status', 'new')
        .not('nome', 'ilike', '%e2e%')
        .not('nome', 'ilike', '%direct%')
        .order('money_priority_score', { ascending: false, nullsFirst: false })
        .order('master_attack_rank', { ascending: false, nullsFirst: false })
        .limit(20),

      // Pre-close candidates — include buyer + price + deal evaluation
      s.from('offmarket_leads')
        .select('id,nome,cidade,score,matched_buyers_count,best_buyer_match_score,buyer_match_notes,status,contacto,assigned_to,created_at,sla_contacted_at,deal_priority_score,attack_recommendation,buyer_triad_notes,price_ask,area_m2,price_ask_per_m2,gross_discount_pct,comp_confidence_score,price_opportunity_score,price_reason,estimated_fair_value,preclose_candidate,outreach_ready,negotiation_status,offer_amount,counter_offer_amount,cpcv_target_date,cpcv_signed_at,deposit_received,legal_status,docs_pending,escritura_target_date,escritura_done_at,deal_risk_level,deal_risk_reason,deal_owner,deal_next_step,deal_next_step_date,primary_buyer_id,secondary_buyer_id,tertiary_buyer_id,deal_evaluation_score,master_attack_rank,execution_probability,adjusted_discount_score,liquidity_score,best_buyer_execution_score,risk_adjusted_upside_score,deal_evaluation_reason,master_attack_reason')
        .eq('preclose_candidate', true)
        .not('status', 'in', '("closed_won","closed_lost","not_interested")')
        .order('master_attack_rank', { ascending: false })
        .limit(10),

      // Follow-ups due today
      s.from('offmarket_leads')
        .select('id,nome,cidade,score,status,contacto,next_followup_at,assigned_to')
        .lte('next_followup_at', todayEnd.toISOString())
        .gte('next_followup_at', todayStart.toISOString())
        .not('status', 'in', '("closed_won","closed_lost")')
        .order('score', { ascending: false })
        .limit(30),

      // Stale hot leads (contacted/interested, no contact >14 days)
      s.from('offmarket_leads')
        .select('id,nome,cidade,score,status,contacto,last_contact_at,assigned_to')
        .in('status', ['contacted', 'interested'])
        .lt('last_contact_at', staleAgo.toISOString())
        .order('score', { ascending: false })
        .limit(20),

      // Active negotiations
      s.from('offmarket_leads')
        .select('id,nome,cidade,score,negotiation_status,offer_amount,counter_offer_amount,deal_risk_level,deal_next_step,deal_next_step_date,cpcv_target_date,assigned_to')
        .not('negotiation_status', 'in', '("idle","withdrawn")')
        .order('score', { ascending: false })
        .limit(20),

      // CPCV pipeline (signed or target)
      s.from('offmarket_leads')
        .select('id,nome,cidade,score,cpcv_target_date,cpcv_signed_at,escritura_target_date,escritura_done_at,deal_risk_level,deposit_received,assigned_to')
        .or('cpcv_target_date.not.is.null,cpcv_signed_at.not.is.null')
        .is('escritura_done_at', null)
        .order('cpcv_target_date', { ascending: true })
        .limit(20),

      // SLA breaches
      s.from('offmarket_leads')
        .select('id,nome,score,created_at,sla_contacted_at,status,assigned_to')
        .eq('sla_breach', true)
        .order('score', { ascending: false })
        .limit(20),
    ])

    // Compute pipeline value from CPCV pipeline
    const cpcvPipeline = r_cpcv_pipeline.data ?? []

    return NextResponse.json({
      date: now.toISOString(),

      summary: {
        new_leads_today:       (r_today_leads.data ?? []).length,
        p0_uncontacted:        (r_p0.data ?? []).length,
        p1_uncontacted:        (r_p1.data ?? []).length,
        preclose_candidates:   (r_preclose.data ?? []).length,
        followups_due_today:   (r_followup_due.data ?? []).length,
        stale_hot_leads:       (r_stale.data ?? []).length,
        active_negotiations:   (r_active_negotiations.data ?? []).length,
        cpcv_in_progress:      cpcvPipeline.filter((d: Record<string, unknown>) => d.cpcv_signed_at).length,
        sla_breaches:          (r_sla_breach.data ?? []).length,
        // FASE 21 — top 5 daily execution command (derived from execution_queue)
        daily_top5_instruction: (() => {
          const queue: Record<string, unknown>[] = [
            ...(r_p0.data ?? []).map((l: Record<string, unknown>) => ({ ...l, _priority: 'P0' })),
            ...(r_p1.data ?? []).map((l: Record<string, unknown>) => ({ ...l, _priority: 'P1' })),
            ...(r_preclose.data ?? []).map((l: Record<string, unknown>) => ({ ...l, _priority: 'PRE-CLOSE' })),
          ].filter((l) => l.deal_kill_flag !== true).slice(0, 5)
          return queue.map((l, i) => {
            const name = l.nome ?? 'Lead'
            const blocker = l.execution_blocker_reason ?? 'ready_to_attack'
            const cpcvPct = l.cpcv_probability ?? 0
            const emoji = blocker === 'cpcv_trigger' ? '🔥' : blocker === 'sla_breach' ? '🚨' : blocker === 'no_meeting' ? '📅' : '⚡'
            return `${i + 1}. ${emoji} ${name} — ${blocker} (CPCV ${cpcvPct}%)`
          }).join('\n') || 'Sem leads prioritários em execução'
        })(),
      },

      // Daily execution queue — sorted by: sla_breach first, then rank desc
      execution_queue: [
        ...(r_p0.data ?? []).map((l: Record<string, unknown>) => ({ ...l, _priority: 'P0' })),
        ...(r_p1.data ?? []).map((l: Record<string, unknown>) => ({ ...l, _priority: 'P1' })),
        ...(r_preclose.data ?? []).map((l: Record<string, unknown>) => ({ ...l, _priority: 'PRE-CLOSE' })),
      ].filter((l: Record<string, unknown>) => l.deal_kill_flag !== true)
        .sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
        // CPCV trigger first — highest revenue opportunity
        if (a.execution_blocker_reason === 'cpcv_trigger' && b.execution_blocker_reason !== 'cpcv_trigger') return -1
        if (b.execution_blocker_reason === 'cpcv_trigger' && a.execution_blocker_reason !== 'cpcv_trigger') return 1
        // SLA breaches second
        if (a.sla_breach && !b.sla_breach) return -1
        if (!a.sla_breach && b.sla_breach) return 1
        // Then by execution_blocker urgency
        const blockerOrder = ['cpcv_trigger', 'no_meeting', 'no_contact', 'sla_breach', 'no_price_intel', 'no_buyer', 'insufficient_data', 'ready_to_attack']
        const aIdx = blockerOrder.indexOf((a.execution_blocker_reason as string) ?? '')
        const bIdx = blockerOrder.indexOf((b.execution_blocker_reason as string) ?? '')
        if (aIdx !== bIdx) return aIdx - bIdx
        // Finally by money_priority_score (revenue impact)
        const aMoney = (a.money_priority_score as number) ?? (a.master_attack_rank as number) ?? 0
        const bMoney = (b.money_priority_score as number) ?? (b.master_attack_rank as number) ?? 0
        return bMoney - aMoney
      }),

      new_leads_today:       r_today_leads.data ?? [],
      followups_due:         r_followup_due.data ?? [],
      stale_hot_leads:       r_stale.data ?? [],
      active_negotiations:   r_active_negotiations.data ?? [],
      cpcv_pipeline:         cpcvPipeline,
      sla_breaches:          r_sla_breach.data ?? [],
    })
  } catch (err) {
    console.error('[reporting/daily]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
