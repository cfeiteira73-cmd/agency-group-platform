// AGENCY GROUP — SH-ROS Cold Memory: executionLineage | AMI: 22506
import { supabaseAdmin } from '@/lib/supabase'

export interface LineageStep {
  step_id: string
  step_type: 'event' | 'agent' | 'action' | 'workflow_step'
  name: string
  started_at: string
  completed_at?: string
  status: string
  input_hash?: string
  output_hash?: string
  org_id: string
}

export interface ExecutionLineage {
  lineage_id: string
  org_id: string
  steps: LineageStep[]
  total_duration_ms: number
  status: 'running' | 'completed' | 'failed'
}

export class ExecutionLineageTracker {
  async recordStep(lineage_id: string, step: LineageStep): Promise<void> {
    try {
      await supabaseAdmin.from('learning_events').insert({
        event_type:    'execution_lineage',
        source_system: 'agent',
        metadata:      { lineage_id, step },
      })
    } catch (err) {
      console.warn('[ExecutionLineageTracker] recordStep failed:', err instanceof Error ? err.message : String(err))
    }
  }

  async getLineage(lineage_id: string, org_id: string): Promise<ExecutionLineage> {
    try {
      const { data } = await supabaseAdmin
        .from('learning_events')
        .select('metadata, created_at')
        .eq('event_type', 'execution_lineage')
        .gte('created_at', new Date(Date.now() - 90 * 86_400_000).toISOString())
        .limit(100)

      const steps: LineageStep[] = (data ?? [])
        .filter(r => (r.metadata as Record<string, unknown> | null)?.lineage_id === lineage_id)
        .map(r => (r.metadata as Record<string, unknown>).step as LineageStep)
        .filter(Boolean)

      const completed = steps.filter(s => s.completed_at)
      const totalMs = completed.length > 1
        ? new Date(completed[completed.length - 1].completed_at!).getTime() -
          new Date(steps[0].started_at).getTime()
        : 0

      const hasFailure = steps.some(s => s.status === 'failed' || s.status === 'error')
      const allDone = steps.every(s => s.completed_at)

      return {
        lineage_id, org_id, steps,
        total_duration_ms: totalMs,
        status: hasFailure ? 'failed' : allDone ? 'completed' : 'running',
      }
    } catch {
      return { lineage_id, org_id, steps: [], total_duration_ms: 0, status: 'failed' }
    }
  }

  async getChain(event_id: string, org_id: string): Promise<ExecutionLineage[]> {
    return [await this.getLineage(event_id, org_id)]
  }
}

export const executionLineageTracker = new ExecutionLineageTracker()
