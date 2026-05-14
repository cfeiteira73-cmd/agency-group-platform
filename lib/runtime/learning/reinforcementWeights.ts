// AGENCY GROUP — SH-ROS Learning: reinforcementWeights | AMI: 22506
// Agent weight adjustment based on measured performance.
// Conservative learning rate (0.1). Bounds: [0.5, 1.5].
// ALL changes versioned and persisted to learning_events — audit-safe.

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgentWeights {
  agent_id: string
  org_id: string
  confidence_multiplier: number
  probability_multiplier: number
  financial_multiplier: number
  updated_at: string
  version: number
}

export interface PerformanceDelta {
  accuracy_change: number
  financial_accuracy_change: number
  calibration_change: number
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const LEARNING_RATE = 0.1
const WEIGHT_MIN = 0.5
const WEIGHT_MAX = 1.5
const DEFAULT_WEIGHTS: Omit<AgentWeights, 'agent_id' | 'org_id' | 'updated_at' | 'version'> = {
  confidence_multiplier: 1.0,
  probability_multiplier: 1.0,
  financial_multiplier: 1.0,
}

// ─── ReinforcementWeightStore ─────────────────────────────────────────────────

export class ReinforcementWeightStore {
  /**
   * Get current weights for an agent+org.
   * Returns defaults (1.0) if no weights have been set yet.
   */
  async getWeights(agent_id: string, org_id: string): Promise<AgentWeights> {
    try {
      const { data, error } = await supabaseAdmin
        .from('learning_events')
        .select('metadata, created_at')
        .eq('event_type', 'agent_weights')
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error

      const match = (data ?? [])
        .map((r) => (r as Record<string, unknown>).metadata as AgentWeights)
        .find((w) => w?.agent_id === agent_id && w?.org_id === org_id)

      if (match) return match

      // Return defaults
      return {
        agent_id,
        org_id,
        ...DEFAULT_WEIGHTS,
        updated_at: new Date().toISOString(),
        version: 0,
      }
    } catch (err) {
      console.warn('[ReinforcementWeightStore] getWeights error:', err)
      return {
        agent_id,
        org_id,
        ...DEFAULT_WEIGHTS,
        updated_at: new Date().toISOString(),
        version: 0,
      }
    }
  }

  /**
   * Update weights based on a PerformanceDelta.
   * Learning rate: 0.1 (conservative). Bounds: [0.5, 1.5].
   * Every update is versioned and logged to learning_events.
   */
  async updateWeights(
    agent_id: string,
    org_id: string,
    performance: PerformanceDelta
  ): Promise<void> {
    try {
      const current = await this.getWeights(agent_id, org_id)
      const before = { ...current }

      // Apply learning rate adjustments — bounded to [0.5, 1.5]
      const clamp = (v: number) => Math.max(WEIGHT_MIN, Math.min(WEIGHT_MAX, v))

      const updated: AgentWeights = {
        ...current,
        confidence_multiplier: clamp(
          current.confidence_multiplier + LEARNING_RATE * performance.calibration_change
        ),
        probability_multiplier: clamp(
          current.probability_multiplier + LEARNING_RATE * performance.accuracy_change
        ),
        financial_multiplier: clamp(
          current.financial_multiplier + LEARNING_RATE * performance.financial_accuracy_change
        ),
        updated_at: new Date().toISOString(),
        version: current.version + 1,
      }

      await supabaseAdmin.from('learning_events').insert({
        event_type: 'agent_weights',
        agent_email: `agent:${agent_id}`,
        metadata: {
          ...updated,
          _before: before,
          _delta: performance,
          _learning_rate: LEARNING_RATE,
          _change_id: randomUUID(),
        } as unknown as Record<string, unknown>,
      })
    } catch (err) {
      console.warn('[ReinforcementWeightStore] updateWeights error:', err)
    }
  }

  /**
   * Reset weights to defaults (1.0) for an agent+org.
   * Logged as a versioned weight event for full auditability.
   */
  async resetWeights(agent_id: string, org_id: string): Promise<void> {
    try {
      const current = await this.getWeights(agent_id, org_id)

      const reset: AgentWeights = {
        agent_id,
        org_id,
        ...DEFAULT_WEIGHTS,
        updated_at: new Date().toISOString(),
        version: current.version + 1,
      }

      await supabaseAdmin.from('learning_events').insert({
        event_type: 'agent_weights',
        agent_email: `agent:${agent_id}`,
        metadata: {
          ...reset,
          _before: current,
          _reset: true,
          _change_id: randomUUID(),
        } as unknown as Record<string, unknown>,
      })
    } catch (err) {
      console.warn('[ReinforcementWeightStore] resetWeights error:', err)
    }
  }

  /**
   * Get latest weights for all agents in an org.
   */
  async getAllWeights(org_id: string): Promise<AgentWeights[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('learning_events')
        .select('metadata, created_at')
        .eq('event_type', 'agent_weights')
        .order('created_at', { ascending: false })
        .limit(500)

      if (error) throw error

      // Deduplicate — keep latest per agent_id
      const latestByAgent = new Map<string, AgentWeights>()

      for (const row of data ?? []) {
        const w = (row as Record<string, unknown>).metadata as AgentWeights
        if (!w || w.org_id !== org_id) continue
        if (!latestByAgent.has(w.agent_id)) {
          // Clean weight record — exclude internal _before/_delta fields
          latestByAgent.set(w.agent_id, {
            agent_id: w.agent_id,
            org_id: w.org_id,
            confidence_multiplier: w.confidence_multiplier,
            probability_multiplier: w.probability_multiplier,
            financial_multiplier: w.financial_multiplier,
            updated_at: w.updated_at,
            version: w.version,
          })
        }
      }

      return [...latestByAgent.values()]
    } catch (err) {
      console.warn('[ReinforcementWeightStore] getAllWeights error:', err)
      return []
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const reinforcementWeightStore = new ReinforcementWeightStore()
