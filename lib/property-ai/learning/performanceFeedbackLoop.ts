// AGENCY GROUP — SH-ROS Property AI | AMI: 22506

import { logger } from '@/lib/observability/logger'
import { supabaseAdmin } from '@/lib/supabase'
import type { LearningInsights } from '@/lib/property-ai/learning/conversionLearningEngine'

const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }

export interface FeedbackAdjustment {
  adjustment_id: string
  org_id: string
  feature: string
  old_weight: number
  new_weight: number
  reason: string
  applied_at: Date
}

const DEFAULT_WEIGHTS: Record<string, number> = {
  luxury_score_gt_80: 1.0,
  luxury_score_60_80: 0.8,
  has_sea_view: 0.9,
  has_pool: 0.7,
  high_investor_attractiveness: 0.85,
  price_below_market: 0.75,
  high_demand_score: 0.8,
}

const MAX_INCREASE_PCT = 0.10
const MAX_DECREASE_PCT = 0.05

class PerformanceFeedbackLoop {
  private static instance: PerformanceFeedbackLoop
  private weights = new Map<string, Record<string, number>>()

  private constructor() {}

  static getInstance(): PerformanceFeedbackLoop {
    if (!PerformanceFeedbackLoop.instance) {
      PerformanceFeedbackLoop.instance = new PerformanceFeedbackLoop()
    }
    return PerformanceFeedbackLoop.instance
  }

  getWeights(orgId: string): Record<string, number> {
    if (!this.weights.has(orgId)) {
      this.weights.set(orgId, { ...DEFAULT_WEIGHTS })
    }
    return { ...this.weights.get(orgId)! }
  }

  private normaliseFeatureName(feature: string): string {
    return feature.replace(/[^a-zA-Z0-9]/g, '_')
  }

  async applyFeedback(orgId: string, insights: LearningInsights): Promise<FeedbackAdjustment[]> {
    const current = this.getWeights(orgId)
    const updated = { ...current }
    const adjustments: FeedbackAdjustment[] = []
    const now = new Date()

    // Increase weights for top converting features
    for (const pattern of insights.top_converting_features) {
      const key = this.normaliseFeatureName(pattern.feature)
      const oldWeight = updated[key] ?? 0.5
      const lift = Math.min(MAX_INCREASE_PCT, pattern.conversion_lift * 0.1)
      const newWeight = Math.min(2.0, oldWeight + oldWeight * lift)

      if (Math.abs(newWeight - oldWeight) > 0.001) {
        updated[key] = Math.round(newWeight * 1000) / 1000
        adjustments.push({
          adjustment_id: crypto.randomUUID(),
          org_id: orgId,
          feature: pattern.feature,
          old_weight: Math.round(oldWeight * 1000) / 1000,
          new_weight: updated[key],
          reason: `Top converting feature — lift ${(pattern.conversion_lift * 100).toFixed(1)}% vs baseline`,
          applied_at: now,
        })
      }
    }

    // Decrease weights for underperforming patterns
    for (const feature of insights.underperforming_patterns) {
      const key = this.normaliseFeatureName(feature)
      const oldWeight = updated[key] ?? 0.5
      const decrease = oldWeight * MAX_DECREASE_PCT
      const newWeight = Math.max(0.1, oldWeight - decrease)

      if (Math.abs(newWeight - oldWeight) > 0.001) {
        updated[key] = Math.round(newWeight * 1000) / 1000
        adjustments.push({
          adjustment_id: crypto.randomUUID(),
          org_id: orgId,
          feature,
          old_weight: Math.round(oldWeight * 1000) / 1000,
          new_weight: updated[key],
          reason: 'Underperforming pattern — reducing scoring weight',
          applied_at: now,
        })
      }
    }

    this.weights.set(orgId, updated)

    if (adjustments.length > 0) {
      try {
        const table = sb.from('property_ai_learning_adjustments') as {
          insert: (rows: unknown[]) => Promise<{ error: unknown }>
        }
        const { error } = await table.insert(adjustments)
        if (error) logger.error('[PerformanceFeedbackLoop] persist error', { orgId, error })
      } catch (err) {
        logger.error('[PerformanceFeedbackLoop] persist exception', { orgId, err })
      }
    }

    logger.info('[PerformanceFeedbackLoop] applied', {
      orgId,
      adjustments_count: adjustments.length,
    })

    return adjustments
  }
}

export const performanceFeedbackLoop = PerformanceFeedbackLoop.getInstance()
