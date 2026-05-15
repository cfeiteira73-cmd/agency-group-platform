// AGENCY GROUP — SH-ROS Distributed: Barrel Export | AMI: 22506
// =============================================================================

export { partitionStrategy }                           from './partitionStrategy'
export type { PartitionMap, PartitionAssignment }      from './partitionStrategy'

export { kafkaClusterAdapter }                         from './kafkaClusterAdapter'
export type {
  KafkaClusterConfig, KafkaClusterHealth, ProduceResult, ConsumeOptions,
}                                                      from './kafkaClusterAdapter'

export { multiRegionRouter }                           from './multiRegionRouter'
export type { Region, RegionConfig, RoutingDecision, RegionHealth } from './multiRegionRouter'

export { globalFailoverController }                    from './globalFailoverController'
export type {
  FailoverEvent, RegionCircuitBreaker, FailoverTrigger,
}                                                      from './globalFailoverController'

export { distributedReplayEngine }                     from './distributedReplayEngine'
export type {
  DistributedReplayRequest, ReplayProgress, ReplaySummary,
}                                                      from './distributedReplayEngine'

export { distributedBackpressureController }           from './backpressureController'
export type {
  BackpressureState, RegionBackpressure, BackpressureConfig,
}                                                      from './backpressureController'

export { regionalWorkerCoordinator, HEARTBEAT_INTERVAL_MS } from './regionalWorkerCoordinator'
export type {
  WorkerRegistration, ShardAssignment, CoordinatorState, WorkerHealth,
}                                                      from './regionalWorkerCoordinator'
