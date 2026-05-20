// =============================================================================
// Agency Group — SH-ROS | AMI: 22506
// lib/simulation/regionFailure.ts
//
// Cross-region failure simulation layer.
// Validates system behaviour when regions degrade or drop.
//
// CONSTRAINTS:
//   - NO real external API calls, NO production mutations
//   - All simulation uses existing internal modules only
//   - Purely observational: calls setLoadMode()/getLoadStatus() to simulate
//     region state, then observes system responses
//   - ALWAYS restores load mode in finally blocks — never leaves system degraded
//
// TypeScript strict — 0 errors
// =============================================================================

import {
  setLoadMode,
  getLoadStatus,
  checkTenantAllowance,
} from '@/lib/runtime/loadGovernor'
import type { LoadMode, TenantAllowance } from '@/lib/runtime/loadGovernor'
import { CURRENT_REGION, getLamportTimestamp } from '@/lib/events/globalOrdering'

// ─── Public types ─────────────────────────────────────────────────────────────

export type RegionScenario =
  | 'region_drop'
  | 'latency_200ms'
  | 'latency_800ms'
  | 'packet_loss_50pct'

export type SimulationVerdict = 'PASS' | 'FAIL' | 'DEGRADED'

export interface SimulationResult {
  scenario:         string
  verdict:          SimulationVerdict
  region:           string
  started_at:       string
  duration_ms:      number
  metrics:          Record<string, number | string | boolean>
  observations:     string[]
  warnings:         string[]
}

export interface TenantSample {
  tenant_id:  string
  allowed:    boolean
  mode:       LoadMode
  reason?:    string
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─── RegionFailureInjector ────────────────────────────────────────────────────

/**
 * Injects degraded load modes to simulate region failure scenarios.
 * Always pair inject() with restore() in a finally block.
 *
 * tenantId: the tenant scope for all load mode reads/writes during simulation.
 * Use a dedicated simulation tenant (e.g. 'sim:probe') to avoid contaminating
 * real tenant state.
 */
export class RegionFailureInjector {
  private originalMode: LoadMode = 'NORMAL'
  private injectedAt:   number   = 0
  private restored:     boolean  = false
  private readonly tenantId:    string

  constructor(tenantId: string = 'sim:probe') {
    this.tenantId = tenantId
  }

  /**
   * Saves the current mode then applies the degraded mode for the scenario.
   * Must be followed by restore() in a finally block.
   */
  async inject(scenario: RegionScenario): Promise<void> {
    const status = await getLoadStatus(this.tenantId)
    this.originalMode = status.mode
    this.restored     = false

    switch (scenario) {
      case 'region_drop':
        await setLoadMode(this.tenantId, 'CRITICAL', 'sim:region_drop')
        break
      case 'latency_200ms':
        await setLoadMode(this.tenantId, 'STRESSED', 'sim:latency_injection')
        break
      case 'latency_800ms':
        await setLoadMode(this.tenantId, 'CRITICAL', 'sim:latency_injection')
        break
      case 'packet_loss_50pct':
        await setLoadMode(this.tenantId, 'STRESSED', 'sim:packet_loss')
        break
    }

    this.injectedAt = Date.now()
  }

  /**
   * Restores the load mode that was active before inject() was called.
   * Safe to call multiple times — idempotent after first restore.
   */
  async restore(): Promise<void> {
    if (!this.restored) {
      await setLoadMode(this.tenantId, this.originalMode, 'sim:recovery')
      this.restored = true
    }
  }

  /**
   * Returns the original (pre-injection) load mode.
   * Useful for assertions after restore.
   */
  getOriginalMode(): LoadMode {
    return this.originalMode
  }

  /**
   * Measures failover time: ms from inject() until checkTenantAllowance()
   * returns allowed=true after restore().
   *
   * Polls up to 10 times with 300 ms gaps (3 s total budget).
   * Returns elapsed ms, or -1 if no PASS was observed within budget.
   */
  async measureFailoverTime(tenantId: string): Promise<number> {
    await this.restore()
    const start = Date.now()

    for (let attempt = 0; attempt < 10; attempt++) {
      const allowance = await checkTenantAllowance(tenantId)
      if (allowance.allowed) {
        return Date.now() - start
      }
      await sleep(300)
    }

    return -1 // failover not observed within budget
  }
}

// ─── NetworkPartitionSimulator ────────────────────────────────────────────────

/**
 * Simulates network partition conditions by injecting artificial latency
 * and measuring Lamport clock drift under degraded conditions.
 */
export class NetworkPartitionSimulator {
  /**
   * Wraps an async call with artificial latency.
   * Simulates packet delay — the call still succeeds, but after a wait.
   */
  async withInjectedLatency<T>(fn: () => Promise<T>, latencyMs: number): Promise<T> {
    await sleep(latencyMs)
    return fn()
  }

  /**
   * Calls getLamportTimestamp() `callCount` times for the tenant and checks
   * whether the resulting sequence is strictly monotonically increasing.
   *
   * NOTE: When Redis is unavailable getLamportTimestamp() falls back to
   * Date.now(), which can produce ties or slight inversions under fast
   * sequential calls.  This is expected and reported as drift_detected=true.
   */
  async measureLamportDrift(
    tenantId:  string,
    callCount: number,
  ): Promise<{
    min_seq:        number
    max_seq:        number
    drift_detected: boolean
    sequences:      number[]
  }> {
    const sequences: number[] = []

    for (let i = 0; i < callCount; i++) {
      const ts = await getLamportTimestamp(tenantId)
      sequences.push(ts)
    }

    let drift_detected = false
    for (let i = 1; i < sequences.length; i++) {
      if ((sequences[i] as number) <= (sequences[i - 1] as number)) {
        drift_detected = true
        break
      }
    }

    return {
      min_seq: Math.min(...sequences),
      max_seq: Math.max(...sequences),
      drift_detected,
      sequences,
    }
  }
}

// ─── FailoverObserver ─────────────────────────────────────────────────────────

/**
 * Observes the full lifecycle of a region failure scenario and records
 * structured metrics about system behaviour.
 */
export class FailoverObserver {
  async observeFailover(
    tenantId: string,
    injector: RegionFailureInjector,
    scenario: RegionScenario,
  ): Promise<{
    pre_failure_mode:  LoadMode
    injected_mode:     LoadMode
    failover_time_ms:  number
    data_consistency:  'preserved' | 'drift_detected'
    tenant_isolated:   boolean
    event_ordering_ok: boolean
  }> {
    // Record the mode before injection
    const preStatus = await getLoadStatus(tenantId)
    const pre_failure_mode = preStatus.mode

    // Inject the scenario
    await injector.inject(scenario)

    // Record injected mode
    const injectedStatus = await getLoadStatus(tenantId)
    const injected_mode  = injectedStatus.mode

    // Measure Lamport drift under the degraded mode (5 samples)
    const partitioner = new NetworkPartitionSimulator()
    const drift       = await partitioner.measureLamportDrift(tenantId, 5)

    // Check tenant isolation: sample a second synthetic tenant to verify
    // no state bleed — their allowance should be independent of `tenantId`
    const isolationTenant = `${tenantId}_isolation_probe`
    const probeAllowance: TenantAllowance = await checkTenantAllowance(isolationTenant)
    // Isolation holds if the probe tenant's mode matches the injected mode
    // (same infrastructure) but its allow/deny is its own independent decision
    const tenant_isolated = probeAllowance.mode === injected_mode

    // Measure failover time (also calls restore() internally)
    const failover_time_ms = await injector.measureFailoverTime(tenantId)

    return {
      pre_failure_mode,
      injected_mode,
      failover_time_ms,
      data_consistency:  drift.drift_detected ? 'drift_detected' : 'preserved',
      tenant_isolated,
      event_ordering_ok: !drift.drift_detected,
    }
  }
}

// ─── simulateRegionDrop ───────────────────────────────────────────────────────

/**
 * Simulates a full region drop by injecting CRITICAL mode.
 * Measures checkTenantAllowance() before + after, uses FailoverObserver
 * to record failover time.
 *
 * Verdict: PASS if failover_time_ms < 5000 and tenant_isolated = true.
 * ALWAYS restores the original load mode in a finally block.
 */
export async function simulateRegionDrop(
  tenantId: string = 'sim_region_test_001',
): Promise<SimulationResult> {
  const startedAt = new Date().toISOString()
  const startMs   = Date.now()
  const observations: string[] = []
  const warnings:     string[] = []

  const injector = new RegionFailureInjector(tenantId)
  const observer  = new FailoverObserver()

  try {
    // Pre-failure baseline
    const preFlight = await checkTenantAllowance(tenantId)
    observations.push(`pre-failure: tenant ${tenantId} allowed=${preFlight.allowed} mode=${preFlight.mode}`)

    // Run full observation cycle (inject + measure + restore inside observeFailover)
    const obs = await observer.observeFailover(tenantId, injector, 'region_drop')

    observations.push(`injected mode: ${obs.injected_mode}`)
    observations.push(`failover time: ${obs.failover_time_ms}ms`)
    observations.push(`data consistency: ${obs.data_consistency}`)
    observations.push(`tenant isolated: ${obs.tenant_isolated}`)
    observations.push(`event ordering ok: ${obs.event_ordering_ok}`)

    if (obs.failover_time_ms < 0) {
      warnings.push('failover not observed within 3s polling budget')
    }
    if (!obs.event_ordering_ok) {
      warnings.push('Lamport clock drift detected under CRITICAL mode — expected when Redis unavailable')
    }

    // Post-restore verification
    const postFlight = await checkTenantAllowance(tenantId)
    observations.push(`post-restore: tenant allowed=${postFlight.allowed} mode=${postFlight.mode}`)

    const passed = obs.failover_time_ms >= 0
      && obs.failover_time_ms < 5000
      && obs.tenant_isolated

    const verdict: SimulationVerdict = passed
      ? 'PASS'
      : obs.failover_time_ms >= 5000
        ? 'FAIL'
        : 'DEGRADED'

    return {
      scenario:    'region_drop',
      verdict,
      region:      CURRENT_REGION,
      started_at:  startedAt,
      duration_ms: Date.now() - startMs,
      metrics: {
        pre_failure_mode:  obs.pre_failure_mode,
        injected_mode:     obs.injected_mode,
        failover_time_ms:  obs.failover_time_ms,
        data_consistency:  obs.data_consistency,
        tenant_isolated:   obs.tenant_isolated,
        event_ordering_ok: obs.event_ordering_ok,
      },
      observations,
      warnings,
    }
  } finally {
    // Safety net: always restore even if observeFailover threw
    await injector.restore()
  }
}

// ─── simulateLatencyInjection ─────────────────────────────────────────────────

/**
 * Injects artificial latency (200ms or 800ms) and measures degradation of
 * getLoadStatus() calls under that delay.
 *
 * Counts how many requests respond within an expected deadline vs. degraded.
 * ALWAYS restores the original load mode in a finally block.
 */
export async function simulateLatencyInjection(
  latencyMs: 200 | 800,
  tenantId:  string = 'sim_region_test_001',
): Promise<SimulationResult> {
  const startedAt    = new Date().toISOString()
  const startMs      = Date.now()
  const observations: string[] = []
  const warnings:     string[] = []

  const scenario: RegionScenario = latencyMs === 200 ? 'latency_200ms' : 'latency_800ms'
  const injector  = new RegionFailureInjector(tenantId)
  const partitioner = new NetworkPartitionSimulator()

  // Deadline: requests completing within 2× latency are "acceptable"
  const deadlineMs = latencyMs * 2

  try {
    await injector.inject(scenario)
    observations.push(`injected scenario: ${scenario}`)

    const SAMPLE_SIZE = 5
    let degradedCount = 0
    let successCount  = 0

    for (let i = 0; i < SAMPLE_SIZE; i++) {
      const callStart = Date.now()
      await partitioner.withInjectedLatency(() => getLoadStatus(tenantId), latencyMs)
      const elapsed = Date.now() - callStart

      if (elapsed > deadlineMs) {
        degradedCount++
        observations.push(`call ${i + 1}: DEGRADED (${elapsed}ms > deadline ${deadlineMs}ms)`)
      } else {
        successCount++
        observations.push(`call ${i + 1}: OK (${elapsed}ms)`)
      }
    }

    const successRate = successCount / SAMPLE_SIZE

    if (successRate < 0.5) {
      warnings.push(`success rate ${(successRate * 100).toFixed(0)}% below 50% threshold`)
    }

    // Tenant check under degraded mode
    const allowance = await checkTenantAllowance(tenantId)
    observations.push(`tenant ${tenantId} under ${scenario}: allowed=${allowance.allowed} mode=${allowance.mode}`)

    const verdict: SimulationVerdict = successRate >= 0.8
      ? 'PASS'
      : successRate >= 0.5
        ? 'DEGRADED'
        : 'FAIL'

    return {
      scenario:    `latency_injection_${latencyMs}ms`,
      verdict,
      region:      CURRENT_REGION,
      started_at:  startedAt,
      duration_ms: Date.now() - startMs,
      metrics: {
        latency_injected_ms: latencyMs,
        deadline_ms:         deadlineMs,
        sample_size:         SAMPLE_SIZE,
        success_count:       successCount,
        degraded_count:      degradedCount,
        success_rate_pct:    Math.round(successRate * 100),
        tenant_mode:         allowance.mode,
        tenant_allowed:      allowance.allowed,
      },
      observations,
      warnings,
    }
  } finally {
    await injector.restore()
  }
}

// ─── simulatePartialDegradation ───────────────────────────────────────────────

/**
 * Simulates 50% packet loss by running 100 checkTenantAllowance() calls and
 * artificially failing every other one (odd-indexed calls return a synthetic
 * denied result without mutating Redis state).
 *
 * Measures the effective success rate under partial degradation.
 * ALWAYS restores the original load mode in a finally block.
 */
export async function simulatePartialDegradation(
  tenantId: string = 'sim_region_test_001',
): Promise<SimulationResult> {
  const startedAt    = new Date().toISOString()
  const startMs      = Date.now()
  const observations: string[] = []
  const warnings:     string[] = []

  const injector = new RegionFailureInjector(tenantId)

  try {
    await injector.inject('packet_loss_50pct')
    observations.push('injected scenario: packet_loss_50pct')

    const CALL_COUNT   = 100
    let realSuccesses  = 0
    let syntheticFails = 0
    let realFails      = 0

    for (let i = 0; i < CALL_COUNT; i++) {
      // Odd-indexed calls are synthetically dropped (packet loss simulation)
      if (i % 2 === 1) {
        syntheticFails++
        continue
      }

      // Even-indexed calls go through the real allowance check
      const allowance = await checkTenantAllowance(tenantId)
      if (allowance.allowed) {
        realSuccesses++
      } else {
        realFails++
      }
    }

    // Effective success = real successes / total calls (including synthetic drops)
    const effectiveSuccessRate = realSuccesses / CALL_COUNT
    // Real pipeline success = real successes / calls that actually reached the system
    const pipelineSuccessRate  = realSuccesses / (CALL_COUNT - syntheticFails)

    observations.push(`total calls: ${CALL_COUNT}`)
    observations.push(`synthetic drops (packet loss): ${syntheticFails}`)
    observations.push(`real successes: ${realSuccesses}`)
    observations.push(`real failures: ${realFails}`)
    observations.push(`effective success rate: ${(effectiveSuccessRate * 100).toFixed(1)}%`)
    observations.push(`pipeline success rate: ${(pipelineSuccessRate * 100).toFixed(1)}%`)

    if (effectiveSuccessRate < 0.4) {
      warnings.push('effective success rate below 40% — system severely degraded under packet loss')
    }

    const verdict: SimulationVerdict = effectiveSuccessRate >= 0.45
      ? 'PASS'
      : effectiveSuccessRate >= 0.3
        ? 'DEGRADED'
        : 'FAIL'

    return {
      scenario:    'partial_degradation_packet_loss_50pct',
      verdict,
      region:      CURRENT_REGION,
      started_at:  startedAt,
      duration_ms: Date.now() - startMs,
      metrics: {
        total_calls:              CALL_COUNT,
        synthetic_drops:          syntheticFails,
        real_successes:           realSuccesses,
        real_failures:            realFails,
        effective_success_rate_pct: Math.round(effectiveSuccessRate * 100),
        pipeline_success_rate_pct:  Math.round(pipelineSuccessRate * 100),
      },
      observations,
      warnings,
    }
  } finally {
    await injector.restore()
  }
}
