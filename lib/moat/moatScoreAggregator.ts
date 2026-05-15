// AGENCY GROUP — SH-ROS | AMI: 22506
import { logger } from '@/lib/observability/logger'
import { workflowDependencyScorer } from './workflowDependencyScorer'
import { operationalEmbeddingMetrics } from './operationalEmbeddingMetrics'
import { switchingCostAnalyzer } from './switchingCostAnalyzer'
import { adoptionDepthMetrics } from './adoptionDepthMetrics'

export { workflowDependencyScorer, operationalEmbeddingMetrics, switchingCostAnalyzer, adoptionDepthMetrics }

export interface MoatDimensions {
  workflow_dependency: number    // 0-100
  operational_embedding: number  // 0-100
  switching_cost_index: number   // 0-100 normalized
  adoption_depth: number         // 0-100
}

export interface MoatScore {
  org_id: string
  composite_score: number
  moat_label: 'at_risk' | 'developing' | 'established' | 'fortified' | 'impenetrable'
  dimensions: MoatDimensions
  estimated_switching_cost_eur: number
  retention_probability: number   // 0-1
  expansion_probability: number   // 0-1
  key_strength: string
  key_vulnerability: string
  scored_at: Date
}

const DIMENSION_WEIGHTS: Record<keyof MoatDimensions, number> = {
  workflow_dependency: 0.30,
  operational_embedding: 0.25,
  switching_cost_index: 0.25,
  adoption_depth: 0.20,
}

const MOAT_THRESHOLDS = { at_risk: 20, developing: 40, established: 60, fortified: 80 } // >80 = impenetrable

class MoatScoreAggregator {
  aggregate(
    orgId: string,
    inputs: {
      workflowScore: number
      embeddingScore: number
      switchingCostEur: number
      adoptionScore: number
    },
  ): MoatScore {
    const dimensions: MoatDimensions = {
      workflow_dependency: Math.min(100, Math.max(0, inputs.workflowScore)),
      operational_embedding: Math.min(100, Math.max(0, inputs.embeddingScore)),
      switching_cost_index: this.normalizeSwitchingCost(inputs.switchingCostEur),
      adoption_depth: Math.min(100, Math.max(0, inputs.adoptionScore)),
    }

    const composite_score = this.getCompositeScore(dimensions)
    const moat_label = this.getMoatLabel(composite_score)
    const retention_probability = this.calculateRetentionProbability(composite_score)
    const expansion_probability = this.calculateExpansionProbability(composite_score)
    const key_strength = this._getKeyStrength(dimensions)
    const key_vulnerability = this._getKeyVulnerability(dimensions)

    logger.info('[MoatScoreAggregator] score aggregated', {
      orgId,
      composite_score,
      moat_label,
      retention_probability,
    })

    return {
      org_id: orgId,
      composite_score,
      moat_label,
      dimensions,
      estimated_switching_cost_eur: inputs.switchingCostEur,
      retention_probability,
      expansion_probability,
      key_strength,
      key_vulnerability,
      scored_at: new Date(),
    }
  }

  getMoatLabel(score: number): MoatScore['moat_label'] {
    if (score <= MOAT_THRESHOLDS.at_risk) return 'at_risk'
    if (score <= MOAT_THRESHOLDS.developing) return 'developing'
    if (score <= MOAT_THRESHOLDS.established) return 'established'
    if (score <= MOAT_THRESHOLDS.fortified) return 'fortified'
    return 'impenetrable'
  }

  getCompositeScore(dims: MoatDimensions): number {
    const raw =
      dims.workflow_dependency * DIMENSION_WEIGHTS.workflow_dependency +
      dims.operational_embedding * DIMENSION_WEIGHTS.operational_embedding +
      dims.switching_cost_index * DIMENSION_WEIGHTS.switching_cost_index +
      dims.adoption_depth * DIMENSION_WEIGHTS.adoption_depth
    return Math.min(100, Math.round(raw))
  }

  calculateRetentionProbability(score: number): number {
    // Sigmoid-like curve:
    // score < 40 → 0.50–0.70
    // 40–80     → 0.70–0.95
    // >80       → 0.95–0.99
    if (score < 40) {
      return Math.round((0.50 + (score / 40) * 0.20) * 100) / 100
    }
    if (score <= 80) {
      return Math.round((0.70 + ((score - 40) / 40) * 0.25) * 100) / 100
    }
    return Math.round((0.95 + ((score - 80) / 20) * 0.04) * 100) / 100
  }

  calculateExpansionProbability(score: number): number {
    return Math.min(0.70, Math.round(score * 0.008 * 100) / 100)
  }

  normalizeSwitchingCost(costEur: number): number {
    return Math.min(100, Math.round(costEur / 2000))
  }

  private _getKeyStrength(dims: MoatDimensions): string {
    const labels: Record<keyof MoatDimensions, string> = {
      workflow_dependency: 'workflow dependency — the platform is deeply woven into daily operations',
      operational_embedding: 'operational embedding — the team relies on the platform for critical processes',
      switching_cost_index: 'high switching cost — migrating would be prohibitively expensive and disruptive',
      adoption_depth: 'deep feature adoption — the team actively uses advanced capabilities',
    }
    const top = (Object.keys(dims) as (keyof MoatDimensions)[]).reduce((a, b) =>
      dims[a] >= dims[b] ? a : b,
    )
    return labels[top]
  }

  private _getKeyVulnerability(dims: MoatDimensions): string {
    const labels: Record<keyof MoatDimensions, string> = {
      workflow_dependency: 'low workflow dependency — few core processes rely on the platform',
      operational_embedding: 'shallow operational embedding — the platform is not yet central to daily work',
      switching_cost_index: 'low switching cost — a competitor could lure this account away without major friction',
      adoption_depth: 'limited feature adoption — the team is not yet using high-value capabilities',
    }
    const weakest = (Object.keys(dims) as (keyof MoatDimensions)[]).reduce((a, b) =>
      dims[a] <= dims[b] ? a : b,
    )
    return labels[weakest]
  }
}

export const moatScoreAggregator = new MoatScoreAggregator()
export default moatScoreAggregator
