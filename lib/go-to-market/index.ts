// AGENCY GROUP — SH-ROS GTM: Barrel Export | AMI: 22506
// =============================================================================

export { positioningMatrix }                           from './positioningMatrix'
export {
  ICP_DEFINITIONS, VALUE_PROPOSITIONS, POSITIONING_AXES,
}                                                      from './positioningMatrix'
export type {
  PositioningAxis, IdealCustomerProfile, ValueProposition, PositioningStatement,
}                                                      from './positioningMatrix'

export { pricingEngine }                               from './pricingEngine'
export { PRICING_TIERS }                               from './pricingEngine'
export type {
  PricingTier, PricingQuote, ROIEstimate, PricingLineItem,
}                                                      from './pricingEngine'

export { unitEconomicsModel }                          from './unitEconomicsModel'
export type {
  UnitEconomics, CohortAnalysis, GrowthForecast,
}                                                      from './unitEconomicsModel'

export { marketExpansionStrategy }                     from './marketExpansionStrategy'
export {
  MARKET_OPPORTUNITIES, EXPANSION_WAVES, GTM_MOTIONS,
}                                                      from './marketExpansionStrategy'
export type {
  MarketOpportunity, ExpansionWave, GTMMotion,
}                                                      from './marketExpansionStrategy'

export { competitorBenchmarking }                      from './competitorBenchmarking'
export { COMPETITORS, FEATURE_COMPARISON }             from './competitorBenchmarking'
export type {
  Competitor, FeatureComparison, CompetitivePosition,
}                                                      from './competitorBenchmarking'
