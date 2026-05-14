// AGENCY GROUP — SH-ROS Learning: executionLearning | AMI: 22506
// Learn from execution patterns — track which agents succeed on which event types,
// derive optimal routing weights, and surface execution efficiency patterns.

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExecutionRecord {
  event_id: string
  org_id: string
  event_type: string
  agents_triggered: string[]
  agents_succeeded: string[]
  total_duration_ms: number
  economic_score: number
  ev_scores: Record<string, number>
}

export interface ExecutionPattern {
  pattern_id: string
  event_type: string
  optimal_agents: string[]
  avg_duration_ms: number
  avg_economic_score: number
  sample_count: number
  last_observed: string
}

// ─── ExecutionLearner ─────────────────────────────────────────────────────────

export class ExecutionLearner {
  /**
   * Persist an execution record to learning_events.
   * Called after each full event execution cycle.
   */
  async recordExecution(execution: ExecutionRecord): Promise<void> {
    try {
      await supabaseAdmin.from('learning_events').insert({
        event_type: 'execution_record',
        agent_email: 'system:execution-learner',
        metadata: {
          ...execution,
          record_id: randomUUID(),
          recorded_at: new Date().toISOString(),
        } as unknown as Record<string, unknown>,
      })
    } catch (err) {
      console.warn('[ExecutionLearner] recordExecution error:', err)
    }
  }

  /**
   * Derive execution patterns from stored records.
   * Returns aggregated patterns per event_type within the period window.
   */
  async getExecutionPatterns(
    org_id: string,
    period_days = 30
  ): Promise<ExecutionPattern[]> {
    try {
      const since = new Date(Date.now() - period_days * 86_400_000).toISOString()

      const { data, error } = await supabaseAdmin
        .from('learning_events')
        .select('metadata, created_at')
        .eq('event_type', 'execution_record')
        .gte('created_at', since)

      if (error) throw error

      const records = (data ?? [])
        .map((r) => (r as Record<string, unknown>).metadata as ExecutionRecord & { recorded_at?: string })
        .filter((r) => r?.org_id === org_id)

      if (records.length === 0) return []

      // Group by event_type
      const byType = new Map<string, typeof records>()
      for (const rec of records) {
        if (!byType.has(rec.event_type)) byType.set(rec.event_type, [])
        byType.get(rec.event_type)!.push(rec)
      }

      const patterns: ExecutionPattern[] = []

      for (const [event_type, recs] of byType) {
        const n = recs.length
        const avg_duration_ms = recs.reduce((s, r) => s + r.total_duration_ms, 0) / n
        const avg_economic_score = recs.reduce((s, r) => s + r.economic_score, 0) / n

        // Find most successful agents across all executions
        const agentSuccessCount = new Map<string, number>()
        for (const rec of recs) {
          for (const agent of rec.agents_succeeded) {
            agentSuccessCount.set(agent, (agentSuccessCount.get(agent) ?? 0) + 1)
          }
        }

        // Sort by success rate (count / total executions)
        const optimal_agents = [...agentSuccessCount.entries()]
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5) // top 5
          .map(([agent]) => agent)

        const last_observed = recs
          .map((r) => r.recorded_at ?? '')
          .sort()
          .at(-1) ?? new Date().toISOString()

        patterns.push({
          pattern_id: randomUUID(),
          event_type,
          optimal_agents,
          avg_duration_ms,
          avg_economic_score,
          sample_count: n,
          last_observed,
        })
      }

      return patterns
    } catch (err) {
      console.warn('[ExecutionLearner] getExecutionPatterns error:', err)
      return []
    }
  }

  /**
   * Compute optimal routing weights for a given event_type based on historical
   * EV scores per agent. Returns a map of agent_id → normalized weight [0,1].
   */
  async getOptimalRoutingWeights(
    event_type: string,
    org_id: string,
    period_days = 30
  ): Promise<Record<string, number>> {
    try {
      const since = new Date(Date.now() - period_days * 86_400_000).toISOString()

      const { data, error } = await supabaseAdmin
        .from('learning_events')
        .select('metadata')
        .eq('event_type', 'execution_record')
        .gte('created_at', since)

      if (error) throw error

      const records = (data ?? [])
        .map((r) => (r as Record<string, unknown>).metadata as ExecutionRecord)
        .filter((r) => r?.org_id === org_id && r?.event_type === event_type)

      if (records.length === 0) return {}

      // Aggregate EV scores per agent across all matching executions
      const agentEV = new Map<string, { total: number; count: number }>()

      for (const rec of records) {
        for (const [agent, score] of Object.entries(rec.ev_scores ?? {})) {
          const current = agentEV.get(agent) ?? { total: 0, count: 0 }
          agentEV.set(agent, { total: current.total + score, count: current.count + 1 })
        }
      }

      if (agentEV.size === 0) return {}

      // Compute average EV per agent
      const avgEV = new Map<string, number>()
      for (const [agent, { total, count }] of agentEV) {
        avgEV.set(agent, total / count)
      }

      // Normalize to [0,1] range
      const maxEV = Math.max(...avgEV.values())
      const minEV = Math.min(...avgEV.values())
      const range = maxEV - minEV || 1

      const weights: Record<string, number> = {}
      for (const [agent, ev] of avgEV) {
        weights[agent] = (ev - minEV) / range
      }

      return weights
    } catch (err) {
      console.warn('[ExecutionLearner] getOptimalRoutingWeights error:', err)
      return {}
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const executionLearner = new ExecutionLearner()
