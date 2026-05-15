// AGENCY GROUP — SH-ROS Ω∞∞ Operations: operatorEfficiency | AMI: 22506
// Scores each operator on efficiency metrics
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import logger from '@/lib/logger'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseAdmin as any

export interface OperatorEfficiencyScore {
  operator_email: string
  org_id: string
  period_days: number
  tasks_completed: number
  avg_response_time_hours: number
  follow_up_rate: number
  deals_advanced: number
  deals_stalled: number
  efficiency_score: number
  efficiency_tier: 'elite' | 'high' | 'standard' | 'at_risk'
  strengths: string[]
  improvement_areas: string[]
}

export class OperatorEfficiencyAnalyzer {
  async scoreOperator(
    operator_email: string,
    org_id: string,
    period_days = 30
  ): Promise<OperatorEfficiencyScore> {
    const from = new Date(Date.now() - period_days * 86_400_000).toISOString()

    const [{ data: dealsData }, { data: tasksData }] = await Promise.all([
      sb.from('deals')
        .select('id, status, stage, updated_at, created_at, value_eur')
        .eq('org_id', org_id)
        .eq('assigned_to', operator_email)
        .gte('created_at', from)
        .limit(200),
      sb.from('operator_tasks')
        .select('id, status, created_at, updated_at, priority')
        .eq('assigned_to', operator_email)
        .gte('created_at', from)
        .limit(200),
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deals: any[] = dealsData ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tasks: any[] = tasksData ?? []

    const tasks_completed = tasks.filter((t: any) => t.status === 'completed').length

    // Follow-up rate: deals updated within 3 days of creation
    const with_followup = deals.filter((d: any) => {
      const created = new Date(d.created_at as string).getTime()
      const updated = new Date(d.updated_at as string).getTime()
      return (updated - created) < 3 * 86_400_000
    }).length
    const follow_up_rate = deals.length > 0 ? with_followup / deals.length : 0

    // Avg response time from task creation to first update
    const task_response_times = tasks
      .filter((t: any) => t.status === 'completed')
      .map((t: any) => {
        const created = new Date(t.created_at as string).getTime()
        const updated = new Date(t.updated_at as string).getTime()
        return (updated - created) / 3_600_000  // hours
      })
    const avg_response_time_hours = task_response_times.length > 0
      ? task_response_times.reduce((s: number, v: number) => s + v, 0) / task_response_times.length
      : 48

    // Deals advanced vs stalled
    const stall_cutoff = new Date(Date.now() - 14 * 86_400_000).toISOString()
    const deals_stalled = deals.filter((d: any) =>
      d.status === 'active' && (d.updated_at as string) < stall_cutoff
    ).length
    const deals_advanced = deals.filter((d: any) =>
      d.status === 'closed_won' || (d.updated_at as string) >= stall_cutoff
    ).length

    // Efficiency score
    const task_score = Math.min(33, (tasks_completed / Math.max(1, tasks.length)) * 33)
    const followup_score = follow_up_rate * 35
    const advance_score = deals.length > 0
      ? (deals_advanced / deals.length) * 32
      : 16
    const efficiency_score = Math.round(task_score + followup_score + advance_score)

    const efficiency_tier: OperatorEfficiencyScore['efficiency_tier'] =
      efficiency_score >= 75 ? 'elite'
      : efficiency_score >= 55 ? 'high'
      : efficiency_score >= 35 ? 'standard'
      : 'at_risk'

    const strengths: string[] = []
    const improvement_areas: string[] = []

    if (follow_up_rate > 0.8) strengths.push('Excellent follow-up discipline')
    else improvement_areas.push('Improve initial follow-up speed (target <3 days)')
    if (avg_response_time_hours < 24) strengths.push('Fast task response time')
    else improvement_areas.push('Reduce task response time (target <24h)')
    if (deals_stalled === 0) strengths.push('No stalled deals')
    else improvement_areas.push(`Resolve ${deals_stalled} stalled deal${deals_stalled > 1 ? 's' : ''}`)

    return {
      operator_email, org_id, period_days,
      tasks_completed, avg_response_time_hours: Math.round(avg_response_time_hours * 10) / 10,
      follow_up_rate: Math.round(follow_up_rate * 1000) / 10,
      deals_advanced, deals_stalled, efficiency_score, efficiency_tier, strengths, improvement_areas,
    }
  }

  async rankOperators(
    org_id: string,
    period_days = 30
  ): Promise<OperatorEfficiencyScore[]> {
    const from = new Date(Date.now() - period_days * 86_400_000).toISOString()

    const { data } = await sb
      .from('deals')
      .select('assigned_to')
      .eq('org_id', org_id)
      .gte('created_at', from)
      .limit(1000)

    const operators = new Set<string>(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (data ?? []).map((d: any) => d.assigned_to as string).filter(Boolean)
    )

    const scores: OperatorEfficiencyScore[] = []
    for (const op of operators) {
      scores.push(await this.scoreOperator(op, org_id, period_days))
    }

    logger.info('[OperatorEfficiency] Ranking complete', { org_id, operators: scores.length })
    return scores.sort((a, b) => b.efficiency_score - a.efficiency_score)
  }
}

export const operatorEfficiencyAnalyzer = new OperatorEfficiencyAnalyzer()
