// GET /api/analytics/executive
// Executive command center — single-call aggregation of all platform KPIs.
// Covers revenue, scoring accuracy, distribution efficiency, partner health,
// system health, and market position.

import { NextRequest, NextResponse }   from 'next/server'
import { getAdminRole, hasPermission } from '@/lib/auth/adminAuth'
import { supabaseAdmin }               from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '')
  const user       = await getAdminRole(authHeader ?? '')
  if (!user || !hasPermission(user.role, 'analytics:read')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url  = new URL(req.url)
  const days = parseInt(url.searchParams.get('days') ?? '30', 10)

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin   = supabaseAdmin as any
    const since   = new Date(Date.now() - days * 86400_000).toISOString()

    const [
      healthRes,
      revenueRes,
      partnerRes,
      flagRes,
      incidentRes,
      outcomeRes,
      calibrationRes,
      alertRes,
    ] = await Promise.all([
      admin.from('v_system_health').select('*').single(),
      admin.from('v_revenue_by_grade').select('*'),
      admin.from('partner_tiers')
           .select('tier, tier_score')
           .order('tier_score', { ascending: false }),
      admin.from('feature_flags')
           .select('flag_key, is_enabled, is_kill_switch')
           .eq('is_kill_switch', true),
      admin.from('incident_log')
           .select('severity, status')
           .in('status', ['open', 'investigating']),
      admin.from('transaction_outcomes')
           .select('outcome_type, final_sale_price, avm_error_pct, negotiation_delta_pct')
           .gte('recorded_at', since),
      admin.from('calibration_recommendations')
           .select('priority, status')
           .eq('status', 'pending'),
      admin.from('system_alerts')
           .select('severity, status')
           .eq('status', 'active'),
    ])

    // Revenue aggregation
    const revenueRows = (revenueRes.data ?? []) as Array<{
      total_commission: number | string | null
      won: number | string
      total_deals: number | string
    }>
    const totalCommission = revenueRows.reduce((s, r) => s + Number(r.total_commission ?? 0), 0)
    const totalWon        = revenueRows.reduce((s, r) => s + Number(r.won ?? 0), 0)
    const totalDeals      = revenueRows.reduce((s, r) => s + Number(r.total_deals ?? 0), 0)

    // Partner tier breakdown
    const tiers = (partnerRes.data ?? []) as Array<{ tier: string; tier_score: number }>
    const tierBreakdown = tiers.reduce((acc: Record<string, number>, p) => {
      acc[p.tier] = (acc[p.tier] ?? 0) + 1
      return acc
    }, {})

    // Outcome quality metrics
    const outcomes  = (outcomeRes.data ?? []) as Array<{
      outcome_type: string
      final_sale_price: number | null
      avm_error_pct: number | null
      negotiation_delta_pct: number | null
    }>
    const wonOutcomes = outcomes.filter(o => o.outcome_type === 'won')
    const avmErrors   = wonOutcomes.map(o => o.avm_error_pct).filter((v): v is number => v != null)
    const negDeltas   = wonOutcomes.map(o => o.negotiation_delta_pct).filter((v): v is number => v != null)
    const avgAvmError = avmErrors.length
      ? parseFloat((avmErrors.reduce((s, v) => s + Math.abs(v), 0) / avmErrors.length).toFixed(2))
      : null
    const avgNegDelta = negDeltas.length
      ? parseFloat((negDeltas.reduce((s, v) => s + v, 0) / negDeltas.length).toFixed(2))
      : null

    // Kill switch status
    const killSwitches   = (flagRes.data ?? []) as Array<{ flag_key: string; is_enabled: boolean }>
    const activeKills    = killSwitches.filter(f => f.is_enabled)

    // Pending calibration urgency
    const pendingRecs    = (calibrationRes.data ?? []) as Array<{ priority: string }>
    const criticalRecs   = pendingRecs.filter(r => r.priority === 'CRITICAL').length
    const highRecs       = pendingRecs.filter(r => r.priority === 'HIGH').length

    // Active incidents
    const incidents      = (incidentRes.data ?? []) as Array<{ severity: string; status: string }>
    const critIncidents  = incidents.filter(i => i.severity === 'critical').length

    // Active alerts
    const alerts         = (alertRes.data ?? []) as Array<{ severity: string }>
    const critAlerts     = alerts.filter(a => a.severity === 'critical').length

    return NextResponse.json({
      generated_at: new Date().toISOString(),
      period_days:  days,

      revenue: {
        total_commission_eur:     totalCommission,
        total_won_deals:          totalWon,
        total_deals_tracked:      totalDeals,
        win_rate_pct:             totalDeals > 0
          ? parseFloat((totalWon / totalDeals * 100).toFixed(1)) : null,
        by_grade: revenueRes.data ?? [],
      },

      scoring_accuracy: {
        outcomes_last_n_days:  outcomes.length,
        won_count:             wonOutcomes.length,
        avg_avm_error_pct:     avgAvmError,
        avg_negotiation_delta: avgNegDelta,
        pending_calibration_recs: pendingRecs.length,
        critical_recs:         criticalRecs,
        high_recs:             highRecs,
      },

      partner_health: {
        total_partners: tiers.length,
        tier_breakdown: tierBreakdown,
        top_score:      tiers[0]?.tier_score ?? null,
      },

      system_health: {
        ...(healthRes.data ?? {}),
        active_kill_switches:  activeKills.length,
        kill_switches:         killSwitches.map(k => ({ key: k.flag_key, active: k.is_enabled })),
        open_incidents:        incidents.length,
        critical_incidents:    critIncidents,
        active_critical_alerts: critAlerts,
      },
    })
  } catch (err) {
    console.error('[analytics/executive]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}
