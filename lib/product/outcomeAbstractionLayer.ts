// AGENCY GROUP — SH-ROS Product: Outcome Abstraction Layer | AMI: 22506
// Hides ML/system complexity — exposes only outcomes agents and UI need
// "Will this deal close?" not "what is the posterior probability given feature vector X"
// =============================================================================

import logger from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OutcomePrediction {
  entity_id:     string
  entity_type:   'deal' | 'match' | 'lead'
  org_id:        string

  // Business outcome (what matters)
  will_close:          boolean        // binary prediction
  close_probability:   number         // 0–1
  expected_value:      number         // € if closes
  expected_close_date: string | null  // ISO date estimate
  confidence_level:    'high' | 'medium' | 'low'

  // Why (without ML jargon)
  positive_factors:    string[]       // max 3, plain language
  risk_factors:        string[]       // max 3, plain language
  recommended_action:  string         // single clear next step

  // Metadata
  prediction_id:       string
  model_version:       string
  predicted_at:        string
}

export interface OutcomeSummary {
  org_id:           string
  period:           string
  total_predicted:  number
  high_confidence:  number
  expected_closures: number
  expected_revenue:  number
  avg_close_prob:   number
  action_required:  number   // predictions requiring urgent action
}

export interface OutcomeComparison {
  entity_id:          string
  predicted_at:       string
  predicted_probability: number
  actual_outcome:     'closed' | 'lost' | 'pending'
  actual_value:       number | null
  prediction_error:   number | null  // |predicted - actual|
  was_accurate:       boolean | null
}

// ─── Outcome Abstraction Layer ────────────────────────────────────────────────

export class OutcomeAbstractionLayer {
  private _predictions = new Map<string, OutcomePrediction>()
  private _actuals     = new Map<string, OutcomeComparison>()

  /**
   * Translate raw ML scores into a business outcome prediction.
   * This is the key abstraction: ML scores → business language.
   */
  predict(params: {
    entity_id:     string
    entity_type:   OutcomePrediction['entity_type']
    org_id:        string
    match_score?:  number    // 0–100
    priority?:     string    // 'critical' | 'high' | 'medium' | 'low'
    days_in_stage?: number
    deal_value?:   number
    engagement_signals?: Record<string, unknown>
  }): OutcomePrediction {
    const score = params.match_score ?? 50
    const close_probability = this._scoreToCloseProbability(
      score, params.days_in_stage ?? 0, params.priority
    )

    const will_close     = close_probability >= 0.5
    const expected_value = (params.deal_value ?? 500_000) * close_probability
    const confidence     = this._classifyConfidence(score, params.days_in_stage ?? 0)

    const { positive, risks } = this._generateFactors(
      score, params.days_in_stage ?? 0, params.priority, params.engagement_signals
    )

    const expected_close_date = will_close
      ? this._estimateCloseDate(params.days_in_stage ?? 0)
      : null

    const prediction: OutcomePrediction = {
      entity_id:            params.entity_id,
      entity_type:          params.entity_type,
      org_id:               params.org_id,
      will_close,
      close_probability,
      expected_value,
      expected_close_date,
      confidence_level:     confidence,
      positive_factors:     positive,
      risk_factors:         risks,
      recommended_action:   this._recommendAction(score, params.priority, params.days_in_stage ?? 0),
      prediction_id:        `pred:${params.entity_id}:${Date.now()}`,
      model_version:        'v2-portugal-2026',
      predicted_at:         new Date().toISOString(),
    }

    this._predictions.set(params.entity_id, prediction)

    logger.info('[OutcomeAbstraction] Prediction created', {
      entity_id:        params.entity_id,
      close_probability: close_probability.toFixed(2),
      will_close,
      confidence,
    })

    return prediction
  }

  /**
   * Get a cached prediction.
   */
  getPrediction(entity_id: string): OutcomePrediction | null {
    return this._predictions.get(entity_id) ?? null
  }

  /**
   * Record actual outcome for calibration tracking.
   */
  recordActual(
    entity_id: string,
    actual_outcome: OutcomeComparison['actual_outcome'],
    actual_value: number | null
  ): OutcomeComparison {
    const prediction = this._predictions.get(entity_id)

    const comparison: OutcomeComparison = {
      entity_id,
      predicted_at:           prediction?.predicted_at ?? new Date().toISOString(),
      predicted_probability:  prediction?.close_probability ?? 0,
      actual_outcome,
      actual_value,
      prediction_error:       prediction
        ? Math.abs(prediction.close_probability - (actual_outcome === 'closed' ? 1 : 0))
        : null,
      was_accurate: prediction
        ? (prediction.will_close && actual_outcome === 'closed') ||
          (!prediction.will_close && actual_outcome === 'lost')
        : null,
    }

    this._actuals.set(entity_id, comparison)
    return comparison
  }

  /**
   * Compute outcome summary across all predictions for an org.
   */
  getSummary(org_id: string, period = 'current'): OutcomeSummary {
    const org_predictions = Array.from(this._predictions.values())
      .filter(p => p.org_id === org_id)

    const high_confidence = org_predictions.filter(p => p.confidence_level === 'high').length
    const expected_closures = org_predictions.filter(p => p.will_close).length
    const expected_revenue  = org_predictions.reduce((s, p) => s + p.expected_value, 0)
    const avg_close_prob    = org_predictions.length > 0
      ? org_predictions.reduce((s, p) => s + p.close_probability, 0) / org_predictions.length
      : 0

    const action_required = org_predictions.filter(p =>
      p.confidence_level === 'high' && p.will_close
    ).length

    return {
      org_id,
      period,
      total_predicted:   org_predictions.length,
      high_confidence,
      expected_closures,
      expected_revenue,
      avg_close_prob,
      action_required,
    }
  }

  /**
   * Get prediction accuracy stats.
   */
  getAccuracyStats(org_id: string): {
    total: number
    accurate: number
    accuracy_rate: number
    avg_error: number
  } {
    const comparisons = Array.from(this._actuals.values())
      .filter(c => {
        const pred = this._predictions.get(c.entity_id)
        return pred?.org_id === org_id
      })

    if (comparisons.length === 0) {
      return { total: 0, accurate: 0, accuracy_rate: 0, avg_error: 0 }
    }

    const with_verdict  = comparisons.filter(c => c.was_accurate !== null)
    const accurate      = with_verdict.filter(c => c.was_accurate).length
    const errors        = comparisons.filter(c => c.prediction_error !== null)
    const avg_error     = errors.length > 0
      ? errors.reduce((s, c) => s + (c.prediction_error ?? 0), 0) / errors.length
      : 0

    return {
      total:         comparisons.length,
      accurate,
      accuracy_rate: with_verdict.length > 0 ? accurate / with_verdict.length : 0,
      avg_error,
    }
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private _scoreToCloseProbability(
    score: number,
    days_in_stage: number,
    priority?: string
  ): number {
    // Base probability from score (Portugal baseline: 18% at score 50)
    let base = 0.18

    if (score >= 80) base = 0.65
    else if (score >= 70) base = 0.45
    else if (score >= 60) base = 0.30
    else if (score >= 50) base = 0.18
    else if (score >= 40) base = 0.10
    else base = 0.05

    // Decay for stale leads
    if (days_in_stage > 180) base *= 0.5
    else if (days_in_stage > 90) base *= 0.75

    // Priority boost
    if (priority === 'critical') base = Math.min(0.95, base * 1.3)

    return Math.round(base * 100) / 100
  }

  private _classifyConfidence(
    score: number,
    days_in_stage: number
  ): OutcomePrediction['confidence_level'] {
    if (score >= 75 && days_in_stage < 30) return 'high'
    if (score >= 55 && days_in_stage < 90) return 'medium'
    return 'low'
  }

  private _generateFactors(
    score: number,
    days_in_stage: number,
    priority?: string,
    signals?: Record<string, unknown>
  ): { positive: string[]; risks: string[] } {
    const positive: string[] = []
    const risks: string[] = []

    if (score >= 80) positive.push('Strong match score — buyer-property fit confirmed')
    if (score >= 60) positive.push('Above-threshold compatibility')
    if (priority === 'critical') positive.push('Flagged as high-priority opportunity')
    if (signals?.viewings_held) positive.push('Property viewed — buyer interest confirmed')
    if (signals?.proposals_sent) positive.push('Proposal already in progress')

    if (days_in_stage > 90) risks.push('Lead has been stagnant for 90+ days')
    if (days_in_stage > 180) risks.push('High staleness risk — may have engaged competitor')
    if (score < 60) risks.push('Below-median compatibility score')
    if (!signals?.last_contact) risks.push('No recent contact recorded')

    return {
      positive: positive.slice(0, 3),
      risks:    risks.slice(0, 3),
    }
  }

  private _recommendAction(score: number, priority?: string, days_in_stage = 0): string {
    if (priority === 'critical' || score >= 80) {
      return 'Call immediately — this is a hot opportunity'
    }
    if (days_in_stage > 90) {
      return 'Re-engage with a fresh property suggestion'
    }
    if (score >= 60) {
      return 'Schedule a viewing or send updated proposal'
    }
    return 'Send curated property shortlist to maintain engagement'
  }

  private _estimateCloseDate(days_already_spent: number): string {
    const remaining = Math.max(30, 210 - days_already_spent)
    const close = new Date(Date.now() + remaining * 86_400_000)
    return close.toISOString().split('T')[0]
  }
}

export const outcomeAbstractionLayer = new OutcomeAbstractionLayer()
