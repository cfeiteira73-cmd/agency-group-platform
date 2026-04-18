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

export type { ForecastContributor, PeriodForecast, ForecastOutput } from './forecast'
export { generateRevenueForecast } from './forecast'

export type { ScoreTrend, ScoreDelta } from './scoringMemory'
export { computeScoreDelta, getLeadScoreDelta, getDealScoreDelta, batchLeadDeltas, batchDealDeltas, updateLeadScoreMemory, updateDealScoreMemory } from './scoringMemory'

export type { WorkloadLabel, WorkloadMetrics } from './workload'
export { computeWorkload } from './workload'

export type { RankedContact, RankedDeal, PortfolioHealthLabel, PortfolioHealth, ExecutiveRankingOutput } from './executiveRanking'
export { rankContacts, rankDeals, computePortfolioHealth, generateExecutiveRanking } from './executiveRanking'
