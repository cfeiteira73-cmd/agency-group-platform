// AGENCY GROUP — SH-ROS Security Layer Public API | AMI: 22506
// Phase Ω∞-1: Security 78→98 — all security primitives

export { rbacEngine, RBACDeniedError } from './rbac'
export type { RoleName, UserRole } from './rbac'

export { signedAuditChain } from './signedAuditChain'
export type { SignedAuditEntry, SignedAuditRecord, AuditChainVerification } from './signedAuditChain'

export { replayAuthorizationEngine, ReplayNotAuthorizedError } from './replayAuthorization'
export type { ReplayAuthorization, ReplayAuthorizationRequest } from './replayAuthorization'

export { queuePoisonProtection } from './queuePoisonProtection'
export type { PoisonDetectionResult, QuarantinedMessage } from './queuePoisonProtection'

export { tenantIsolationLayer } from './tenantIsolationLayer'
export type { TenantGuardrails, TenantUsageSnapshot } from './tenantIsolationLayer'
