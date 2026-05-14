// =============================================================================
// AGENCY GROUP — SH-ROS Runtime Public API Ω∞
// AMI: 22506 | SH-ROS Institutional Autonomous Revenue OS
// =============================================================================

// ── Core ─────────────────────────────────────────────────────────────────────
export { orchestrator, RuntimeValidationError, RuntimePersistError } from './orchestrator'
export { hotMemory, warmMemory, shortTermMemory, longTermMemory } from './memory'
export { decisionEngine, computeEV, rankOutputs, topN } from './decisionEngine'
export type {
  RuntimeEvent,
  RuntimeEventType,
  RuntimeExecutionTrace,
  ShortTermMemoryEntry,
  LongTermKPI,
  SystemAlertPayload,
  LeadCreatedPayload,
  LeadScoredPayload,
  PipelineStalledPayload,
  DealWonPayload,
  DealLostPayload,
  GenericPayload,
} from './types'
export { EVENT_AGENT_ROUTING, BACKOFF_MS, MAX_RETRIES } from './types'
export type { AgentOutputContract } from '@/lib/agents/types'

// ── Ω-1: Queue Abstraction ───────────────────────────────────────────────────
export { queueProvider, createQueueProvider } from './queue/queueProvider'
export type { IQueueProvider, QueueHealth, QueueMetrics, ReplayOptions } from './queue/queueProvider'
export { QueueHealthMonitor } from './queue/queueHealth'
export { queueMetricsCollector } from './queue/queueMetrics'
export { deadLetterQueue, DeadLetterQueue } from './queue/queueDeadLetter'
export { queueReplayEngine, QueueReplayEngine } from './queue/queueReplay'
export { backpressureController, BackpressureController } from './queue/queueBackpressure'

// ── Ω-2: Workflow Engine ─────────────────────────────────────────────────────
export { workflowRegistry } from './workflows/workflowRegistry'
export { workflowEngine } from './workflows/workflowEngine'
export type { IWorkflowEngine, WorkflowDefinition } from './workflows/workflowEngine'

// ── Ω-3: Cold Memory ─────────────────────────────────────────────────────────
export { coldMemoryStore } from './coldMemory/coldMemoryStore'
export { semanticMemory } from './coldMemory/semanticMemory'
export { vectorMemory } from './coldMemory/vectorMemory'
export { anomalyDetector } from './coldMemory/anomalyDetection'
export { analyticsWarehouse } from './coldMemory/analyticsWarehouse'
export { executionLineageTracker } from './coldMemory/executionLineage'
export { compressionEngine } from './coldMemory/compressionEngine'

// ── Ω-8: Recovery Engine ─────────────────────────────────────────────────────
export { recoveryEngine } from './recovery/recoveryEngine'
export { orphanRecovery } from './recovery/orphanRecovery'
export { reconciliationEngine } from './recovery/reconciliationEngine'
export { distributedLockManager } from './recovery/distributedLocks'
export { executionLeaseManager } from './recovery/executionLeases'
export { splitBrainProtector } from './recovery/splitBrainProtection'

// ── Ω-9: Learning Engine ─────────────────────────────────────────────────────
export { outcomeTracker } from './learning/outcomeTracking'
export { reinforcementWeightStore } from './learning/reinforcementWeights'
export { confidenceCalibrator } from './learning/confidenceCalibration'
export { scoringEvolutionTracker } from './learning/scoringEvolution'
export { learningGovernance } from './learning/learningGovernance'
export { roiOptimizer } from './learning/roiOptimization'
export { executionLearner } from './learning/executionLearning'
