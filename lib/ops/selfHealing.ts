// =============================================================================
// Agency Group — Self-Healing Reliability Infrastructure
// lib/ops/selfHealing.ts
//
// Phase 6: Self-Healing Reliability Infrastructure
//
// Detects, classifies, and coordinates recovery from system failures.
// Prevents cascading failures via circuit breakers and kill-switch escalation.
//
// FAILURE TAXONOMY:
//   data_failure      — bad/missing input data (retry safe)
//   infra_failure     — DB/API/network unreachable (retry with backoff)
//   model_degradation — accuracy/drift issue (requires human review)
//   market_anomaly    — unexpected market event (alert + degrade gracefully)
//   rate_limit        — API rate limiting (exponential backoff)
//   auth_failure      — credential/token issue (no retry — alert)
//
// CIRCUIT BREAKER STATES:
//   closed  → normal operation
//   open    → blocking all calls (failure threshold exceeded)
//   half_open → testing recovery (allow one call through)
//
// PURE FUNCTIONS:
//   classifyFailure, computeRetryStrategy, shouldCircuitBreak,
//   computeStabilityScore, buildRecoveryPlan, classifyCircuitState
// =============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FailureType =
  | 'data_failure'
  | 'infra_failure'
  | 'model_degradation'
  | 'market_anomaly'
  | 'rate_limit'
  | 'auth_failure'
  | 'unknown'

export type CircuitState = 'closed' | 'open' | 'half_open'

export interface SystemFailure {
  error_message:     string
  error_code?:       string | number
  component:         string           // e.g. 'supabase', 'openai', 'avm_compute'
  occurred_at:       string
  context?:          Record<string, unknown>
}

export interface FailureClassification {
  failure_type:     FailureType
  is_retriable:     boolean
  requires_human:   boolean
  severity:         'low' | 'medium' | 'high' | 'critical'
  confidence:       number           // 0-1 classification confidence
  reasoning:        string
}

export interface RetryStrategy {
  max_attempts:     number
  base_delay_ms:    number
  backoff_factor:   number
  jitter:           boolean
  timeout_ms:       number
}

export interface CircuitBreakerConfig {
  failure_threshold:      number     // open circuit after N failures
  success_threshold:      number     // close circuit after N successes
  half_open_timeout_ms:   number     // time before trying half-open
  error_rate_threshold:   number     // 0-1 (e.g. 0.5 = 50% error rate)
}

export interface RecoveryPlan {
  failure_type:     FailureType
  steps:            string[]
  estimated_recovery_ms: number
  fallback_available: boolean
  fallback_description?: string
  requires_intervention: boolean
}

export interface StabilityAssessment {
  score:                 number        // 0-100 (100 = perfect)
  status:                'healthy' | 'degraded' | 'critical'
  degraded_components:   string[]
  recommendations:       string[]
}

// ---------------------------------------------------------------------------
// PURE: Classify failure by error message and context
// ---------------------------------------------------------------------------

export function classifyFailure(failure: SystemFailure): FailureClassification {
  const msg   = failure.error_message.toLowerCase()
  const code  = String(failure.error_code ?? '')

  // Auth failures — never retry, alert immediately
  if (code === '401' || code === '403' || msg.includes('unauthorized') || msg.includes('forbidden') || msg.includes('invalid token') || msg.includes('jwt')) {
    return { failure_type: 'auth_failure', is_retriable: false, requires_human: true, severity: 'critical', confidence: 0.95, reasoning: 'Auth/token error detected' }
  }

  // Rate limiting
  if (code === '429' || msg.includes('rate limit') || msg.includes('too many requests')) {
    return { failure_type: 'rate_limit', is_retriable: true, requires_human: false, severity: 'medium', confidence: 0.97, reasoning: 'Rate limit response' }
  }

  // Infra failures — DB, network, 5xx
  if (code === '500' || code === '502' || code === '503' || code === '504' || msg.includes('connection refused') || msg.includes('econnrefused') || msg.includes('timeout') || msg.includes('network') || msg.includes('fetch failed')) {
    return { failure_type: 'infra_failure', is_retriable: true, requires_human: false, severity: 'high', confidence: 0.90, reasoning: 'Infrastructure/network failure' }
  }

  // Data failures — bad input, schema errors
  if (msg.includes('null') || msg.includes('undefined') || msg.includes('schema') || msg.includes('validation') || msg.includes('constraint') || msg.includes('violates')) {
    return { failure_type: 'data_failure', is_retriable: false, requires_human: false, severity: 'medium', confidence: 0.85, reasoning: 'Data validation/schema failure' }
  }

  // Model degradation
  if (msg.includes('accuracy') || msg.includes('drift') || msg.includes('degradation') || msg.includes('mae') || msg.includes('model')) {
    return { failure_type: 'model_degradation', is_retriable: false, requires_human: true, severity: 'high', confidence: 0.80, reasoning: 'Model performance degradation signal' }
  }

  // Market anomaly
  if (msg.includes('anomaly') || msg.includes('outlier') || msg.includes('spike') || msg.includes('market')) {
    return { failure_type: 'market_anomaly', is_retriable: false, requires_human: true, severity: 'medium', confidence: 0.75, reasoning: 'Market anomaly signal' }
  }

  return { failure_type: 'unknown', is_retriable: true, requires_human: false, severity: 'low', confidence: 0.50, reasoning: 'Unknown failure — defaulting to retriable' }
}

// ---------------------------------------------------------------------------
// PURE: Compute retry strategy based on failure type
// ---------------------------------------------------------------------------

export function computeRetryStrategy(
  classification: FailureClassification,
): RetryStrategy {
  if (!classification.is_retriable) {
    return { max_attempts: 0, base_delay_ms: 0, backoff_factor: 1, jitter: false, timeout_ms: 0 }
  }

  switch (classification.failure_type) {
    case 'rate_limit':
      return { max_attempts: 5, base_delay_ms: 2_000, backoff_factor: 2.0, jitter: true, timeout_ms: 120_000 }
    case 'infra_failure':
      return { max_attempts: 3, base_delay_ms: 1_000, backoff_factor: 2.5, jitter: true, timeout_ms: 30_000 }
    case 'data_failure':
      return { max_attempts: 1, base_delay_ms: 0, backoff_factor: 1, jitter: false, timeout_ms: 10_000 }
    default:
      return { max_attempts: 2, base_delay_ms: 500, backoff_factor: 1.5, jitter: true, timeout_ms: 15_000 }
  }
}

// ---------------------------------------------------------------------------
// PURE: Determine circuit state transition
// ---------------------------------------------------------------------------

export function classifyCircuitState(
  currentState:         CircuitState,
  consecutiveFailures:  number,
  consecutiveSuccesses: number,
  msSinceOpen:          number,
  config:               CircuitBreakerConfig,
): CircuitState {
  if (currentState === 'closed') {
    if (consecutiveFailures >= config.failure_threshold) return 'open'
    return 'closed'
  }
  if (currentState === 'open') {
    if (msSinceOpen >= config.half_open_timeout_ms) return 'half_open'
    return 'open'
  }
  // half_open
  if (consecutiveSuccesses >= config.success_threshold) return 'closed'
  if (consecutiveFailures >= 1) return 'open'
  return 'half_open'
}

// ---------------------------------------------------------------------------
// PURE: Should circuit break based on current error rate?
// ---------------------------------------------------------------------------

export function shouldCircuitBreak(
  consecutiveFailures: number,
  errorRateLast10:     number,     // 0-1 (errors / total in last 10 calls)
  threshold: {
    max_consecutive_failures?: number   // default 5
    max_error_rate?:            number  // default 0.5
  } = {},
): boolean {
  const maxConsec = threshold.max_consecutive_failures ?? 5
  const maxRate   = threshold.max_error_rate            ?? 0.5
  return consecutiveFailures >= maxConsec || errorRateLast10 >= maxRate
}

// ---------------------------------------------------------------------------
// PURE: Compute system stability score (0-100)
// ---------------------------------------------------------------------------

export function computeStabilityScore(
  errorRateLastHour:  number,    // 0-1
  p99LatencyMs:       number,
  degradedComponents: number,    // count
): number {
  let score = 100

  // Error rate penalty
  if (errorRateLastHour >= 0.5)       score -= 50
  else if (errorRateLastHour >= 0.2)  score -= 30
  else if (errorRateLastHour >= 0.1)  score -= 15
  else if (errorRateLastHour >= 0.05) score -= 8

  // Latency penalty
  if (p99LatencyMs >= 10_000)      score -= 25
  else if (p99LatencyMs >= 5_000)  score -= 15
  else if (p99LatencyMs >= 2_000)  score -= 8
  else if (p99LatencyMs >= 1_000)  score -= 3

  // Degraded components penalty
  score -= degradedComponents * 10

  return Math.max(0, Math.min(100, score))
}

// ---------------------------------------------------------------------------
// PURE: Build a recovery plan for a given failure
// ---------------------------------------------------------------------------

export function buildRecoveryPlan(
  classification: FailureClassification,
  component:      string,
): RecoveryPlan {
  const plans: Record<FailureType, RecoveryPlan> = {
    data_failure: {
      failure_type:         'data_failure',
      steps:                ['Log bad record', 'Skip and continue pipeline', 'Queue for manual review', 'Alert data team'],
      estimated_recovery_ms: 100,
      fallback_available:   true,
      fallback_description: 'Skip record and continue with remaining',
      requires_intervention: false,
    },
    infra_failure: {
      failure_type:         'infra_failure',
      steps:                ['Retry with exponential backoff', 'Check DB health endpoint', 'Switch to read replica if available', 'Alert ops team if persistent'],
      estimated_recovery_ms: 5_000,
      fallback_available:   true,
      fallback_description: 'Return cached/stale data if available',
      requires_intervention: false,
    },
    model_degradation: {
      failure_type:         'model_degradation',
      steps:                ['Alert ML team', 'Freeze auto-updates', 'Roll back to last stable version', 'Increase manual review queue'],
      estimated_recovery_ms: 300_000,
      fallback_available:   true,
      fallback_description: 'Revert to previous model version',
      requires_intervention: true,
    },
    market_anomaly: {
      failure_type:         'market_anomaly',
      steps:                ['Alert senior team', 'Pause automated routing', 'Log anomaly context', 'Await human review decision'],
      estimated_recovery_ms: 1_800_000,
      fallback_available:   false,
      requires_intervention: true,
    },
    rate_limit: {
      failure_type:         'rate_limit',
      steps:                ['Respect Retry-After header', 'Exponential backoff', 'Queue excess requests', 'Reduce throughput to 70%'],
      estimated_recovery_ms: 60_000,
      fallback_available:   true,
      fallback_description: 'Queue requests and process at reduced rate',
      requires_intervention: false,
    },
    auth_failure: {
      failure_type:         'auth_failure',
      steps:                ['Do NOT retry', 'Alert security team immediately', 'Rotate credentials', 'Audit recent actions'],
      estimated_recovery_ms: 0,
      fallback_available:   false,
      requires_intervention: true,
    },
    unknown: {
      failure_type:         'unknown',
      steps:                ['Log full context', 'Single retry after 1s', 'If persistent: alert ops'],
      estimated_recovery_ms: 1_000,
      fallback_available:   false,
      requires_intervention: false,
    },
  }

  const plan = { ...plans[classification.failure_type] }
  plan.steps = [`[${component}] ` + plan.steps[0], ...plan.steps.slice(1)]
  return plan
}

// ---------------------------------------------------------------------------
// PURE: Assess overall system stability
// ---------------------------------------------------------------------------

export function assessSystemStability(
  errorRateLastHour:  number,
  p99LatencyMs:       number,
  degradedComponents: string[],
): StabilityAssessment {
  const score = computeStabilityScore(errorRateLastHour, p99LatencyMs, degradedComponents.length)

  const status: StabilityAssessment['status'] =
    score >= 80 ? 'healthy'
    : score >= 50 ? 'degraded'
    : 'critical'

  const recommendations: string[] = []
  if (errorRateLastHour >= 0.1) recommendations.push(`Error rate ${(errorRateLastHour * 100).toFixed(1)}% — investigate failures`)
  if (p99LatencyMs >= 2_000)    recommendations.push(`P99 latency ${p99LatencyMs}ms — check DB indexes`)
  if (degradedComponents.length > 0) recommendations.push(`Degraded: ${degradedComponents.join(', ')} — check circuit breakers`)

  return { score, status, degraded_components: degradedComponents, recommendations }
}
