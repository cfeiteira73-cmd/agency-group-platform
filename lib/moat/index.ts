// AGENCY GROUP — SH-ROS | AMI: 22506

// ── Singletons ────────────────────────────────────────────────────────────────
export { workflowDependencyScorer } from './workflowDependencyScorer'
export { operationalEmbeddingMetrics } from './operationalEmbeddingMetrics'
export { switchingCostAnalyzer } from './switchingCostAnalyzer'
export { adoptionDepthMetrics } from './adoptionDepthMetrics'
export { moatScoreAggregator } from './moatScoreAggregator'

// ── Interfaces & types — workflowDependencyScorer ────────────────────────────
export type { WorkflowDependency, DependencyScore } from './workflowDependencyScorer'

// ── Interfaces & types — operationalEmbeddingMetrics ─────────────────────────
export type { EmbeddingMetric, EmbeddingProfile } from './operationalEmbeddingMetrics'

// ── Interfaces & types — switchingCostAnalyzer ───────────────────────────────
export type {
  SwitchingCostComponent,
  SwitchingCostAnalysis,
  SwitchingContext,
} from './switchingCostAnalyzer'

// ── Interfaces & types — adoptionDepthMetrics ────────────────────────────────
export type { AdoptionTier, AdoptionSignal, AdoptionDepthProfile } from './adoptionDepthMetrics'

// ── Interfaces & types — moatScoreAggregator ─────────────────────────────────
export type { MoatDimensions, MoatScore } from './moatScoreAggregator'

// ── Convenience namespace ─────────────────────────────────────────────────────
import { workflowDependencyScorer } from './workflowDependencyScorer'
import { operationalEmbeddingMetrics } from './operationalEmbeddingMetrics'
import { switchingCostAnalyzer } from './switchingCostAnalyzer'
import { adoptionDepthMetrics } from './adoptionDepthMetrics'
import { moatScoreAggregator } from './moatScoreAggregator'

export const moat = {
  workflowDependencyScorer,
  operationalEmbeddingMetrics,
  switchingCostAnalyzer,
  adoptionDepthMetrics,
  moatScoreAggregator,
}
