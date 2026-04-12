// =============================================================================
// Agency Group — Daily Execution Report
// GET /api/reporting/daily
// Returns: leads nova, SLA alerts, priority queue, pre-close, follow-ups due
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
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(now)
    todayEnd.setHours(23, 59, 59, 999)
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

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

      // P0: score >= 80, status = new
      s.from('offmarket_leads')
        .select('id,nome,cidade,score,urgency,contacto,sla_contacted_at,created_at,assigned_to,score_reason')
        .gte('score', 80)
        .eq('status', 'new')
        .order('score', { ascending: false })
        .limit(20),

      // P1: score 70-79, status = new
      s.from('offmarket_leads')
        .select('id,nome,cidade,score,urgency,contacto,sla_contacted_at,created_at,assigned_to,score_reason')
        .gte('score', 70)
        .lt('score', 80)
        .eq('status', 'new')
        .order('score', { ascending: false })
        .limit(20),

      // Pre-close candidates
      s.from('offmarket_leads')
        .select('id,nome,cidade,score,matched_buyers_count,best_buyer_match_score,buyer_match_notes,status,contacto,assigned_to')
        .eq('preclose_candidate', true)
        .not('status', 'in', '("closed_won","closed_lost","not_interested")')
        .order('best_buyer_match_score', { ascending: false })
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
        .lt('last_contact_at', weekAgo.toISOString())
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
      },

      // Daily execution queue — sorted by priority
      execution_queue: [
        ...(r_p0.data ?? []).map((l: Record<string, unknown>) => ({ ...l, _priority: 'P0' })),
        ...(r_p1.data ?? []).map((l: Record<string, unknown>) => ({ ...l, _priority: 'P1' })),
        ...(r_preclose.data ?? []).map((l: Record<string, unknown>) => ({ ...l, _priority: 'PRE-CLOSE' })),
      ],

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
