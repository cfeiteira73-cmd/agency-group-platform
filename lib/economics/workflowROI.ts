// AGENCY GROUP — SH-ROS Ω∞∞ Economics: workflowROI | AMI: 22506
// Workflow ROI tracking — cost vs revenue per workflow type
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import logger from '@/lib/logger'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseAdmin as any

const COST_PER_MS_EUR = 0.000001

export interface WorkflowROIRecord {
  workflow_name: string
  org_id: string
  period_days: number
  executions: number
  successful_executions: number
  revenue_generated_eur: number
  estimated_cost_eur: number
  roi_multiplier: number
  roi_pct: number
  avg_revenue_per_execution_eur: number
  break_even_executions: number
}

export class WorkflowROITracker {
  async calculateWorkflowROI(
    workflow_name: string,
    org_id: string,
    period_days: number
  ): Promise<WorkflowROIRecord> {
    const from = new Date(Date.now() - period_days * 86_400_000).toISOString()

    const { data: execs, error } = await sb
      .from('learning_events')
      .select('metadata')
      .eq('org_id', org_id)
      .eq('event_type', 'workflow_execution')
      .contains('metadata', { workflow_name })
      .gte('created_at', from)
      .limit(1000)

    if (error) logger.error('[WorkflowROI] Query failed', { error, workflow_name, org_id })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exData: any[] = execs ?? []
    let successful = 0
    let total_duration_ms = 0
    for (const e of exData) {
      const meta = (e.metadata as Record<string, unknown>) ?? {}
      if (meta['status'] === 'completed') successful++
      total_duration_ms += (meta['duration_ms'] as number) ?? 500
    }

    const { data: deals } = await sb
      .from('deals')
      .select('value_eur')
      .eq('org_id', org_id)
      .eq('status', 'closed_won')
      .gte('updated_at', from)
      .limit(500)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const total_org_revenue = (deals ?? []).reduce((s: number, d: any) =>
      s + ((d.value_eur as number) ?? 0), 0)

    const total_exec = exData.length
    const revenue_generated_eur = total_exec > 0 ? total_org_revenue * 0.2 : 0
    const estimated_cost_eur = total_duration_ms * COST_PER_MS_EUR
    const roi_multiplier = estimated_cost_eur > 0
      ? Math.round((revenue_generated_eur / estimated_cost_eur) * 10) / 10 : 0
    const roi_pct = estimated_cost_eur > 0
      ? Math.round(((revenue_generated_eur - estimated_cost_eur) / estimated_cost_eur) * 1000) / 10 : 0
    const avg_revenue_per_execution_eur = total_exec > 0 ? revenue_generated_eur / total_exec : 0
    const break_even_executions = avg_revenue_per_execution_eur > 0
      ? Math.ceil(10 / avg_revenue_per_execution_eur) : 9999

    return {
      workflow_name, org_id, period_days,
      executions: total_exec, successful_executions: successful,
      revenue_generated_eur: Math.round(revenue_generated_eur * 100) / 100,
      estimated_cost_eur: Math.round(estimated_cost_eur * 10000) / 10000,
      roi_multiplier, roi_pct,
      avg_revenue_per_execution_eur: Math.round(avg_revenue_per_execution_eur * 100) / 100,
      break_even_executions,
    }
  }

  async getRankedWorkflowROI(
    org_id: string,
    period_days: number
  ): Promise<WorkflowROIRecord[]> {
    const from = new Date(Date.now() - period_days * 86_400_000).toISOString()

    // Single aggregated query — one DB round-trip instead of 1 + 2×N
    const { data: rows, error } = await sb
      .from('learning_events')
      .select('metadata')
      .eq('org_id', org_id)
      .eq('event_type', 'workflow_execution')
      .gte('created_at', from)
      .limit(5000)

    if (error) logger.error('[WorkflowROI] getRankedWorkflowROI query failed', { error, org_id })
    if (!rows?.length) return []

    // Aggregate in-memory: group by workflow_name
    const byWorkflow = new Map<string, {
      successful: number
      total: number
      total_duration_ms: number
    }>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const row of rows as any[]) {
      const meta = (row.metadata as Record<string, unknown>) ?? {}
      const name = ((meta['workflow_name'] as string) ?? 'unknown')
      const entry = byWorkflow.get(name) ?? { successful: 0, total: 0, total_duration_ms: 0 }
      entry.total++
      if (meta['status'] === 'completed') entry.successful++
      entry.total_duration_ms += (meta['duration_ms'] as number) ?? 500
      byWorkflow.set(name, entry)
    }

    // Fetch org revenue once for all workflows
    const { data: deals } = await sb
      .from('deals')
      .select('value_eur')
      .eq('org_id', org_id)
      .eq('status', 'closed_won')
      .gte('updated_at', from)
      .limit(500)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const total_org_revenue = (deals ?? []).reduce((s: number, d: any) =>
      s + ((d.value_eur as number) ?? 0), 0)

    const records: WorkflowROIRecord[] = []
    for (const [name, stats] of byWorkflow) {
      if (stats.total === 0) continue
      const revenue_generated_eur = total_org_revenue * 0.2
      const estimated_cost_eur = stats.total_duration_ms * COST_PER_MS_EUR
      const roi_multiplier = estimated_cost_eur > 0
        ? Math.round((revenue_generated_eur / estimated_cost_eur) * 10) / 10 : 0
      const roi_pct = estimated_cost_eur > 0
        ? Math.round(((revenue_generated_eur - estimated_cost_eur) / estimated_cost_eur) * 1000) / 10 : 0
      const avg_revenue_per_execution_eur = revenue_generated_eur / stats.total
      const break_even_executions = avg_revenue_per_execution_eur > 0
        ? Math.ceil(10 / avg_revenue_per_execution_eur) : 9999
      records.push({
        workflow_name: name,
        org_id,
        period_days,
        executions: stats.total,
        successful_executions: stats.successful,
        revenue_generated_eur: Math.round(revenue_generated_eur * 100) / 100,
        estimated_cost_eur: Math.round(estimated_cost_eur * 10000) / 10000,
        roi_multiplier,
        roi_pct,
        avg_revenue_per_execution_eur: Math.round(avg_revenue_per_execution_eur * 100) / 100,
        break_even_executions,
      })
    }

    return records.sort((a, b) => b.roi_multiplier - a.roi_multiplier)
  }
}

export const workflowROITracker = new WorkflowROITracker()
