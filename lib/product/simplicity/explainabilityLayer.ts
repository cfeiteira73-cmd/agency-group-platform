// AGENCY GROUP — SH-ROS | AMI: 22506
// Product Simplicity Layer: Explainability Layer
// Simplified consumer wrapper over explainabilityRenderer — translates AI scores into plain language
// Portugal context: 18% close rate, 210-day avg cycle, €320K avg deal, 5% commission

import logger from '@/lib/logger'

// ─── Interfaces ───────────────────────────────────────────────────────────────

export type ExplainAudience = 'agent' | 'broker' | 'executive'

export interface ExplainRequest {
  entity_id: string
  entity_type: 'decision' | 'match' | 'prediction' | 'workflow'
  audience: ExplainAudience
  score?: number
  factors?: Record<string, number>
}

export interface SimpleExplanation {
  headline: string
  reason: string
  confidence_label: 'Very High' | 'High' | 'Medium' | 'Low'
  what_to_do: string
  detail_bullets: string[]
}

// ─── Configuration ────────────────────────────────────────────────────────────

// Maps score ranges to confidence labels — upper bound is exclusive
const CONFIDENCE_LABELS: Array<{ min: number; max: number; label: SimpleExplanation['confidence_label'] }> = [
  { min: 85, max: 101, label: 'Very High' },
  { min: 65, max: 85,  label: 'High' },
  { min: 40, max: 65,  label: 'Medium' },
  { min: 0,  max: 40,  label: 'Low' },
]

// Max explanation bullets per audience — agents get fewer, executives get more
const AUDIENCE_DEPTH: Record<ExplainAudience, number> = {
  agent: 2,
  broker: 3,
  executive: 5,
}

// ─── Class ────────────────────────────────────────────────────────────────────

class ExplainabilityLayer {
  explain(request: ExplainRequest): SimpleExplanation {
    const score = request.score ?? 0
    const confidence_label = this.getConfidenceLabel(score)
    const maxBullets = AUDIENCE_DEPTH[request.audience]

    // Build factor-based bullets from provided factors
    const factorBullets = this._buildFactorBullets(request.factors ?? {}, maxBullets)

    const explanation: SimpleExplanation = {
      headline: this._buildHeadline(request, score, confidence_label),
      reason: this._buildReason(request, score),
      confidence_label,
      what_to_do: this._buildWhatToDo(request, score),
      detail_bullets: factorBullets,
    }

    logger.info('[ExplainabilityLayer] explain', {
      entity_id: request.entity_id,
      entity_type: request.entity_type,
      audience: request.audience,
      score,
      confidence_label,
    })

    return explanation
  }

  toOneLiner(explanation: SimpleExplanation): string {
    return `${explanation.headline} — ${explanation.what_to_do}`
  }

  toBullets(explanation: SimpleExplanation, maxBullets?: number): string[] {
    const bullets = explanation.detail_bullets
    if (maxBullets !== undefined) return bullets.slice(0, maxBullets)
    return bullets
  }

  getConfidenceLabel(score: number): SimpleExplanation['confidence_label'] {
    const match = CONFIDENCE_LABELS.find(c => score >= c.min && score < c.max)
    return match?.label ?? 'Low'
  }

  private _buildHeadline(
    request: ExplainRequest,
    score: number,
    confidence_label: SimpleExplanation['confidence_label']
  ): string {
    switch (request.entity_type) {
      case 'match':
        return `${confidence_label} buyer match — score ${score}/100`
      case 'decision':
        return `${confidence_label} confidence decision — ${score}/100`
      case 'prediction':
        return `${confidence_label} revenue prediction — ${score}% probability`
      case 'workflow':
        return `Recommended workflow — ${confidence_label} relevance (${score}/100)`
    }
  }

  private _buildReason(request: ExplainRequest, score: number): string {
    if (!request.factors || Object.keys(request.factors).length === 0) {
      return `The system scored this ${request.entity_type} at ${score}/100 based on pipeline data and historical patterns.`
    }

    const topFactor = Object.entries(request.factors)
      .sort(([, a], [, b]) => b - a)[0]

    return `The primary driver is ${topFactor[0].replace(/_/g, ' ')} (weight: ${Math.round(topFactor[1] * 100)}%), based on ${score < 50 ? 'weak' : 'strong'} historical signal in Portugal market data.`
  }

  private _buildWhatToDo(request: ExplainRequest, score: number): string {
    if (score >= 80) {
      return 'Act immediately — this is a high-priority opportunity.'
    }
    if (score >= 60) {
      return 'Follow up within 24 hours to maintain momentum.'
    }
    if (score >= 40) {
      return 'Monitor and schedule a follow-up for this week.'
    }
    return 'Low priority — park for now and revisit in 30 days.'
  }

  private _buildFactorBullets(factors: Record<string, number>, maxBullets: number): string[] {
    if (Object.keys(factors).length === 0) {
      return ['Score derived from pipeline activity and lead behaviour patterns']
    }

    return Object.entries(factors)
      .sort(([, a], [, b]) => b - a)
      .slice(0, maxBullets)
      .map(([key, weight]) => {
        const label = key.replace(/_/g, ' ')
        const pct = Math.round(weight * 100)
        const direction = weight >= 0.5 ? 'positive' : weight >= 0.3 ? 'moderate' : 'weak'
        return `${label}: ${direction} influence (${pct}%)`
      })
  }
}

export const explainabilityLayer = new ExplainabilityLayer()
