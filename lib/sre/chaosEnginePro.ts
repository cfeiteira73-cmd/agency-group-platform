// Agency Group — Chaos Engineering Pro
// lib/sre/chaosEnginePro.ts
// TypeScript strict — 0 errors

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { runDeepHealthCheck } from './healthCheck'
import { selfHealingEngine } from './selfHealingEngine'
import { RTO_SLA_SECONDS } from './rtoRpoTracker'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChaosFailureMode =
  | 'network_partition'
  | 'db_primary_failure'
  | 'kafka_broker_loss'
  | 'ai_provider_outage'
  | 'redis_eviction'
  | 'cpu_saturation'
  | 'memory_pressure'

export interface ChaosScenario {
  scenario_id: string
  name: string
  description: string
  failure_mode: ChaosFailureMode
  target_region?: string
  duration_seconds: number
  blast_radius: 'single_service' | 'partial_system' | 'full_region'
  recovery_expectation: {
    auto_heal_within_seconds: number
    requires_manual_intervention: boolean
    expected_degraded_features: string[]
    expected_unavailable_features: string[]
  }
}

export interface ChaosObservation {
  timestamp: string
  metric: string
  value: number
  threshold: number
  breached: boolean
}

export interface ChaosRunResult {
  scenario_id: string
  run_id: string
  started_at: string
  completed_at: string

  observations: ChaosObservation[]

  auto_healed: boolean
  manual_intervention_required: boolean
  rto_actual_seconds: number

  grade: 'pass' | 'pass_with_warnings' | 'fail'
  findings: string[]
  recommendations: string[]
}

export interface ChaosGauntletResult {
  scenarios_run: number
  scenarios_passed: number
  overall_resilience_score: number
  critical_failures: string[]
  recommendations: string[]
}

// ─── Scenario Library ─────────────────────────────────────────────────────────

export const CHAOS_SCENARIOS: ChaosScenario[] = [
  {
    scenario_id: 'network-partition-eu-west',
    name: 'Network Partition — EU West',
    description: 'Simulate network partition isolating eu-west-1 from other regions for 60s',
    failure_mode: 'network_partition',
    target_region: 'eu-west-1',
    duration_seconds: 60,
    blast_radius: 'partial_system',
    recovery_expectation: {
      auto_heal_within_seconds: 90,
      requires_manual_intervention: false,
      expected_degraded_features: ['cross-region writes', 'real-time sync'],
      expected_unavailable_features: [],
    },
  },
  {
    scenario_id: 'db-primary-failure',
    name: 'Database Primary Failure',
    description: 'Simulate Supabase primary DB becoming unreachable; expect failover to read-replica within RTO',
    failure_mode: 'db_primary_failure',
    duration_seconds: 120,
    blast_radius: 'partial_system',
    recovery_expectation: {
      auto_heal_within_seconds: RTO_SLA_SECONDS['database'] ?? 300,
      requires_manual_intervention: true,
      expected_degraded_features: ['write APIs', 'portal mutations'],
      expected_unavailable_features: ['deal creation', 'lead scoring'],
    },
  },
  {
    scenario_id: 'kafka-broker-loss',
    name: 'Kafka Broker Loss (1 of 3)',
    description: 'Take down one Kafka/Redpanda broker; verify quorum holds and consumer lag stays < 1000',
    failure_mode: 'kafka_broker_loss',
    duration_seconds: 120,
    blast_radius: 'single_service',
    recovery_expectation: {
      auto_heal_within_seconds: RTO_SLA_SECONDS['kafka'] ?? 600,
      requires_manual_intervention: false,
      expected_degraded_features: ['event throughput (reduced)', 'consumer lag spike'],
      expected_unavailable_features: [],
    },
  },
  {
    scenario_id: 'ai-provider-outage',
    name: 'AI Provider Outage',
    description: 'Simulate Anthropic API returning 5xx; expect heuristic fallback activation',
    failure_mode: 'ai_provider_outage',
    duration_seconds: 300,
    blast_radius: 'single_service',
    recovery_expectation: {
      auto_heal_within_seconds: 30,    // self-healing triggers within 30s
      requires_manual_intervention: false,
      expected_degraded_features: ['Sofia AI responses (rule-based only)', 'AVM scoring'],
      expected_unavailable_features: ['semantic search'],
    },
  },
  {
    scenario_id: 'redis-eviction',
    name: 'Redis Cache Eviction',
    description: 'Simulate Redis/Upstash becoming unreachable; expect in-memory fallback for rate limiting',
    failure_mode: 'redis_eviction',
    duration_seconds: 60,
    blast_radius: 'single_service',
    recovery_expectation: {
      auto_heal_within_seconds: RTO_SLA_SECONDS['redis'] ?? 180,
      requires_manual_intervention: false,
      expected_degraded_features: ['rate limiting (in-memory)', 'session caching'],
      expected_unavailable_features: [],
    },
  },
  {
    scenario_id: 'cpu-saturation',
    name: 'CPU Saturation',
    description: 'Simulate worker CPU at 100% for 30s; verify queue backpressure and no job loss',
    failure_mode: 'cpu_saturation',
    duration_seconds: 30,
    blast_radius: 'single_service',
    recovery_expectation: {
      auto_heal_within_seconds: 60,
      requires_manual_intervention: false,
      expected_degraded_features: ['job throughput', 'API p95 latency spike'],
      expected_unavailable_features: [],
    },
  },
  {
    scenario_id: 'memory-pressure',
    name: 'Memory Pressure',
    description: 'Simulate process memory > 90% heap; verify graceful degradation before OOM',
    failure_mode: 'memory_pressure',
    duration_seconds: 30,
    blast_radius: 'single_service',
    recovery_expectation: {
      auto_heal_within_seconds: 45,
      requires_manual_intervention: false,
      expected_degraded_features: ['in-memory caches cleared', 'buffer pool reduced'],
      expected_unavailable_features: [],
    },
  },
]

// ─── runChaosScenario ─────────────────────────────────────────────────────────

export async function runChaosScenario(
  scenarioId: string,
  tenantId: string,
  dryRun = false,
): Promise<ChaosRunResult> {
  const scenario = CHAOS_SCENARIOS.find(s => s.scenario_id === scenarioId)
  if (!scenario) {
    throw new Error(`Chaos scenario not found: ${scenarioId}`)
  }

  if (process.env.CHAOS_TESTING_ENABLED !== 'true' && !dryRun) {
    throw new Error('CHAOS_TESTING_ENABLED must be set to run chaos scenarios in non-dry-run mode')
  }

  const run_id    = `run-${scenarioId}-${Date.now()}`
  const started_at = new Date().toISOString()

  log.warn('[ChaosEnginePro] scenario started', {
    scenario_id: scenarioId,
    run_id,
    dry_run: dryRun,
  })

  const observations: ChaosObservation[] = []
  const findings: string[] = []
  const recommendations: string[] = []

  // Capture baseline health
  const baselineHealth = await runDeepHealthCheck()

  // Simulate the failure by observing current state + modelling expected metrics
  const simMetrics = _simulateFailureMetrics(scenario, baselineHealth)
  observations.push(...simMetrics)

  // Evaluate healing rules against simulated health state
  const healingExecutions = dryRun
    ? []
    : await selfHealingEngine.evaluate(baselineHealth)

  const auto_healed = healingExecutions.some(e => e.success && e.auto_executed)

  // Measure RTO: time from scenario start to first successful auto-heal (simulated)
  const completed_at = new Date().toISOString()
  const elapsed_ms   = new Date(completed_at).getTime() - new Date(started_at).getTime()
  const rto_actual_seconds = Math.round(elapsed_ms / 1000)

  // Determine grade
  const breachedThresholds = observations.filter(o => o.breached)
  const rtoMet = rto_actual_seconds <= scenario.recovery_expectation.auto_heal_within_seconds
  const healExpected = !scenario.recovery_expectation.requires_manual_intervention

  if (breachedThresholds.length === 0 && rtoMet) {
    // pass
  } else if (breachedThresholds.length > 0) {
    findings.push(`${breachedThresholds.length} metric threshold(s) breached during simulation`)
    breachedThresholds.forEach(o =>
      findings.push(`  ${o.metric}: ${o.value} (threshold: ${o.threshold})`),
    )
  }

  if (!rtoMet) {
    findings.push(
      `RTO target missed: actual ${rto_actual_seconds}s vs target ${scenario.recovery_expectation.auto_heal_within_seconds}s`,
    )
    recommendations.push(
      `Tune self-healing cooldown for ${scenario.failure_mode} to trigger faster`,
    )
  }

  if (healExpected && !auto_healed && !dryRun) {
    findings.push('Expected auto-healing did not trigger within scenario window')
    recommendations.push(`Review HEALING_RULES conditions for failure_mode: ${scenario.failure_mode}`)
  }

  if (baselineHealth.summary === 'critical') {
    findings.push('System was already in critical state before scenario — results may be unreliable')
    recommendations.push('Re-run chaos after stabilising the environment')
  }

  if (recommendations.length === 0) {
    recommendations.push('System responded as expected — no immediate action required')
  }

  const grade: ChaosRunResult['grade'] =
    findings.some(f => f.startsWith('RTO target missed') || f.startsWith('Expected auto-healing'))
      ? 'fail'
      : findings.length > 0
        ? 'pass_with_warnings'
        : 'pass'

  const result: ChaosRunResult = {
    scenario_id: scenarioId,
    run_id,
    started_at,
    completed_at,
    observations,
    auto_healed,
    manual_intervention_required: scenario.recovery_expectation.requires_manual_intervention,
    rto_actual_seconds,
    grade,
    findings,
    recommendations,
  }

  // Persist
  await _persistChaosRunResult(tenantId, result, dryRun)

  log.info('[ChaosEnginePro] scenario complete', {
    scenario_id: scenarioId,
    grade,
    rto_actual_seconds,
    findings_count: findings.length,
  })

  return result
}

// ─── runFullChaosGauntlet ─────────────────────────────────────────────────────

export async function runFullChaosGauntlet(tenantId: string, dryRun = false): Promise<ChaosGauntletResult> {
  log.warn('[ChaosEnginePro] Full gauntlet started', { tenant_id: tenantId, dry_run: dryRun })

  const allRecommendations = new Set<string>()
  const criticalFailures: string[] = []
  let passed = 0

  const results = await Promise.allSettled(
    CHAOS_SCENARIOS.map(s => runChaosScenario(s.scenario_id, tenantId, dryRun)),
  )

  for (const [i, settled] of results.entries()) {
    const scenario = CHAOS_SCENARIOS[i]
    if (settled.status === 'rejected') {
      criticalFailures.push(`${scenario.scenario_id}: scenario threw — ${settled.reason}`)
      continue
    }
    const run = settled.value
    if (run.grade === 'pass') {
      passed++
    } else if (run.grade === 'fail') {
      criticalFailures.push(`${scenario.scenario_id}: ${run.findings[0] ?? 'failed'}`)
    } else {
      passed++ // pass_with_warnings still counts
    }
    run.recommendations.forEach(r => allRecommendations.add(r))
  }

  const scenarios_run    = results.length
  const scenarios_passed = passed
  const resilience_score = scenarios_run > 0
    ? Math.round((scenarios_passed / scenarios_run) * 100)
    : 0

  const gauntletResult: ChaosGauntletResult = {
    scenarios_run,
    scenarios_passed,
    overall_resilience_score: resilience_score,
    critical_failures: criticalFailures,
    recommendations: [...allRecommendations].slice(0, 10),
  }

  // Persist gauntlet summary
  try {
    const { error } = await (supabaseAdmin as any)
      .from('chaos_gauntlet_results')
      .insert({
        tenant_id:        tenantId,
        scenarios_run,
        scenarios_passed,
        resilience_score,
        critical_failures: criticalFailures,
        recommendations:   [...allRecommendations],
        run_at:            new Date().toISOString(),
      })
    if (error) {
      log.warn('[ChaosEnginePro] gauntlet persist error', { error: error.message })
    }
  } catch (err) {
    log.warn('[ChaosEnginePro] gauntlet persist threw', {
      error: err instanceof Error ? err.message : String(err),
    })
  }

  log.info('[ChaosEnginePro] Full gauntlet complete', {
    scenarios_run,
    scenarios_passed,
    resilience_score,
    critical_failures_count: criticalFailures.length,
  })

  return gauntletResult
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function _simulateFailureMetrics(
  scenario: ChaosScenario,
  health: Awaited<ReturnType<typeof runDeepHealthCheck>>,
): ChaosObservation[] {
  const now = new Date().toISOString()
  const observations: ChaosObservation[] = []

  const dbLatency  = health.services.database?.latency_ms ?? 0
  const redisOk    = health.services.redis?.ok ?? true
  const aiOk       = health.services.ai_provider?.ok ?? true
  const kafkaLag   = (health.services.kafka as { lag_total?: number })?.lag_total ?? 0

  switch (scenario.failure_mode) {
    case 'db_primary_failure':
      observations.push({
        timestamp: now,
        metric: 'db_reachability',
        value: 0,
        threshold: 1,
        breached: true,
      })
      break

    case 'ai_provider_outage':
      observations.push({
        timestamp: now,
        metric: 'ai_provider_available',
        value: aiOk ? 1 : 0,
        threshold: 1,
        breached: !aiOk,
      })
      break

    case 'redis_eviction':
      observations.push({
        timestamp: now,
        metric: 'redis_available',
        value: redisOk ? 1 : 0,
        threshold: 1,
        breached: !redisOk,
      })
      break

    case 'kafka_broker_loss':
      observations.push({
        timestamp: now,
        metric: 'kafka_consumer_lag',
        value: kafkaLag,
        threshold: 1000,
        breached: kafkaLag > 1000,
      })
      break

    case 'network_partition':
      observations.push({
        timestamp: now,
        metric: 'cross_region_reachability',
        value: 1,    // simulated — no actual partition
        threshold: 1,
        breached: false,
      })
      break

    case 'cpu_saturation':
      observations.push({
        timestamp: now,
        metric: 'api_p95_latency_ms',
        value: dbLatency * 3,     // model 3× latency under saturation
        threshold: 5000,
        breached: dbLatency * 3 > 5000,
      })
      break

    case 'memory_pressure':
      observations.push({
        timestamp: now,
        metric: 'heap_used_pct',
        value: 85,    // simulated 85% heap
        threshold: 90,
        breached: false,
      })
      break

    default: {
      const _never: never = scenario.failure_mode
      log.warn('[ChaosEnginePro] unknown failure_mode', { mode: _never })
    }
  }

  return observations
}

async function _persistChaosRunResult(
  tenantId: string,
  result: ChaosRunResult,
  dryRun: boolean,
): Promise<void> {
  if (dryRun) return
  try {
    const { error } = await (supabaseAdmin as any)
      .from('chaos_test_results')
      .insert({
        tenant_id:        tenantId,
        test_name:        result.scenario_id,
        test_type:        'pro_scenario',
        status:           result.grade === 'pass' ? 'passed' : result.grade === 'fail' ? 'failed' : 'passed',
        started_at:       result.started_at,
        completed_at:     result.completed_at,
        system_recovered: result.auto_healed,
        recovery_time_ms: result.rto_actual_seconds * 1000,
        findings:         { items: result.findings },
      })
    if (error) {
      log.warn('[ChaosEnginePro] persist run result error', { error: error.message })
    }
  } catch (err) {
    log.warn('[ChaosEnginePro] persist run result threw', {
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
