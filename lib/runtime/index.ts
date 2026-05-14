// =============================================================================
// AGENCY GROUP — SH-ROS Runtime Public API vFINAL
// AMI: 22506 | SH-ROS Production Runtime
// =============================================================================

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
