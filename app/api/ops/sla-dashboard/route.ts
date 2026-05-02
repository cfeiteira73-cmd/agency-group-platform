// GET /api/ops/sla-dashboard
// SLA breach dashboard: overdue deals, breach severity, owning agents

import { NextRequest, NextResponse }   from 'next/server'
import { getAdminRole, hasPermission } from '@/lib/auth/adminAuth'
import { supabaseAdmin }               from '@/lib/supabase'

export const runtime = 'nodejs'

// SLA thresholds per deal stage (days)
const SLA_DAYS: Record<string, number> = {
  contacto:     3,
  qualificacao: 5,
  visita:       7,
  proposta:     10,
  negociacao:   21,
  CPCV:         60,
  escritura:    90,
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '')
  const user       = await getAdminRole(authHeader ?? '')
  if (!user || !hasPermission(user.role, 'system:read_alerts')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url      = new URL(req.url)
  const severity = url.searchParams.get('severity')  // critical | high | medium
  const agentEmail = url.searchParams.get('agent')
  const limit    = Math.min(Number(url.searchParams.get('limit') ?? 50), 200)

  try {
    const [slaView, stageSummary] = await Promise.all([
      // 1. Direct SLA breach view (if table exists)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabaseAdmin as any)
        .from('v_sla_breach_summary')
        .select('*')
        .limit(limit),

      // 2. Live deal stage computation against SLA thresholds
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabaseAdmin as any)
        .from('deals')
        .select('id, contact_name, stage, agent_email, updated_at, created_at')
        .not('stage', 'in', '("won","lost","withdrawn")')
        .limit(500),
    ])

    // Compute live SLA status from deals.updated_at vs SLA thresholds
    const now   = Date.now()
    const breaches = ((stageSummary.data ?? []) as Array<{
      id: string; contact_name: string; stage: string; agent_email: string | null; updated_at: string
    }>)
      .map(deal => {
        const slaDays     = SLA_DAYS[deal.stage] ?? 14
        const lastMoveMs  = new Date(deal.updated_at).getTime()
        const ageHours    = (now - lastMoveMs) / 3600_000
        const slaHours    = slaDays * 24
        const isBreached  = ageHours > slaHours
        const hoursOver   = isBreached ? Math.round(ageHours - slaHours) : 0
        const urgency     = hoursOver > 48 ? 'critical' : hoursOver > 24 ? 'high' : 'medium'

        return {
          deal_id:      deal.id,
          contact_name: deal.contact_name,
          stage:        deal.stage,
          agent_email:  deal.agent_email,
          age_hours:    Math.round(ageHours),
          sla_hours:    slaHours,
          is_breached:  isBreached,
          hours_over:   hoursOver,
          urgency:      isBreached ? urgency : null,
        }
      })
      .filter(d => d.is_breached)
      .filter(d => !severity || d.urgency === severity)
      .filter(d => !agentEmail || d.agent_email === agentEmail)
      .sort((a, b) => b.hours_over - a.hours_over)
      .slice(0, limit)

    // Summary by stage
    const byStage: Record<string, number> = {}
    for (const b of breaches) {
      byStage[b.stage] = (byStage[b.stage] ?? 0) + 1
    }

    // Use DB view if available (may have richer data)
    const dbBreaches = slaView.data ?? []

    return NextResponse.json({
      breaches,
      db_breaches:   dbBreaches,
      summary: {
        total_breached: breaches.length,
        critical:       breaches.filter(b => b.urgency === 'critical').length,
        high:           breaches.filter(b => b.urgency === 'high').length,
        medium:         breaches.filter(b => b.urgency === 'medium').length,
        by_stage:       byStage,
        sla_thresholds: SLA_DAYS,
      },
    })
  } catch (err) {
    console.error('[sla-dashboard GET]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}
