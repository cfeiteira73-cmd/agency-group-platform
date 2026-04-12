// =============================================================================
// Agency Group — Weekly Negotiation Report
// GET /api/reporting/weekly-negotiation
// Returns: proposals, counter-proposals, CPCVs, at-risk deals, top 5 to unlock
// =============================================================================

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { auth } from '@/auth'

export async function GET(): Promise<NextResponse> {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = supabaseAdmin as any

    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const twoWeeksOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

    const [
      r_offers,
      r_counter_offers,
      r_terms_agreed,
      r_cpcv_signed,
      r_cpcv_pending,
      r_escritura_upcoming,
      r_red_risk,
      r_yellow_risk,
      r_blocked_negotiations,
    ] = await Promise.all([
      s.from('offmarket_leads')
        .select('id,nome,cidade,score,offer_amount,offer_date,deal_risk_level,assigned_to,deal_next_step')
        .eq('negotiation_status', 'offer_received')
        .order('offer_date', { ascending: false })
        .limit(20),

      s.from('offmarket_leads')
        .select('id,nome,cidade,score,counter_offer_amount,counter_offer_date,offer_amount,deal_risk_level,assigned_to')
        .eq('negotiation_status', 'counter_proposed')
        .order('counter_offer_date', { ascending: false })
        .limit(20),

      s.from('offmarket_leads')
        .select('id,nome,cidade,score,offer_amount,cpcv_target_date,deal_risk_level,assigned_to')
        .eq('negotiation_status', 'terms_agreed')
        .order('score', { ascending: false })
        .limit(20),

      s.from('offmarket_leads')
        .select('id,nome,cidade,score,cpcv_signed_at,deposit_received,escritura_target_date,deal_risk_level,legal_status,docs_pending,assigned_to')
        .not('cpcv_signed_at', 'is', null)
        .is('escritura_done_at', null)
        .order('escritura_target_date', { ascending: true })
        .limit(20),

      s.from('offmarket_leads')
        .select('id,nome,cidade,score,cpcv_target_date,negotiation_status,deal_risk_level,assigned_to')
        .not('cpcv_target_date', 'is', null)
        .is('cpcv_signed_at', null)
        .lte('cpcv_target_date', twoWeeksOut.toISOString())
        .order('cpcv_target_date', { ascending: true })
        .limit(10),

      s.from('offmarket_leads')
        .select('id,nome,cidade,escritura_target_date,deal_risk_level,docs_pending,legal_status,assigned_to')
        .not('escritura_target_date', 'is', null)
        .is('escritura_done_at', null)
        .lte('escritura_target_date', twoWeeksOut.toISOString())
        .order('escritura_target_date', { ascending: true })
        .limit(10),

      s.from('offmarket_leads')
        .select('id,nome,cidade,score,deal_risk_level,deal_risk_reason,deal_next_step,deal_next_step_date,negotiation_status,cpcv_target_date,escritura_target_date,assigned_to,deal_priority_score,attack_recommendation,buyer_triad_notes')
        .eq('deal_risk_level', 'vermelho')
        .is('escritura_done_at', null)
        .order('score', { ascending: false })
        .limit(10),

      s.from('offmarket_leads')
        .select('id,nome,cidade,score,deal_risk_level,deal_risk_reason,deal_next_step,deal_next_step_date,negotiation_status,assigned_to,deal_priority_score,attack_recommendation,buyer_triad_notes')
        .eq('deal_risk_level', 'amarelo')
        .is('escritura_done_at', null)
        .order('score', { ascending: false })
        .limit(15),

      s.from('offmarket_leads')
        .select('id,nome,cidade,score,deal_risk_reason,deal_next_step,assigned_to,deal_priority_score,attack_recommendation,buyer_triad_notes')
        .eq('negotiation_status', 'blocked')
        .order('score', { ascending: false })
        .limit(10),
    ])

    // Completed this week
    const { data: completed_week } = await s.from('offmarket_leads')
      .select('id,nome,cidade,escritura_done_at')
      .gte('escritura_done_at', weekAgo.toISOString())

    // Compute total deal value in CPCV
    const cpcvSigned = r_cpcv_signed.data ?? []

    // Top 5 to unlock: highest score in blocked/yellow/red
    const allAtRisk = [
      ...(r_red_risk.data ?? []),
      ...(r_yellow_risk.data ?? []),
      ...(r_blocked_negotiations.data ?? []),
    ]
    const unique = Array.from(new Map(allAtRisk.map((d: { id: string }) => [d.id, d])).values())
    const top5Unlock = unique
      .sort((a: Record<string, unknown>, b: Record<string, unknown>) => ((b.score as number) ?? 0) - ((a.score as number) ?? 0))
      .slice(0, 5)

    return NextResponse.json({
      generated_at: now.toISOString(),
      week: Math.ceil(now.getDate() / 7),
      year: now.getFullYear(),

      summary: {
        offers_active:         (r_offers.data ?? []).length,
        counter_proposals:     (r_counter_offers.data ?? []).length,
        terms_agreed:          (r_terms_agreed.data ?? []).length,
        cpcv_signed:           cpcvSigned.length,
        cpcv_pending_this_2w:  (r_cpcv_pending.data ?? []).length,
        escrituras_this_2w:    (r_escritura_upcoming.data ?? []).length,
        deals_red_risk:        (r_red_risk.data ?? []).length,
        deals_yellow_risk:     (r_yellow_risk.data ?? []).length,
        blocked:               (r_blocked_negotiations.data ?? []).length,
        completed_this_week:   (completed_week ?? []).length,
      },

      offers_active:           r_offers.data ?? [],
      counter_proposals:       r_counter_offers.data ?? [],
      terms_agreed:            r_terms_agreed.data ?? [],
      cpcv_signed_active:      cpcvSigned,
      cpcv_pending_deadline:   r_cpcv_pending.data ?? [],
      escritura_upcoming:      r_escritura_upcoming.data ?? [],
      red_risk_deals:          r_red_risk.data ?? [],
      yellow_risk_deals:       r_yellow_risk.data ?? [],
      blocked_negotiations:    r_blocked_negotiations.data ?? [],
      completed_this_week:     completed_week ?? [],
      top5_to_unlock:          top5Unlock,
    })
  } catch (err) {
    console.error('[reporting/weekly-negotiation]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
