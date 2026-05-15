// AGENCY GROUP — SH-ROS Product: Barrel Export | AMI: 22506
// =============================================================================

export { productAPI }                                  from './productAPI'
export type { ProductContext, DashboardPayload, EntityInsight } from './productAPI'

export { businessPrimitiveEngine }                     from './businessPrimitiveEngine'
export type {
  BusinessPipeline, LeadSummary, DealSummary, RevenueSnapshot,
}                                                      from './businessPrimitiveEngine'

export { outcomeAbstractionLayer }                     from './outcomeAbstractionLayer'
export type {
  OutcomePrediction, OutcomeSummary, OutcomeComparison,
}                                                      from './outcomeAbstractionLayer'

export { simplifiedDecisionInterface }                 from './simplifiedDecisionInterface'
export type {
  AgentDecisionRequest, AgentAction, DecisionPackage, QuickDecision,
}                                                      from './simplifiedDecisionInterface'

export { explainabilityRenderer }                      from './explainabilityRenderer'
export type {
  Explanation, ExplanationAudience, ExplanationFormat,
  FeatureContribution, BatchExplanationSummary,
}                                                      from './explainabilityRenderer'

export { revenueOutcomeMapper }                        from './revenueOutcomeMapper'
export type {
  RevenueEvent, RevenueEventType, RevenueFunnel,
  RevenueAttribution, DailyRevenueTarget,
}                                                      from './revenueOutcomeMapper'
