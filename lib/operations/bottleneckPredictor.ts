// AGENCY GROUP — SH-ROS Ω∞∞ Operations: bottleneckPredictor | AMI: 22506
// Predicts future pipeline bottlenecks before they materialize
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import logger from '@/lib/logger'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseAdmin as any

export interface BottleneckPrediction {
  org_id: string
  predicted_bottleneck: string
  probability: number
  predicted_onset_days: number
  estimated_deals_blocked: number
  estimated_revenue_impact_eur: number
  contributing_factors: string[]
  preventive_actions: string[]
  confidence: number
}

export class BottleneckPredictor {
  async predictBottlenecks(org_id: string): Promise<BottleneckPrediction[]> {
    const predictions: BottleneckPrediction[] = []

    // Fetch active deals with their stages
    const { data, error } = await sb
      .from('deals')
      .select('id, stage, value_eur, assigned_to, created_at, updated_at')
      .eq('org_id', org_id)
      .eq('status', 'active')
      .limit(500)

    if (error) {
      logger.error('[BottleneckPredictor] Query failed', { error, org_id })
      return []
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deals: any[] = data ?? []

    // Count deals per stage
    const stageCounts: Record<string, number> = {}
    const stageValues: Record<string, number> = {}
    const agentLoad: Record<string, number> = {}

    for (const d of deals) {
      const stage = (d.stage as string) ?? 'unknown'
      stageCounts[stage] = (stageCounts[stage] ?? 0) + 1
      stageValues[stage] = (stageValues[stage] ?? 0) + ((d.value_eur as number) ?? 0)
      const agent = (d.assigned_to as string) ?? 'unassigned'
      agentLoad[agent] = (agentLoad[agent] ?? 0) + 1
    }

    // Normal expected distribution across 8 stages
    const expectedPerStage = deals.length / 8
    const STAGE_CAPACITY = 15  // deals per stage before bottleneck

    for (const [stage, count] of Object.entries(stageCounts)) {
      if (count > STAGE_CAPACITY || count > expectedPerStage * 2.5) {
        const excess = count - Math.min(STAGE_CAPACITY, expectedPerStage)
        const probability = Math.min(0.95, 0.5 + (excess / STAGE_CAPACITY) * 0.5)
        const days_until_critical = Math.max(1, Math.round(14 - excess * 0.5))

        predictions.push({
          org_id,
          predicted_bottleneck: `stage:${stage}`,
          probability: Math.round(probability * 100) / 100,
          predicted_onset_days: days_until_critical,
          estimated_deals_blocked: count,
          estimated_revenue_impact_eur: Math.round((stageValues[stage] ?? 0) * 100) / 100,
          contributing_factors: [
            `${count} deals currently in ${stage} stage`,
            `Expected capacity: ${Math.round(expectedPerStage)} deals`,
            count > expectedPerStage * 3
              ? 'Severe accumulation — immediate intervention required'
              : 'Growing accumulation — preventive action recommended',
          ],
          preventive_actions: [
            `Increase staffing or automation for ${stage} stage`,
            `Set maximum SLA of 7 days for ${stage} stage transitions`,
            `Auto-trigger escalation when ${stage} queue > ${STAGE_CAPACITY}`,
          ],
          confidence: Math.min(0.9, 0.5 + count / 30),
        })
      }
    }

    // Agent capacity bottleneck
    for (const [agent, load] of Object.entries(agentLoad)) {
      if (load > 20) {
        predictions.push({
          org_id,
          predicted_bottleneck: `agent_capacity:${agent}`,
          probability: Math.min(0.9, load / 30),
          predicted_onset_days: Math.max(3, 14 - load),
          estimated_deals_blocked: Math.round(load * 0.3),
          estimated_revenue_impact_eur: 0,
          contributing_factors: [
            `Agent ${agent} has ${load} active deals`,
            'Exceeds recommended capacity of 20 active deals per agent',
          ],
          preventive_actions: [
            `Redistribute ${Math.round(load - 15)} deals from ${agent}`,
            'Activate deal re-assignment workflow',
          ],
          confidence: 0.75,
        })
      }
    }

    logger.info('[BottleneckPredictor] Predictions generated', {
      org_id, count: predictions.length,
    })
    return predictions.sort((a, b) => b.probability - a.probability)
  }

  async getUrgentPredictions(org_id: string): Promise<BottleneckPrediction[]> {
    const all = await this.predictBottlenecks(org_id)
    return all.filter((p) => p.predicted_onset_days < 14 && p.probability > 0.6)
  }
}

export const bottleneckPredictor = new BottleneckPredictor()
