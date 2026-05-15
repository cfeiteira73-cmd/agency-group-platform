// AGENCY GROUP — SH-ROS Ω∞∞ Operations: workflowOptimizer | AMI: 22506
// Analyzes workflow patterns and generates optimization recommendations
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import logger from '@/lib/logger'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseAdmin as any

export interface WorkflowOptimizationRecommendation {
  workflow_name: string
  org_id: string
  recommendation_type: 'eliminate_step' | 'parallelize' | 'automate' | 'reduce_latency' | 'increase_frequency'
  description: string
  estimated_time_saving_days: number
  estimated_revenue_impact_eur: number
  confidence: number
  priority: 'critical' | 'high' | 'medium' | 'low'
  implementation_complexity: 'low' | 'medium' | 'high'
}

export class WorkflowOptimizer {
  async analyzeWorkflows(
    org_id: string,
    period_days = 60
  ): Promise<WorkflowOptimizationRecommendation[]> {
    const from = new Date(Date.now() - period_days * 86_400_000).toISOString()
    const recommendations: WorkflowOptimizationRecommendation[] = []

    const { data, error } = await sb
      .from('learning_events')
      .select('metadata, created_at')
      .eq('org_id', org_id)
      .eq('event_type', 'workflow_execution')
      .gte('created_at', from)
      .limit(2000)

    if (error) {
      logger.error('[WorkflowOptimizer] Query failed', { error, org_id })
      return []
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const executions: any[] = data ?? []

    // Group by workflow_name
    const byWorkflow: Record<string, typeof executions> = {}
    for (const e of executions) {
      const meta = (e.metadata as Record<string, unknown>) ?? {}
      const name = (meta['workflow_name'] as string) ?? 'unknown'
      if (!byWorkflow[name]) byWorkflow[name] = []
      byWorkflow[name].push(e)
    }

    for (const [workflow_name, wfExecs] of Object.entries(byWorkflow)) {
      const durations = wfExecs.map((e: any) => {
        const meta = (e.metadata as Record<string, unknown>) ?? {}
        return (meta['duration_ms'] as number) ?? 500
      })
      const successes = wfExecs.filter((e: any) => {
        const meta = (e.metadata as Record<string, unknown>) ?? {}
        return meta['status'] === 'completed'
      }).length

      const avg_duration = durations.reduce((s, v) => s + v, 0) / durations.length
      const median_duration = [...durations].sort((a, b) => a - b)[Math.floor(durations.length / 2)]
      const success_rate = wfExecs.length > 0 ? successes / wfExecs.length : 1

      // High latency: avg > 2× median
      if (avg_duration > median_duration * 2 && wfExecs.length >= 5) {
        recommendations.push({
          workflow_name, org_id,
          recommendation_type: 'reduce_latency',
          description: `${workflow_name} avg execution ${(avg_duration/1000).toFixed(1)}s — 2× above median ${(median_duration/1000).toFixed(1)}s. Outlier steps suspected.`,
          estimated_time_saving_days: 0.5,
          estimated_revenue_impact_eur: 0,
          confidence: Math.min(0.85, 0.5 + wfExecs.length / 50),
          priority: avg_duration > median_duration * 4 ? 'high' : 'medium',
          implementation_complexity: 'medium',
        })
      }

      // Low success rate → automate or fix
      if (success_rate < 0.7 && wfExecs.length >= 5) {
        recommendations.push({
          workflow_name, org_id,
          recommendation_type: success_rate < 0.5 ? 'automate' : 'eliminate_step',
          description: `${workflow_name} success rate ${(success_rate * 100).toFixed(0)}% — ${wfExecs.length - successes} failures detected. Review failure modes.`,
          estimated_time_saving_days: 1,
          estimated_revenue_impact_eur: 0,
          confidence: Math.min(0.9, 0.4 + wfExecs.length / 30),
          priority: success_rate < 0.5 ? 'critical' : 'high',
          implementation_complexity: 'high',
        })
      }

      // High volume, sequential — recommend parallelization
      if (wfExecs.length > 100 && avg_duration > 2000) {
        recommendations.push({
          workflow_name, org_id,
          recommendation_type: 'parallelize',
          description: `${workflow_name} runs ${wfExecs.length} times in period with avg ${(avg_duration/1000).toFixed(1)}s — parallelization could reduce wall-time by 40–60%.`,
          estimated_time_saving_days: 2,
          estimated_revenue_impact_eur: 0,
          confidence: 0.7,
          priority: 'medium',
          implementation_complexity: 'medium',
        })
      }
    }

    logger.info('[WorkflowOptimizer] Analysis complete', { org_id, recommendations: recommendations.length })
    return recommendations
  }

  async getTopOptimizations(
    org_id: string,
    limit = 5
  ): Promise<WorkflowOptimizationRecommendation[]> {
    const all = await this.analyzeWorkflows(org_id)
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    return all
      .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
      .slice(0, limit)
  }
}

export const workflowOptimizer = new WorkflowOptimizer()
