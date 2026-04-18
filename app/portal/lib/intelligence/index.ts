// =============================================================================
// AGENCY GROUP — Intelligence Layer — Barrel Export
// Centralises all intelligence module imports for consumers.
// Import from here rather than individual files to avoid circular dependency
// risk as the graph grows.
// =============================================================================

export type { DealPrediction, ScoredDealPrediction, CloseWindow, PredictionConfidence } from './prediction'
export { predictDealClosure, predictAllDeals } from './prediction'

export type { PricingSignal, PricingInsight } from './pricing'
export { computePricingInsight, computeAllPricingInsights } from './pricing'

export type { OpportunityType, Opportunity } from './opportunity'
export { detectOpportunities, getTopOpportunities, opportunitySummary } from './opportunity'

export type { CopilotUrgency, CopilotSuggestion, ManagerBrief, AgentCopilotOutput } from './copilot'
export { generateLeadSuggestion, generateDealSuggestion, generateCopilot } from './copilot'
