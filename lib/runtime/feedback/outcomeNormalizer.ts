// AGENCY GROUP — SH-ROS Feedback: Outcome Normalizer | AMI: 22506
// Normalizes raw deal outcomes into consistent training labels for agents
// Handles multi-dimensional outcomes: financial, temporal, relational
// =============================================================================

import logger from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RawOutcome {
  entity_id: string
  entity_type: 'deal' | 'match' | 'proposal'
  org_id: string

  // Financial
  asking_price?: number
  final_price?: number
  commission_earned?: number
  commission_expected?: number

  // Temporal
  days_in_pipeline?: number
  days_to_close?: number

  // Engagement
  proposals_sent?: number
  viewings_held?: number
  counter_offers?: number

  // Result
  outcome: 'closed' | 'lost' | 'withdrawn' | 'active' | 'expired'
  lost_reason?: string
}

export interface NormalizedOutcome {
  entity_id: string
  entity_type: RawOutcome['entity_type']
  org_id: string

  // Normalized scores (all 0–1)
  financial_score: number      // how good was the financial outcome
  efficiency_score: number     // how efficient was the process
  engagement_score: number     // how engaged was the prospect
  overall_score: number        // weighted composite

  // Labels for supervised learning
  label: 'positive' | 'negative' | 'neutral'
  label_confidence: number     // 0–1

  // Decomposed signals
  price_achievement_ratio: number  // final/asking (1.0 = full price)
  commission_ratio: number         // earned/expected
  days_vs_benchmark: number        // actual/benchmark (lower=better)

  // Metadata
  outcome: RawOutcome['outcome']
  normalization_version: number
  normalized_at: string
}

export interface NormalizationConfig {
  // Portugal 2026 market benchmarks
  benchmark_days_to_close: number     // 210
  benchmark_avg_deal_value: number    // €320K
  benchmark_close_rate: number        // 18%
  min_proposals_for_close: number     // typically 2–4
  min_viewings_for_close: number      // typically 3–6

  // Weights for composite score
  financial_weight: number            // 0.5
  efficiency_weight: number           // 0.3
  engagement_weight: number           // 0.2
}

// ─── Default Config ────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: NormalizationConfig = {
  benchmark_days_to_close:   210,
  benchmark_avg_deal_value:  320_000,
  benchmark_close_rate:      0.18,
  min_proposals_for_close:   2,
  min_viewings_for_close:    3,
  financial_weight:          0.5,
  efficiency_weight:         0.3,
  engagement_weight:         0.2,
}

const NORMALIZATION_VERSION = 2

// ─── Outcome Normalizer ────────────────────────────────────────────────────────

export class OutcomeNormalizer {
  private _config: NormalizationConfig

  constructor(config: Partial<NormalizationConfig> = {}) {
    this._config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Normalize a single raw outcome.
   */
  normalize(raw: RawOutcome): NormalizedOutcome {
    const financial_score  = this._computeFinancialScore(raw)
    const efficiency_score = this._computeEfficiencyScore(raw)
    const engagement_score = this._computeEngagementScore(raw)

    const overall_score =
      financial_score  * this._config.financial_weight +
      efficiency_score * this._config.efficiency_weight +
      engagement_score * this._config.engagement_weight

    const { label, label_confidence } = this._assignLabel(raw, overall_score)

    const result: NormalizedOutcome = {
      entity_id:   raw.entity_id,
      entity_type: raw.entity_type,
      org_id:      raw.org_id,

      financial_score:   Math.round(financial_score  * 1000) / 1000,
      efficiency_score:  Math.round(efficiency_score * 1000) / 1000,
      engagement_score:  Math.round(engagement_score * 1000) / 1000,
      overall_score:     Math.round(overall_score    * 1000) / 1000,

      label,
      label_confidence: Math.round(label_confidence * 100) / 100,

      price_achievement_ratio: this._priceAchievementRatio(raw),
      commission_ratio:        this._commissionRatio(raw),
      days_vs_benchmark:       this._daysVsBenchmark(raw),

      outcome:                  raw.outcome,
      normalization_version:    NORMALIZATION_VERSION,
      normalized_at:            new Date().toISOString(),
    }

    logger.info('[OutcomeNormalizer] Normalized', {
      entity_id:    raw.entity_id,
      outcome:      raw.outcome,
      overall_score: result.overall_score,
      label:        result.label,
    })

    return result
  }

  /**
   * Normalize a batch of outcomes.
   */
  normalizeBatch(raws: RawOutcome[]): NormalizedOutcome[] {
    return raws.map(r => this.normalize(r))
  }

  /**
   * Compute aggregate statistics for a set of normalized outcomes.
   */
  computeAggregate(outcomes: NormalizedOutcome[]): {
    count: number
    avg_overall_score: number
    avg_financial_score: number
    avg_efficiency_score: number
    positive_rate: number
    negative_rate: number
    avg_price_achievement: number
    avg_days_vs_benchmark: number
  } {
    if (outcomes.length === 0) {
      return {
        count: 0,
        avg_overall_score:     0,
        avg_financial_score:   0,
        avg_efficiency_score:  0,
        positive_rate:         0,
        negative_rate:         0,
        avg_price_achievement: 0,
        avg_days_vs_benchmark: 1,
      }
    }

    const n = outcomes.length
    const sum = <K extends keyof NormalizedOutcome>(key: K) =>
      outcomes.reduce((s, o) => s + (o[key] as number), 0)

    return {
      count:                 n,
      avg_overall_score:     sum('overall_score')    / n,
      avg_financial_score:   sum('financial_score')  / n,
      avg_efficiency_score:  sum('efficiency_score') / n,
      positive_rate:         outcomes.filter(o => o.label === 'positive').length / n,
      negative_rate:         outcomes.filter(o => o.label === 'negative').length / n,
      avg_price_achievement: sum('price_achievement_ratio') / n,
      avg_days_vs_benchmark: sum('days_vs_benchmark')       / n,
    }
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private _computeFinancialScore(raw: RawOutcome): number {
    if (raw.outcome === 'lost' || raw.outcome === 'withdrawn') return 0.1
    if (raw.outcome !== 'closed') return 0.5  // active/expired — neutral

    const price_ratio = this._priceAchievementRatio(raw)
    const comm_ratio  = this._commissionRatio(raw)

    // Weighted: price achievement 60%, commission ratio 40%
    return Math.min(1, price_ratio * 0.6 + comm_ratio * 0.4)
  }

  private _computeEfficiencyScore(raw: RawOutcome): number {
    const days_ratio = this._daysVsBenchmark(raw)

    // Faster than benchmark → high score
    if (days_ratio <= 0.5) return 1.0
    if (days_ratio <= 0.8) return 0.85
    if (days_ratio <= 1.0) return 0.7
    if (days_ratio <= 1.5) return 0.4
    if (days_ratio <= 2.0) return 0.2
    return 0.1
  }

  private _computeEngagementScore(raw: RawOutcome): number {
    const proposals = raw.proposals_sent ?? 0
    const viewings  = raw.viewings_held  ?? 0
    const counters  = raw.counter_offers ?? 0

    // Normalize each against expected ranges
    const proposal_score = Math.min(1, proposals / this._config.min_proposals_for_close)
    const viewing_score  = Math.min(1, viewings  / this._config.min_viewings_for_close)
    const counter_score  = Math.min(1, counters  / 3)  // up to 3 counter offers is healthy

    return (proposal_score * 0.4 + viewing_score * 0.4 + counter_score * 0.2)
  }

  private _assignLabel(raw: RawOutcome, overall_score: number): {
    label: NormalizedOutcome['label']
    label_confidence: number
  } {
    if (raw.outcome === 'closed') {
      return {
        label: overall_score >= 0.6 ? 'positive' : 'neutral',
        label_confidence: 0.95,  // closed = high certainty
      }
    }

    if (raw.outcome === 'lost') {
      return {
        label: 'negative',
        label_confidence: 0.9,
      }
    }

    if (raw.outcome === 'withdrawn') {
      return {
        label: 'negative',
        label_confidence: 0.7,  // could be seller-initiated
      }
    }

    if (raw.outcome === 'expired') {
      return {
        label: 'negative',
        label_confidence: 0.85,
      }
    }

    // Active — label based on engagement trajectory
    return {
      label: overall_score >= 0.6 ? 'positive' : overall_score >= 0.4 ? 'neutral' : 'negative',
      label_confidence: 0.5,  // uncertain for active
    }
  }

  private _priceAchievementRatio(raw: RawOutcome): number {
    if (!raw.final_price || !raw.asking_price || raw.asking_price === 0) return 0.9  // assume typical
    return Math.min(1.05, raw.final_price / raw.asking_price)  // cap at 105% (above asking)
  }

  private _commissionRatio(raw: RawOutcome): number {
    if (!raw.commission_earned || !raw.commission_expected || raw.commission_expected === 0) return 1.0
    return Math.min(1, raw.commission_earned / raw.commission_expected)
  }

  private _daysVsBenchmark(raw: RawOutcome): number {
    const days = raw.days_to_close ?? raw.days_in_pipeline ?? this._config.benchmark_days_to_close
    return days / this._config.benchmark_days_to_close
  }
}

export const outcomeNormalizer = new OutcomeNormalizer()
