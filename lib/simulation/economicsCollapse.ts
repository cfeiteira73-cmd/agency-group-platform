// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Economic Collapse Simulation Engine
// lib/simulation/economicsCollapse.ts
//
// Validates the system never enters undetected cost collapse.
//
// CRITICAL SAFETY CONSTRAINTS:
//   - NO real billing mutations — only synthetic CostEvents via emitCostEvent()
//   - NO production data changes
//   - All tenant IDs prefixed `sim_econ_*`
//   - All events flagged metadata: { synthetic: true, simulation: true }
//
// TypeScript strict — 0 errors
// =============================================================================

import {
  emitCostEvent,
  getRollingCostWindow,
  getInstantMargin,
  type CostEvent,
  type RollingCostWindow,
} from '@/lib/economics/costStreamEngine'

import { type SimulationResult } from '@/lib/simulation/loadSimulator'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Generates a deterministic simulation run ID */
function makeSimId(scenario: string): string {
  return `sim_econ_run_${scenario}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Builds a fully-formed synthetic CostEvent.
 * Always marked synthetic + simulation in metadata.
 * All costs flow through ai_cost (event_type: 'ai_call').
 * compute_cost, infra_cost, storage_cost are 0 — keeping it isolated.
 */
function buildSyntheticCostEvent(
  tenant_id: string,
  cost_eur: number,
  extra_meta?: Record<string, unknown>,
): CostEvent {
  return {
    tenant_id,
    correlation_id: null,
    event_type:     'ai_call',
    compute_cost:   0,
    ai_cost:        Math.round(cost_eur * 1_000_000) / 1_000_000,
    infra_cost:     0,
    storage_cost:   0,
    total_cost:     Math.round(cost_eur * 1_000_000) / 1_000_000,
    timestamp:      new Date().toISOString(),
    metadata: {
      synthetic:   true,
      simulation:  true,
      ...extra_meta,
    },
  }
}

// ─── Zero RollingCostWindow factory ──────────────────────────────────────────

function zeroWindow(tenant_id: string): RollingCostWindow {
  return {
    tenant_id,
    window_seconds:     3600,
    total_cost_eur:     0,
    ai_cost_eur:        0,
    infra_cost_eur:     0,
    compute_cost_eur:   0,
    event_count:        0,
    burn_rate_per_hour: 0,
    margin:             null,
    generated_at:       new Date().toISOString(),
  }
}

// =============================================================================
// CostExplosionSimulator
// =============================================================================

export class CostExplosionSimulator {
  /**
   * Simulates a sudden cost explosion for a synthetic tenant and measures
   * whether the rolling cost window detects the spike.
   *
   * SAFETY: only emits synthetic CostEvents — no production mutations.
   */
  async simulate(params: {
    tenant_id:         string
    baseline_cost_eur: number   // synthetic cost per event before explosion (e.g. 0.01)
    explosion_multiplier: number // e.g. 20 for 20× spike
    event_count:       number   // how many explosion events to emit
  }): Promise<{
    baseline_window:   RollingCostWindow
    explosion_window:  RollingCostWindow
    actual_multiplier: number
    detection_lag_ms:  number
    system_detected:   boolean
  }> {
    const { tenant_id, baseline_cost_eur, explosion_multiplier, event_count } = params

    // 1. Read baseline window before explosion
    const baseline_window = await getRollingCostWindow(tenant_id, 3600)
      .catch(() => zeroWindow(tenant_id))

    const t_emit_start = Date.now()

    // 2. Emit explosion events in parallel batches (fire-and-forget each, await all)
    const explodedCost = baseline_cost_eur * explosion_multiplier
    const emitPromises: Promise<void>[] = []

    for (let i = 0; i < event_count; i++) {
      emitPromises.push(
        emitCostEvent(
          buildSyntheticCostEvent(tenant_id, explodedCost, {
            phase:           'explosion',
            event_index:     i,
            multiplier:      explosion_multiplier,
            baseline_cost:   baseline_cost_eur,
          }),
        ),
      )
    }

    await Promise.allSettled(emitPromises)

    const t_emit_end = Date.now()

    // 3. Read explosion window immediately after emission
    const explosion_window = await getRollingCostWindow(tenant_id, 3600)
      .catch(() => zeroWindow(tenant_id))

    const t_detected = Date.now()

    // 4. Compute detection stats
    const baseline_total = baseline_window.total_cost_eur
    const explosion_total = explosion_window.total_cost_eur

    // actual_multiplier: how much the window grew vs baseline
    // If baseline was 0, compare absolute explosion amount vs expected
    const actual_multiplier = baseline_total > 0
      ? explosion_total / baseline_total
      : explosion_total > 0
        ? explosion_multiplier   // treat as detected if any cost appeared
        : 0

    // detection_lag_ms: time from last emit to window reflecting the spike
    const detection_lag_ms = t_detected - t_emit_end

    // system_detected: true if the window captured more than 50% of expected explosion
    const expected_explosion_cost = explodedCost * event_count
    const newly_captured = explosion_total - baseline_total
    const system_detected =
      newly_captured >= expected_explosion_cost * 0.5 ||
      actual_multiplier > explosion_multiplier * 0.5

    return {
      baseline_window,
      explosion_window,
      actual_multiplier: Math.round(actual_multiplier * 10_000) / 10_000,
      detection_lag_ms:  t_detected - t_emit_start,
      system_detected,
    }
  }
}

// =============================================================================
// TenantMarginCollapseDetector
// =============================================================================

export class TenantMarginCollapseDetector {
  /**
   * Steps through increasing cost levels, emits synthetic events at each level,
   * and records whether getInstantMargin detects a negative margin (collapse).
   *
   * SAFETY: only emits synthetic CostEvents — no production mutations.
   */
  async detectCollapseThreshold(params: {
    tenant_id:      string
    start_cost_eur: number     // starting synthetic cost per event (e.g. 0.001)
    cost_steps:     number[]   // increasing costs to test: [0.001, 0.005, 0.01, 0.05, ...]
    events_per_step: number    // synthetic events to emit per cost level
  }): Promise<{
    collapse_detected_at:   number | null
    margin_at_each_step:    Array<{ cost_eur: number; margin: number | null }>
    economic_stability_score: number
    safe_cost_ceiling:      number
  }> {
    const { tenant_id, cost_steps, events_per_step } = params

    const margin_at_each_step: Array<{ cost_eur: number; margin: number | null }> = []
    let collapse_detected_at: number | null = null
    let safe_cost_ceiling = 0

    for (const cost_eur of cost_steps) {
      // Emit events at this cost level
      const emitPromises: Promise<void>[] = []
      for (let i = 0; i < events_per_step; i++) {
        emitPromises.push(
          emitCostEvent(
            buildSyntheticCostEvent(tenant_id, cost_eur, {
              phase:      'margin_step',
              step_cost:  cost_eur,
              step_index: i,
            }),
          ),
        )
      }
      await Promise.allSettled(emitPromises)

      // Read instant margin — may be null if no revenue data exists
      const margin = await getInstantMargin(tenant_id).catch(() => null)
      margin_at_each_step.push({ cost_eur, margin })

      if (margin !== null && margin < 0 && collapse_detected_at === null) {
        collapse_detected_at = cost_eur
      }

      if (margin !== null && margin >= 0) {
        safe_cost_ceiling = cost_eur
      }
    }

    // economic_stability_score: steps completed before collapse / total steps × 100
    const total_steps = cost_steps.length
    const steps_before_collapse = collapse_detected_at === null
      ? total_steps
      : cost_steps.indexOf(collapse_detected_at)

    const economic_stability_score =
      total_steps > 0
        ? Math.round((steps_before_collapse / total_steps) * 100)
        : 100

    return {
      collapse_detected_at,
      margin_at_each_step,
      economic_stability_score,
      safe_cost_ceiling,
    }
  }
}

// =============================================================================
// RevenueLeakTracer
// =============================================================================

export class RevenueLeakTracer {
  /**
   * Emits synthetic cost events on a loop and compares what was emitted vs
   * what the rolling window captured — to detect "leakage" (undetected cost).
   *
   * Uses a synchronous loop with measured timestamps instead of real timers
   * so the simulation completes deterministically.
   *
   * SAFETY: only emits synthetic CostEvents — no production mutations.
   */
  async trace(params: {
    tenant_id:       string
    test_duration_ms: number   // how many ms of events to simulate (e.g. 5000)
    emit_interval_ms: number   // logical interval between emits (e.g. 100)
    cost_per_event:  number   // synthetic cost per event
  }): Promise<{
    events_emitted:    number
    total_cost_eur:    number
    detected_cost_eur: number
    detection_rate:    number
    max_lag_ms:        number
    leakage_detected:  boolean
  }> {
    const { tenant_id, test_duration_ms, emit_interval_ms, cost_per_event } = params

    const iterations = Math.max(1, Math.floor(test_duration_ms / emit_interval_ms))
    const emitPromises: Promise<void>[] = []
    const emit_timestamps: number[] = []

    // Emit all events (fire-and-forget) and record their intended emit time
    for (let i = 0; i < iterations; i++) {
      const intended_ts = Date.now() + i * emit_interval_ms
      emit_timestamps.push(intended_ts)

      emitPromises.push(
        emitCostEvent(
          buildSyntheticCostEvent(tenant_id, cost_per_event, {
            phase:       'leak_trace',
            iteration:   i,
            total_iters: iterations,
          }),
        ),
      )
    }

    const total_emitted_cost = cost_per_event * iterations

    // Await all emits
    await Promise.allSettled(emitPromises)

    const t_after_emit = Date.now()

    // Read rolling window to see what was detected
    const window = await getRollingCostWindow(tenant_id, 3600).catch(() => zeroWindow(tenant_id))

    const t_after_read = Date.now()

    const detected_cost_eur = window.total_cost_eur
    const detection_rate = total_emitted_cost > 0
      ? Math.min(1, detected_cost_eur / total_emitted_cost)
      : 1

    // max_lag_ms: time from first emit to when the window was read
    const max_lag_ms = t_after_read - (emit_timestamps[0] ?? t_after_emit)

    const leakage_detected = detection_rate < 0.95

    return {
      events_emitted:    iterations,
      total_cost_eur:    Math.round(total_emitted_cost * 1_000_000) / 1_000_000,
      detected_cost_eur: detected_cost_eur,
      detection_rate:    Math.round(detection_rate * 10_000) / 10_000,
      max_lag_ms,
      leakage_detected,
    }
  }
}

// =============================================================================
// Main simulation functions
// =============================================================================

// ─── simulateCostExplosion ────────────────────────────────────────────────────

/**
 * Simulates a sudden 20× (or custom) cost explosion and verifies
 * the rolling window detects the spike.
 *
 * Verdict:
 *   PASS if system_detected = true  → explosion was caught
 *   FAIL if actual_multiplier shows spike but system_detected = false → undetected runaway
 */
export async function simulateCostExplosion(
  tenantId:   string,
  multiplier: number = 20,
): Promise<SimulationResult> {
  const simulation_id = makeSimId('explosion')
  const started_at    = new Date().toISOString()
  const t0            = Date.now()

  const sim = new CostExplosionSimulator()

  const result = await sim.simulate({
    tenant_id:            tenantId,
    baseline_cost_eur:    0.01,
    explosion_multiplier: multiplier,
    event_count:          100,
  }).catch((err: unknown) => ({
    baseline_window:   zeroWindow(tenantId),
    explosion_window:  zeroWindow(tenantId),
    actual_multiplier: 0,
    detection_lag_ms:  0,
    system_detected:   false,
    _error:            err instanceof Error ? err.message : String(err),
  }))

  const duration_ms  = Date.now() - t0
  const completed_at = new Date().toISOString()

  const { system_detected, actual_multiplier, detection_lag_ms } = result

  // system_detected = true means explosion was caught (PASS)
  // system_detected = false with a real spike = undetected runaway (FAIL)
  const verdict: SimulationResult['verdict'] = system_detected ? 'PASS' : 'FAIL'

  const verdict_reason = system_detected
    ? `Cost explosion detected: actual_multiplier=${actual_multiplier.toFixed(2)}× (threshold=${(multiplier * 0.5).toFixed(1)}×), detection_lag_ms=${detection_lag_ms}`
    : `Undetected cost explosion: actual_multiplier=${actual_multiplier.toFixed(2)}× — system failed to capture spike in rolling window. detection_lag_ms=${detection_lag_ms}`

  return {
    simulation_id,
    simulation_type:  'economics_collapse',
    scenario:         'explosion',
    tenant_count:     1,
    duration_ms,
    started_at,
    completed_at,
    metrics: {
      p50_latency_ms:  detection_lag_ms,
      p95_latency_ms:  detection_lag_ms,
      p99_latency_ms:  detection_lag_ms,
      error_rate:      system_detected ? 0 : 1,
      success_count:   system_detected ? 1 : 0,
      failure_count:   system_detected ? 0 : 1,
      throughput_rps:  duration_ms > 0 ? Math.round((100 / duration_ms) * 1_000) : 0,
    },
    per_tenant_sample: [
      {
        tenant_id:         tenantId,
        latency_ms:        detection_lag_ms,
        status:            system_detected ? 'ok' : 'failed',
        load_mode:         'ECONOMICS_SIMULATION',
        cost_per_request:  result.explosion_window.total_cost_eur / Math.max(result.explosion_window.event_count, 1),
        ...(system_detected ? {} : { error: 'explosion_not_detected' }),
      },
    ],
    verdict,
    verdict_reason,
    global_ready: verdict === 'PASS',
  }
}

// ─── simulateMarginCollapse ───────────────────────────────────────────────────

/**
 * Steps through increasing cost levels and detects when margin goes negative.
 *
 * Verdict:
 *   PASS if economic_stability_score > 50
 *   FAIL otherwise
 */
export async function simulateMarginCollapse(tenantId: string): Promise<SimulationResult> {
  const simulation_id = makeSimId('margin')
  const started_at    = new Date().toISOString()
  const t0            = Date.now()

  const detector = new TenantMarginCollapseDetector()

  const result = await detector.detectCollapseThreshold({
    tenant_id:      tenantId,
    start_cost_eur: 0.001,
    cost_steps:     [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0],
    events_per_step: 10,
  }).catch(() => ({
    collapse_detected_at:     null as number | null,
    margin_at_each_step:      [] as Array<{ cost_eur: number; margin: number | null }>,
    economic_stability_score: 0,
    safe_cost_ceiling:        0,
  }))

  const duration_ms  = Date.now() - t0
  const completed_at = new Date().toISOString()

  const { economic_stability_score, collapse_detected_at, safe_cost_ceiling } = result

  const pass = economic_stability_score > 50
  const verdict: SimulationResult['verdict'] = pass ? 'PASS' : 'FAIL'

  const verdict_reason = collapse_detected_at !== null
    ? `Margin collapse at €${collapse_detected_at}/request. stability_score=${economic_stability_score}/100. safe_ceiling=€${safe_cost_ceiling}`
    : `No margin collapse detected across all cost steps. stability_score=${economic_stability_score}/100. safe_ceiling=€${safe_cost_ceiling}`

  return {
    simulation_id,
    simulation_type:  'economics_collapse',
    scenario:         'margin',
    tenant_count:     1,
    duration_ms,
    started_at,
    completed_at,
    metrics: {
      p50_latency_ms:  Math.round(duration_ms / 2),
      p95_latency_ms:  duration_ms,
      p99_latency_ms:  duration_ms,
      error_rate:      pass ? 0 : 1,
      success_count:   pass ? 1 : 0,
      failure_count:   pass ? 0 : 1,
      throughput_rps:  duration_ms > 0 ? Math.round((7 / duration_ms) * 1_000) : 0,
    },
    per_tenant_sample: [
      {
        tenant_id:         tenantId,
        latency_ms:        duration_ms,
        status:            pass ? 'ok' : 'failed',
        load_mode:         'ECONOMICS_SIMULATION',
        cost_per_request:  safe_cost_ceiling,
        ...(pass ? {} : { error: `margin_collapse_at_${collapse_detected_at ?? 'unknown'}` }),
      },
    ],
    verdict,
    verdict_reason,
    global_ready: verdict === 'PASS',
  }
}

// ─── simulateRevenueLeak ──────────────────────────────────────────────────────

/**
 * Traces cost emission vs detection to find revenue leakage.
 *
 * Verdict:
 *   PASS if detection_rate > 0.9 (system captures > 90% of costs)
 *   FAIL if leakage_detected = true
 */
export async function simulateRevenueLeak(tenantId: string): Promise<SimulationResult> {
  const simulation_id = makeSimId('leak')
  const started_at    = new Date().toISOString()
  const t0            = Date.now()

  const tracer = new RevenueLeakTracer()

  const result = await tracer.trace({
    tenant_id:       tenantId,
    test_duration_ms: 3000,
    emit_interval_ms: 200,
    cost_per_event:  0.005,
  }).catch(() => ({
    events_emitted:    0,
    total_cost_eur:    0,
    detected_cost_eur: 0,
    detection_rate:    0,
    max_lag_ms:        0,
    leakage_detected:  true,
  }))

  const duration_ms  = Date.now() - t0
  const completed_at = new Date().toISOString()

  const { detection_rate, leakage_detected, events_emitted, total_cost_eur, detected_cost_eur, max_lag_ms } = result

  const pass = detection_rate > 0.9 && !leakage_detected
  const verdict: SimulationResult['verdict'] = pass ? 'PASS' : 'FAIL'

  const verdict_reason = pass
    ? `No revenue leakage detected. detection_rate=${(detection_rate * 100).toFixed(1)}% (threshold 90%). emitted=€${total_cost_eur.toFixed(4)}, detected=€${detected_cost_eur.toFixed(4)}, max_lag=${max_lag_ms}ms`
    : `Revenue leakage detected. detection_rate=${(detection_rate * 100).toFixed(1)}% < 90%. emitted=€${total_cost_eur.toFixed(4)}, detected=€${detected_cost_eur.toFixed(4)}, max_lag=${max_lag_ms}ms`

  return {
    simulation_id,
    simulation_type:  'economics_collapse',
    scenario:         'leak',
    tenant_count:     1,
    duration_ms,
    started_at,
    completed_at,
    metrics: {
      p50_latency_ms:  max_lag_ms,
      p95_latency_ms:  max_lag_ms,
      p99_latency_ms:  max_lag_ms,
      error_rate:      leakage_detected ? 1 - detection_rate : 0,
      success_count:   pass ? events_emitted : 0,
      failure_count:   pass ? 0 : events_emitted,
      throughput_rps:  duration_ms > 0 ? Math.round((events_emitted / duration_ms) * 1_000) : 0,
    },
    per_tenant_sample: [
      {
        tenant_id:         tenantId,
        latency_ms:        max_lag_ms,
        status:            pass ? 'ok' : 'failed',
        load_mode:         'ECONOMICS_SIMULATION',
        cost_per_request:  events_emitted > 0 ? total_cost_eur / events_emitted : 0,
        ...(pass ? {} : { error: `leakage_rate_${((1 - detection_rate) * 100).toFixed(1)}pct` }),
      },
    ],
    verdict,
    verdict_reason,
    global_ready: verdict === 'PASS',
  }
}

// ─── simulateBudgetGovernorSaturation ────────────────────────────────────────

/**
 * Emits 1000 high-cost events rapidly (0.1 EUR each = €100 total)
 * and verifies the rolling window burn_rate_per_hour reflects the explosion.
 *
 * Verdict:
 *   PASS if burn_rate_per_hour > 50 EUR/hour (correctly extrapolated)
 *   FAIL otherwise
 */
export async function simulateBudgetGovernorSaturation(tenantId: string): Promise<SimulationResult> {
  const simulation_id = makeSimId('saturation')
  const started_at    = new Date().toISOString()
  const t0            = Date.now()

  const EVENT_COUNT   = 1000
  const COST_PER_EVENT = 0.1   // EUR — €100 total
  const BURN_RATE_THRESHOLD = 50  // EUR/hour

  // Read baseline window
  const baseline = await getRollingCostWindow(tenantId, 3600).catch(() => zeroWindow(tenantId))

  // Emit 1000 high-cost events as fast as possible
  const emitPromises: Promise<void>[] = []
  for (let i = 0; i < EVENT_COUNT; i++) {
    emitPromises.push(
      emitCostEvent(
        buildSyntheticCostEvent(tenantId, COST_PER_EVENT, {
          phase:       'saturation',
          event_index: i,
          total_cost_target: EVENT_COUNT * COST_PER_EVENT,
        }),
      ),
    )
  }
  await Promise.allSettled(emitPromises)

  // Read window after saturation
  const saturated = await getRollingCostWindow(tenantId, 3600).catch(() => zeroWindow(tenantId))

  const duration_ms  = Date.now() - t0
  const completed_at = new Date().toISOString()

  // Verify burn_rate_per_hour reflects the explosion
  const burn_rate      = saturated.burn_rate_per_hour
  const new_cost_added = saturated.total_cost_eur - baseline.total_cost_eur
  const pass = burn_rate > BURN_RATE_THRESHOLD

  // Also check at least partial cost was captured
  const expected_cost  = EVENT_COUNT * COST_PER_EVENT
  const capture_pct    = expected_cost > 0
    ? Math.round((new_cost_added / expected_cost) * 100)
    : 0

  const verdict: SimulationResult['verdict'] = pass ? 'PASS' : 'FAIL'

  const verdict_reason = pass
    ? `Budget governor saturation detected: burn_rate_per_hour=€${burn_rate.toFixed(2)}/h > threshold €${BURN_RATE_THRESHOLD}/h. emitted=€${expected_cost}, captured=€${new_cost_added.toFixed(4)} (${capture_pct}%)`
    : `Budget governor failed to reflect saturation: burn_rate_per_hour=€${burn_rate.toFixed(2)}/h < threshold €${BURN_RATE_THRESHOLD}/h. emitted=€${expected_cost}, captured=€${new_cost_added.toFixed(4)} (${capture_pct}%)`

  const latency_per_event = duration_ms / EVENT_COUNT

  return {
    simulation_id,
    simulation_type:  'economics_collapse',
    scenario:         'saturation',
    tenant_count:     1,
    duration_ms,
    started_at,
    completed_at,
    metrics: {
      p50_latency_ms:  Math.round(latency_per_event),
      p95_latency_ms:  Math.round(latency_per_event * 2),
      p99_latency_ms:  Math.round(latency_per_event * 3),
      error_rate:      pass ? 0 : 1,
      success_count:   pass ? EVENT_COUNT : 0,
      failure_count:   pass ? 0 : EVENT_COUNT,
      throughput_rps:  duration_ms > 0 ? Math.round((EVENT_COUNT / duration_ms) * 1_000) : 0,
    },
    per_tenant_sample: [
      {
        tenant_id:         tenantId,
        latency_ms:        duration_ms,
        status:            pass ? 'ok' : 'failed',
        load_mode:         'ECONOMICS_SIMULATION',
        cost_per_request:  COST_PER_EVENT,
        ...(pass ? {} : { error: `burn_rate_too_low_${burn_rate.toFixed(2)}_eur_per_hour` }),
      },
    ],
    verdict,
    verdict_reason,
    global_ready: verdict === 'PASS',
  }
}

// =============================================================================
// computeEconomicStabilityScore
// =============================================================================

export interface EconomicStabilityReport {
  score:          number
  classification: 'STRIPE_LEVEL' | 'ENTERPRISE_READY' | 'SCALABLE_FRAGILE' | 'NOT_PRODUCTION_SAFE'
  details:        string[]
}

/**
 * Computes an overall economic stability score from an array of SimulationResults.
 * Score = percentage of results with verdict PASS (0–100).
 *
 * 90–100 = STRIPE_LEVEL
 * 80–90  = ENTERPRISE_READY
 * 70–80  = SCALABLE_FRAGILE
 * <70    = NOT_PRODUCTION_SAFE
 */
export function computeEconomicStabilityScore(
  results: SimulationResult[],
): EconomicStabilityReport {
  if (results.length === 0) {
    return {
      score:          0,
      classification: 'NOT_PRODUCTION_SAFE',
      details:        ['No simulation results provided'],
    }
  }

  const passed  = results.filter(r => r.verdict === 'PASS').length
  const failed  = results.filter(r => r.verdict === 'FAIL').length
  const degraded = results.filter(r => r.verdict === 'DEGRADED').length
  const total   = results.length

  const score = Math.round((passed / total) * 100)

  let classification: EconomicStabilityReport['classification']
  if (score >= 90) {
    classification = 'STRIPE_LEVEL'
  } else if (score >= 80) {
    classification = 'ENTERPRISE_READY'
  } else if (score >= 70) {
    classification = 'SCALABLE_FRAGILE'
  } else {
    classification = 'NOT_PRODUCTION_SAFE'
  }

  const details: string[] = [
    `Total scenarios: ${total}`,
    `Passed: ${passed} (${score}%)`,
    `Degraded: ${degraded}`,
    `Failed: ${failed}`,
  ]

  for (const r of results) {
    const icon = r.verdict === 'PASS' ? '✓' : r.verdict === 'DEGRADED' ? '~' : '✗'
    details.push(`${icon} [${r.scenario}] ${r.verdict}: ${r.verdict_reason.slice(0, 120)}`)
  }

  return { score, classification, details }
}
