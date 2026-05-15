// AGENCY GROUP — SH-ROS Feedback: Barrel Export | AMI: 22506
// =============================================================================

export { economicSignalIngestor }                      from './economicSignalIngestor'
export type {
  EconomicSignal, SignalSource, SignalBatch, IngestionStats,
}                                                      from './economicSignalIngestor'

export { signalNoiseFilter }                           from './signalNoiseFilter'
export type { FilterResult, FilterStats, OutlierBounds } from './signalNoiseFilter'

export { outcomeNormalizer }                           from './outcomeNormalizer'
export type { RawOutcome, NormalizedOutcome, NormalizationConfig } from './outcomeNormalizer'

export { rewardCalibrationEngine }                     from './rewardCalibrationEngine'
export type {
  RewardSignal, RewardComponent, CalibrationState, RewardDistribution,
}                                                      from './rewardCalibrationEngine'

export { delayedRewardAttribution }                    from './delayedRewardAttribution'
export type {
  DecisionRecord, AttributionResult, AttributionTrace,
}                                                      from './delayedRewardAttribution'

export { learningValidator }                           from './learningValidator'
export type {
  LearningSnapshot, LearningMetric, ValidationResult, LearningHealth,
}                                                      from './learningValidator'
