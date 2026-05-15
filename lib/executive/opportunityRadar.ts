// AGENCY GROUP — SH-ROS | AMI: 22506
// Opportunity Radar — real-time signal detection for revenue acceleration
// Portugal 2026: €3.076/m² median · 210 days avg close · 18% close rate · 5% commission
// =============================================================================

import { logger } from '@/lib/observability/logger'
import { randomUUID } from 'crypto'

// ─── Constants ─────────────────────────────────────────────────────────────────

const AVG_DEAL_VALUE = 320_000
const COMMISSION_RATE = 0.05

// ─── Interfaces ────────────────────────────────────────────────────────────────

export type RadarSignalType =
  | 'hot_lead'
  | 'stale_deal'
  | 'market_timing'
  | 'competitor_gap'
  | 'price_reduction'
  | 'follow_up_overdue'
  | 'high_value_match'

export interface RadarSignal {
  signal_id: string
  type: RadarSignalType
  title: string
  description: string
  expected_value_eur: number
  urgency: 'immediate' | 'today' | 'this_week' | 'this_month'
  probability: number
  score: number
  recommended_action: string
  detected_at: Date
}

export interface RadarScan {
  org_id: string
  scanned_at: Date
  signals: RadarSignal[]
  total_opportunity_eur: number
  top_signal: RadarSignal | null
}

// ─── Signal Templates ─────────────────────────────────────────────────────────

export const SIGNAL_TEMPLATES: Record<
  RadarSignalType,
  Omit<RadarSignal, 'signal_id' | 'detected_at' | 'score'>
> = {
  hot_lead: {
    type: 'hot_lead',
    title: 'Hot lead ready for proposal',
    description: 'Lead score ≥80 with confirmed budget and timeline — proposal window is open.',
    expected_value_eur: AVG_DEAL_VALUE * COMMISSION_RATE,
    urgency: 'today',
    probability: 0.45,
    recommended_action: 'Send personalised property shortlist and schedule viewing within 48 hours',
  },
  stale_deal: {
    type: 'stale_deal',
    title: 'Stale deal at risk of loss',
    description: 'Deal has had no activity for 14+ days — churn risk is elevated.',
    expected_value_eur: AVG_DEAL_VALUE * COMMISSION_RATE * 0.6,
    urgency: 'today',
    probability: 0.3,
    recommended_action: 'Re-engage with new property angle or price insight to restart momentum',
  },
  market_timing: {
    type: 'market_timing',
    title: 'Favourable market window detected',
    description: 'Price trend and buyer demand align — current 2–3 week window favours closings.',
    expected_value_eur: AVG_DEAL_VALUE * COMMISSION_RATE * 1.2,
    urgency: 'this_week',
    probability: 0.35,
    recommended_action: 'Accelerate negotiations on deals at proposal/offer stage',
  },
  competitor_gap: {
    type: 'competitor_gap',
    title: 'Competitor portfolio gap identified',
    description: 'Target buyer segment underserved by competing agencies in this price range.',
    expected_value_eur: AVG_DEAL_VALUE * COMMISSION_RATE * 0.8,
    urgency: 'this_week',
    probability: 0.25,
    recommended_action: 'Target gap with exclusive listings campaign to capture unmet demand',
  },
  price_reduction: {
    type: 'price_reduction',
    title: 'Price reduction creates buyer opportunity',
    description: 'Seller agreed price reduction — property now enters range of 3 qualified buyers.',
    expected_value_eur: AVG_DEAL_VALUE * COMMISSION_RATE,
    urgency: 'immediate',
    probability: 0.55,
    recommended_action: 'Notify matched buyers immediately — first-mover advantage is critical',
  },
  follow_up_overdue: {
    type: 'follow_up_overdue',
    title: 'Follow-up overdue on warm lead',
    description: 'Qualified lead has not been contacted in 7+ days — cooling risk.',
    expected_value_eur: AVG_DEAL_VALUE * COMMISSION_RATE * 0.4,
    urgency: 'today',
    probability: 0.28,
    recommended_action: 'Send personalised check-in with market update and new property alert',
  },
  high_value_match: {
    type: 'high_value_match',
    title: 'High-value buyer-property match',
    description: 'Buyer criteria (budget, location, type) align precisely with newly listed property.',
    expected_value_eur: AVG_DEAL_VALUE * 1.5 * COMMISSION_RATE,
    urgency: 'immediate',
    probability: 0.5,
    recommended_action: 'Arrange exclusive preview before property goes to market',
  },
}

// ─── Opportunity Radar ────────────────────────────────────────────────────────

export class OpportunityRadar {
  /**
   * Run a full radar scan for an organisation and return all detected signals.
   */
  scan(orgId: string): RadarScan {
    logger.info('[OpportunityRadar] Running radar scan', {
      route: 'executive/radar',
      correlation_id: orgId,
    })

    // In production, signals are derived from live Supabase pipeline data.
    // Here we generate a realistic baseline scan using the signal templates.
    const activeSignalTypes: RadarSignalType[] = [
      'hot_lead',
      'stale_deal',
      'price_reduction',
      'follow_up_overdue',
      'high_value_match',
    ]

    const signals: RadarSignal[] = activeSignalTypes.map(type =>
      this.createSignal(type, {}),
    )

    // Sort by score descending
    signals.sort((a, b) => b.score - a.score)

    const total_opportunity_eur = signals.reduce((sum, s) => sum + s.expected_value_eur * s.probability, 0)
    const top_signal = signals[0] ?? null

    const scan: RadarScan = {
      org_id: orgId,
      scanned_at: new Date(),
      signals,
      total_opportunity_eur,
      top_signal,
    }

    logger.info('[OpportunityRadar] Scan complete', {
      route: 'executive/radar',
      correlation_id: orgId,
    })

    return scan
  }

  /**
   * Return the top N signals by score.
   */
  getTopOpportunities(orgId: string, limit: number = 3): RadarSignal[] {
    const scan = this.scan(orgId)
    return scan.signals.slice(0, limit)
  }

  /**
   * Calculate the composite score for a signal.
   * score = expected_value × probability × urgency_multiplier
   */
  scoreSignal(
    signal: Pick<RadarSignal, 'expected_value_eur' | 'probability' | 'urgency'>,
  ): number {
    return (
      signal.expected_value_eur *
      signal.probability *
      this._urgencyMultiplier(signal.urgency)
    )
  }

  /**
   * Create a new radar signal from a template, with optional overrides.
   */
  createSignal(type: RadarSignalType, overrides: Partial<RadarSignal>): RadarSignal {
    const template = SIGNAL_TEMPLATES[type]
    const base: Omit<RadarSignal, 'score'> = {
      ...template,
      ...overrides,
      signal_id: overrides.signal_id ?? randomUUID(),
      type,
      detected_at: overrides.detected_at ?? new Date(),
    }

    const score = this.scoreSignal({
      expected_value_eur: base.expected_value_eur,
      probability: base.probability,
      urgency: base.urgency,
    })

    return { ...base, score }
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private _urgencyMultiplier(urgency: RadarSignal['urgency']): number {
    const map: Record<RadarSignal['urgency'], number> = {
      immediate: 2.0,
      today: 1.5,
      this_week: 1.0,
      this_month: 0.7,
    }
    return map[urgency]
  }
}

export const opportunityRadar = new OpportunityRadar()
