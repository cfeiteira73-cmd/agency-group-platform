// AGENCY GROUP — SH-ROS | AMI: 22506
// Barrel export for the Operational Autonomy Evolution layer.
// Exposes all modules individually and as a unified `autonomy` namespace.

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------

export { confidenceGate } from './confidenceGate'
export { executionGovernance } from './executionGovernance'
export { autonomousWorkflowChain } from './autonomousWorkflowChain'
export { rollbackSafeAutonomy } from './rollbackSafeAutonomy'
export { autonomyController } from './autonomyController'

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type { AutonomyTier, GateDecision, GateResult } from './confidenceGate'
export type { GovernanceRule, GovernanceCheck } from './executionGovernance'
export type { ChainStep, ChainExecution } from './autonomousWorkflowChain'
export type { RollbackCheckpoint } from './rollbackSafeAutonomy'
export type { AutonomyRequest, AutonomyResult } from './autonomyController'

// ---------------------------------------------------------------------------
// Convenience namespace
// ---------------------------------------------------------------------------

import { confidenceGate } from './confidenceGate'
import { executionGovernance } from './executionGovernance'
import { autonomousWorkflowChain } from './autonomousWorkflowChain'
import { rollbackSafeAutonomy } from './rollbackSafeAutonomy'
import { autonomyController } from './autonomyController'

export const autonomy = {
  gate: confidenceGate,
  governance: executionGovernance,
  chain: autonomousWorkflowChain,
  rollback: rollbackSafeAutonomy,
  controller: autonomyController,
} as const
