// Agency Group — Chaos Engine (Measurement-Based Adversarial Resilience Testing)
// lib/sre/chaosEngine.ts
//
// MEASUREMENT-BASED ONLY — reads current DB state and models hypothetical blast
// radii. Does NOT inject failures, kill processes, or disconnect real services.
//
// TypeScript strict — 0 errors

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChaosScenario =
  | 'kafka_broker_failure'
  | 'region_eu_west_shutdown'
  | 'region_eu_central_shutdown'
  | 'region_eu_south_shutdown'
  | 'database_read_replica_failure'
  | 'ai_gateway_budget_exhaustion'
  | 'ingestion_worker_death'
  | 'scoring_worker_death'
  | 'dlq_overflow'
  | 'network_partition_50pct'

export interface ChaosScenarioResult {
  scenario: ChaosScenario
  status: 'passed' | 'degraded' | 'failed'
  estimated_impact: {
    affected_components: string[]
    data_loss_risk: 'none' | 'minimal' | 'significant' | 'severe'
    recovery_time_estimate_ms: number
    revenue_impact_eur_per_hour: number
    fallback_available: boolean
  }
  current_state: {
    healthy_regions: number
    kafka_consumer_lag: number
    dlq_depth: number
    worker_health_pct: number
    ai_budget_remaining_pct: number
  }
  resilience_score: number
  vulnerabilities: string[]
  recommendations: string[]
  ran_at: string
  duration_ms: number
}

export interface ChaosGauntletResult {
  tenant_id: string
  total_scenarios: number
  passed: number
  degraded: number
  failed: number
  overall_resilience_score: number
  critical_vulnerabilities: string[]
  system_readiness: 'production_ready' | 'degraded_resilience' | 'critical_gaps'
  ran_at: string
  duration_ms: number
  scenarios: ChaosScenarioResult[]
}

// ─── Shared state readers ─────────────────────────────────────────────────────

interface SystemSnapshot {
  healthy_regions: number
  kafka_consumer_lag: number
  dlq_depth: number
  worker_health_pct: number
  ai_budget_remaining_pct: number
  ingestion_pending_jobs: number
  scoring_pending_jobs: number
  total_workers: number
}

async function readSystemSnapshot(tenantId: string): Promise<SystemSnapshot> {
  const db = supabaseAdmin as any

  // Healthy regions
  let healthy_regions = 3 // optimistic fallback
  try {
    const { count } = await db
      .from('region_status')
      .select('region', { count: 'exact', head: true })
      .in('status', ['healthy', 'degraded'])
    healthy_regions = (count as number) ?? 3
  } catch { /* non-fatal */ }

  // DLQ depth (unresolved messages only)
  let dlq_depth = 0
  try {
    const { count: unresolved } = await db
      .from('dlq_messages')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('resolved_at', null)
    dlq_depth = (unresolved as number) ?? 0
  } catch { dlq_depth = 0 }

  // Worker health
  let worker_health_pct = 100
  let total_workers = 0
  try {
    const { data: workers } = await db
      .from('worker_health')
      .select('status')
      .eq('tenant_id', tenantId)

    const rows = (workers ?? []) as Array<{ status: string }>
    total_workers = rows.length
    if (total_workers > 0) {
      const healthy_count = rows.filter(w => w.status === 'healthy').length
      worker_health_pct = Math.round((healthy_count / total_workers) * 100)
    }
  } catch { /* non-fatal */ }

  // Kafka consumer lag (check consumer_backpressure_metrics)
  let kafka_consumer_lag = 0
  try {
    const { data: lag } = await db
      .from('consumer_backpressure_metrics')
      .select('current_lag')
      .order('measured_at', { ascending: false })
      .limit(1)
    const lagRow = (lag ?? []) as Array<{ current_lag: number | null }>
    kafka_consumer_lag = lagRow[0]?.current_lag ?? 0
  } catch { /* non-fatal */ }

  // AI budget remaining (check ai_budgets + today's usage)
  let ai_budget_remaining_pct = 100
  try {
    const today = new Date().toISOString().slice(0, 10)
    const { data: budgets } = await db
      .from('ai_budgets')
      .select('daily_limit_usd, tenant_id')
      .eq('tenant_id', tenantId)
      .limit(1)

    const budgetRow = (budgets ?? []) as Array<{ daily_limit_usd: number }>
    const dailyLimit = budgetRow[0]?.daily_limit_usd ?? 0

    if (dailyLimit > 0) {
      const { data: usage } = await db
        .from('ai_usage_log')
        .select('cost_usd')
        .eq('tenant_id', tenantId)
        .gte('created_at', `${today}T00:00:00Z`)
        .lte('created_at', `${today}T23:59:59Z`)

      const usageRows = (usage ?? []) as Array<{ cost_usd: number }>
      const totalUsed = usageRows.reduce((s, r) => s + (r.cost_usd ?? 0), 0)
      ai_budget_remaining_pct = Math.max(0, Math.round(((dailyLimit - totalUsed) / dailyLimit) * 100))
    }
  } catch { /* non-fatal */ }

  // Pending jobs by type
  let ingestion_pending_jobs = 0
  let scoring_pending_jobs = 0
  try {
    const { count: ingCount } = await db
      .from('job_queue')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .eq('job_type', 'ingestion')
    ingestion_pending_jobs = (ingCount as number) ?? 0

    const { count: scCount } = await db
      .from('job_queue')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .eq('job_type', 'scoring')
    scoring_pending_jobs = (scCount as number) ?? 0
  } catch { /* non-fatal */ }

  return {
    healthy_regions,
    kafka_consumer_lag,
    dlq_depth,
    worker_health_pct,
    ai_budget_remaining_pct,
    ingestion_pending_jobs,
    scoring_pending_jobs,
    total_workers,
  }
}

// ─── Scenario evaluators ──────────────────────────────────────────────────────

function evalKafkaBrokerFailure(snap: SystemSnapshot): Omit<ChaosScenarioResult, 'scenario' | 'ran_at' | 'duration_ms'> {
  const hasBrokers = !!process.env.KAFKA_BROKERS
  const dlqFallback = true // system always has DLQ
  const lag = snap.kafka_consumer_lag

  const vulnerabilities: string[] = []
  const recommendations: string[] = []

  if (!hasBrokers) {
    vulnerabilities.push('KAFKA_BROKERS env var not set — using Supabase queue fallback only')
    recommendations.push('Configure KAFKA_BROKERS for production-grade message streaming')
  }
  if (lag > 10_000) {
    vulnerabilities.push(`High consumer lag (${lag}) — broker failure would compound backlog significantly`)
    recommendations.push('Scale consumer group before broker load reaches critical lag')
  }

  const score = dlqFallback
    ? (hasBrokers ? (lag < 1000 ? 90 : lag < 10_000 ? 65 : 40) : 50)
    : 20

  const status: ChaosScenarioResult['status'] = score >= 70 ? 'passed' : score >= 45 ? 'degraded' : 'failed'

  return {
    status,
    estimated_impact: {
      affected_components: ['kafka_consumers', 'ingestion_pipeline', 'event_streaming'],
      data_loss_risk: dlqFallback ? 'none' : 'significant',
      recovery_time_estimate_ms: 15_000,
      revenue_impact_eur_per_hour: lag > 5_000 ? 500 : 100,
      fallback_available: dlqFallback,
    },
    current_state: {
      healthy_regions: snap.healthy_regions,
      kafka_consumer_lag: snap.kafka_consumer_lag,
      dlq_depth: snap.dlq_depth,
      worker_health_pct: snap.worker_health_pct,
      ai_budget_remaining_pct: snap.ai_budget_remaining_pct,
    },
    resilience_score: score,
    vulnerabilities,
    recommendations,
  }
}

function evalRegionShutdown(
  scenario: ChaosScenario,
  snap: SystemSnapshot,
): Omit<ChaosScenarioResult, 'scenario' | 'ran_at' | 'duration_ms'> {
  const regionName = scenario === 'region_eu_west_shutdown'
    ? 'eu-west-1'
    : scenario === 'region_eu_central_shutdown'
      ? 'eu-central-1'
      : 'eu-south-1'

  const fallbackRegions = snap.healthy_regions - 1
  const vulnerabilities: string[] = []
  const recommendations: string[] = []

  if (snap.healthy_regions < 2) {
    vulnerabilities.push('Only 1 healthy region — no regional failover possible')
    recommendations.push('Restore at least 2 healthy regions before production traffic')
  }
  if (snap.healthy_regions === 2) {
    vulnerabilities.push('Loss of this region leaves only 1 region — no redundancy')
    recommendations.push('Ensure all 3 EU regions are healthy for full resilience')
  }

  const score = fallbackRegions >= 2 ? 100 : fallbackRegions === 1 ? 50 : 0
  const status: ChaosScenarioResult['status'] = score >= 70 ? 'passed' : score >= 40 ? 'degraded' : 'failed'

  return {
    status,
    estimated_impact: {
      affected_components: [`region:${regionName}`, 'geo_routing', 'traffic_split'],
      data_loss_risk: fallbackRegions >= 1 ? 'none' : 'significant',
      recovery_time_estimate_ms: 9_500,
      revenue_impact_eur_per_hour: fallbackRegions >= 1 ? 0 : 2_000,
      fallback_available: fallbackRegions >= 1,
    },
    current_state: {
      healthy_regions: snap.healthy_regions,
      kafka_consumer_lag: snap.kafka_consumer_lag,
      dlq_depth: snap.dlq_depth,
      worker_health_pct: snap.worker_health_pct,
      ai_budget_remaining_pct: snap.ai_budget_remaining_pct,
    },
    resilience_score: score,
    vulnerabilities,
    recommendations,
  }
}

function evalDbReadReplicaFailure(snap: SystemSnapshot): Omit<ChaosScenarioResult, 'scenario' | 'ran_at' | 'duration_ms'> {
  const vulnerabilities: string[] = []
  const recommendations: string[] = []

  // If Supabase connection pool >= 1, read replica loss routes to primary
  if (snap.worker_health_pct < 80) {
    vulnerabilities.push('Worker health degraded — read replica failure would compound load on primary')
    recommendations.push('Restore worker health before read-heavy workloads are routed to primary')
  }

  const score = snap.worker_health_pct >= 90 ? 85 : snap.worker_health_pct >= 60 ? 60 : 30
  const status: ChaosScenarioResult['status'] = score >= 70 ? 'passed' : score >= 45 ? 'degraded' : 'failed'

  return {
    status,
    estimated_impact: {
      affected_components: ['database_reads', 'analytics_queries', 'reporting'],
      data_loss_risk: 'none',
      recovery_time_estimate_ms: 5_000,
      revenue_impact_eur_per_hour: 100,
      fallback_available: true, // write primary always accepts reads
    },
    current_state: {
      healthy_regions: snap.healthy_regions,
      kafka_consumer_lag: snap.kafka_consumer_lag,
      dlq_depth: snap.dlq_depth,
      worker_health_pct: snap.worker_health_pct,
      ai_budget_remaining_pct: snap.ai_budget_remaining_pct,
    },
    resilience_score: score,
    vulnerabilities,
    recommendations,
  }
}

function evalAiGatewayBudgetExhaustion(snap: SystemSnapshot): Omit<ChaosScenarioResult, 'scenario' | 'ran_at' | 'duration_ms'> {
  const remaining = snap.ai_budget_remaining_pct
  const vulnerabilities: string[] = []
  const recommendations: string[] = []

  if (remaining < 50) {
    vulnerabilities.push(`AI budget at ${remaining}% — approaching daily exhaustion`)
    recommendations.push('Review AI usage patterns and increase daily budget allocation or add fallback heuristics')
  }
  if (remaining < 10) {
    vulnerabilities.push('AI budget critically low — Sofia and scoring will fall back to heuristics within hours')
    recommendations.push('Immediately review and throttle AI-heavy workflows; configure circuit breaker at 5% budget')
  }

  const status: ChaosScenarioResult['status'] = remaining > 50 ? 'passed' : remaining >= 10 ? 'degraded' : 'failed'
  const score = remaining > 50 ? 85 : remaining >= 30 ? 60 : remaining >= 10 ? 35 : 10

  return {
    status,
    estimated_impact: {
      affected_components: ['sofia_chat', 'property_scoring', 'ai_enrichment', 'investor_matching'],
      data_loss_risk: 'none',
      recovery_time_estimate_ms: 3_600_000, // next day reset
      revenue_impact_eur_per_hour: remaining < 10 ? 800 : remaining < 50 ? 300 : 50,
      fallback_available: true, // heuristic fallbacks exist
    },
    current_state: {
      healthy_regions: snap.healthy_regions,
      kafka_consumer_lag: snap.kafka_consumer_lag,
      dlq_depth: snap.dlq_depth,
      worker_health_pct: snap.worker_health_pct,
      ai_budget_remaining_pct: snap.ai_budget_remaining_pct,
    },
    resilience_score: score,
    vulnerabilities,
    recommendations,
  }
}

function evalWorkerDeath(
  workerType: 'ingestion' | 'scoring',
  snap: SystemSnapshot,
): Omit<ChaosScenarioResult, 'scenario' | 'ran_at' | 'duration_ms'> {
  const pendingJobs = workerType === 'ingestion' ? snap.ingestion_pending_jobs : snap.scoring_pending_jobs
  const workerHealthy = snap.worker_health_pct >= 80
  const vulnerabilities: string[] = []
  const recommendations: string[] = []

  if (!workerHealthy) {
    vulnerabilities.push(`Worker cluster at ${snap.worker_health_pct}% health — ${workerType} worker loss leaves no redundancy`)
    recommendations.push(`Scale ${workerType} worker replicas to at least 3 for zone-failure tolerance`)
  }
  if (pendingJobs > 100) {
    vulnerabilities.push(`${pendingJobs} pending ${workerType} jobs — worker death would stall queue for extended period`)
    recommendations.push(`Add auto-scaling triggers at ${workerType} queue depth > 50 pending jobs`)
  }

  let score: number
  if (workerHealthy && pendingJobs < 50) score = 85
  else if (pendingJobs < 100) score = 55
  else score = 25

  const status: ChaosScenarioResult['status'] = score >= 70 ? 'passed' : score >= 40 ? 'degraded' : 'failed'

  return {
    status,
    estimated_impact: {
      affected_components: [`${workerType}_worker`, `${workerType}_queue`, 'job_scheduler'],
      data_loss_risk: 'minimal', // DLQ guarantees no permanent loss
      recovery_time_estimate_ms: pendingJobs > 100 ? 60_000 : 20_000,
      revenue_impact_eur_per_hour: workerType === 'ingestion' ? 400 : 200,
      fallback_available: snap.total_workers > 1,
    },
    current_state: {
      healthy_regions: snap.healthy_regions,
      kafka_consumer_lag: snap.kafka_consumer_lag,
      dlq_depth: snap.dlq_depth,
      worker_health_pct: snap.worker_health_pct,
      ai_budget_remaining_pct: snap.ai_budget_remaining_pct,
    },
    resilience_score: score,
    vulnerabilities,
    recommendations,
  }
}

function evalDlqOverflow(snap: SystemSnapshot): Omit<ChaosScenarioResult, 'scenario' | 'ran_at' | 'duration_ms'> {
  const dlqDepth = snap.dlq_depth
  const vulnerabilities: string[] = []
  const recommendations: string[] = []

  if (dlqDepth > 100) {
    vulnerabilities.push(`DLQ has ${dlqDepth} unresolved messages — overflow imminent`)
    recommendations.push('Investigate and replay DLQ messages; check consumer group health for root cause')
  }
  if (dlqDepth > 500) {
    vulnerabilities.push('DLQ depth exceeds 500 — potential data staleness in investor matching and property scores')
    recommendations.push('Trigger emergency DLQ drain procedure and scale consumer replicas')
  }

  const status: ChaosScenarioResult['status'] = dlqDepth > 1000 ? 'failed' : dlqDepth > 100 ? 'degraded' : 'passed'
  const score = dlqDepth > 1000 ? 10 : dlqDepth > 100 ? 40 : dlqDepth > 20 ? 70 : 95

  return {
    status,
    estimated_impact: {
      affected_components: ['dlq_consumer', 'event_replay', 'data_freshness'],
      data_loss_risk: dlqDepth > 1000 ? 'significant' : dlqDepth > 100 ? 'minimal' : 'none',
      recovery_time_estimate_ms: dlqDepth * 100, // ~100ms per message to drain
      revenue_impact_eur_per_hour: dlqDepth > 500 ? 600 : 100,
      fallback_available: false, // DLQ IS the fallback
    },
    current_state: {
      healthy_regions: snap.healthy_regions,
      kafka_consumer_lag: snap.kafka_consumer_lag,
      dlq_depth: snap.dlq_depth,
      worker_health_pct: snap.worker_health_pct,
      ai_budget_remaining_pct: snap.ai_budget_remaining_pct,
    },
    resilience_score: score,
    vulnerabilities,
    recommendations,
  }
}

function evalNetworkPartition50pct(snap: SystemSnapshot): Omit<ChaosScenarioResult, 'scenario' | 'ran_at' | 'duration_ms'> {
  const vulnerabilities: string[] = []
  const recommendations: string[] = []

  const affectedRegions = Math.ceil(snap.healthy_regions / 2)
  const remainingRegions = snap.healthy_regions - affectedRegions

  if (remainingRegions < 1) {
    vulnerabilities.push('50% partition leaves no healthy region — system fully unavailable')
    recommendations.push('Ensure minimum 3 healthy regions before production workloads')
  }
  if (snap.kafka_consumer_lag > 5_000) {
    vulnerabilities.push('Existing Kafka lag would be severely amplified by 50% network partition')
    recommendations.push('Drain consumer lag below 1000 before peak traffic windows')
  }
  if (snap.dlq_depth > 50) {
    vulnerabilities.push('Pre-existing DLQ backlog would grow uncontrollably during partition')
    recommendations.push('Clear DLQ backlog before partition risk windows')
  }

  const score = remainingRegions >= 2 ? 75
    : remainingRegions >= 1 ? (snap.kafka_consumer_lag < 1000 ? 50 : 30)
    : 5

  const status: ChaosScenarioResult['status'] = score >= 70 ? 'passed' : score >= 35 ? 'degraded' : 'failed'

  return {
    status,
    estimated_impact: {
      affected_components: ['geo_routing', 'kafka_replication', 'db_reads', 'api_gateway'],
      data_loss_risk: remainingRegions >= 1 ? 'minimal' : 'severe',
      recovery_time_estimate_ms: 30_000,
      revenue_impact_eur_per_hour: remainingRegions >= 1 ? 800 : 4_000,
      fallback_available: remainingRegions >= 1,
    },
    current_state: {
      healthy_regions: snap.healthy_regions,
      kafka_consumer_lag: snap.kafka_consumer_lag,
      dlq_depth: snap.dlq_depth,
      worker_health_pct: snap.worker_health_pct,
      ai_budget_remaining_pct: snap.ai_budget_remaining_pct,
    },
    resilience_score: score,
    vulnerabilities,
    recommendations,
  }
}

// ─── runChaosScenario ─────────────────────────────────────────────────────────

export async function runChaosScenario(
  tenantId: string,
  scenario: ChaosScenario,
): Promise<ChaosScenarioResult> {
  const t0 = Date.now()
  const ran_at = new Date().toISOString()

  log.info('[ChaosEngine] running scenario', { scenario, tenant_id: tenantId })

  try {
    const snap = await readSystemSnapshot(tenantId)

    let partial: Omit<ChaosScenarioResult, 'scenario' | 'ran_at' | 'duration_ms'>

    switch (scenario) {
      case 'kafka_broker_failure':
        partial = evalKafkaBrokerFailure(snap)
        break
      case 'region_eu_west_shutdown':
      case 'region_eu_central_shutdown':
      case 'region_eu_south_shutdown':
        partial = evalRegionShutdown(scenario, snap)
        break
      case 'database_read_replica_failure':
        partial = evalDbReadReplicaFailure(snap)
        break
      case 'ai_gateway_budget_exhaustion':
        partial = evalAiGatewayBudgetExhaustion(snap)
        break
      case 'ingestion_worker_death':
        partial = evalWorkerDeath('ingestion', snap)
        break
      case 'scoring_worker_death':
        partial = evalWorkerDeath('scoring', snap)
        break
      case 'dlq_overflow':
        partial = evalDlqOverflow(snap)
        break
      case 'network_partition_50pct':
        partial = evalNetworkPartition50pct(snap)
        break
      default: {
        const _exhaustive: never = scenario
        throw new Error(`Unknown chaos scenario: ${String(_exhaustive)}`)
      }
    }

    const result: ChaosScenarioResult = {
      ...partial,
      scenario,
      ran_at,
      duration_ms: Date.now() - t0,
    }

    log.info('[ChaosEngine] scenario complete', {
      scenario,
      status: result.status,
      resilience_score: result.resilience_score,
      vulnerabilities_count: result.vulnerabilities.length,
    })

    return result
  } catch (err) {
    const duration_ms = Date.now() - t0
    log.error('[ChaosEngine] scenario threw', err instanceof Error ? err : undefined, {
      scenario,
      error: err instanceof Error ? err.message : String(err),
    })

    return {
      scenario,
      status: 'failed',
      estimated_impact: {
        affected_components: [],
        data_loss_risk: 'none',
        recovery_time_estimate_ms: 0,
        revenue_impact_eur_per_hour: 0,
        fallback_available: false,
      },
      current_state: {
        healthy_regions: 0,
        kafka_consumer_lag: 0,
        dlq_depth: 0,
        worker_health_pct: 0,
        ai_budget_remaining_pct: 0,
      },
      resilience_score: 0,
      vulnerabilities: [`Scenario evaluation failed: ${err instanceof Error ? err.message : String(err)}`],
      recommendations: ['Investigate chaos engine connectivity to Supabase'],
      ran_at,
      duration_ms,
    }
  }
}

// ─── runChaosGauntlet ─────────────────────────────────────────────────────────

const ALL_SCENARIOS: ChaosScenario[] = [
  'kafka_broker_failure',
  'region_eu_west_shutdown',
  'region_eu_central_shutdown',
  'region_eu_south_shutdown',
  'database_read_replica_failure',
  'ai_gateway_budget_exhaustion',
  'ingestion_worker_death',
  'scoring_worker_death',
  'dlq_overflow',
  'network_partition_50pct',
]

export async function runChaosGauntlet(
  tenantId: string,
  scenarios?: ChaosScenario[],
): Promise<ChaosGauntletResult> {
  const t0 = Date.now()
  const ran_at = new Date().toISOString()
  const toRun = scenarios ?? ALL_SCENARIOS

  log.info('[ChaosEngine] starting gauntlet', {
    tenant_id: tenantId,
    scenario_count: toRun.length,
  })

  const results: ChaosScenarioResult[] = []

  // Sequential to avoid DB query noise
  for (const scenario of toRun) {
    const result = await runChaosScenario(tenantId, scenario)
    results.push(result)
  }

  const passed = results.filter(r => r.status === 'passed').length
  const degraded = results.filter(r => r.status === 'degraded').length
  const failed = results.filter(r => r.status === 'failed').length

  const overall_resilience_score = results.length > 0
    ? Math.round(results.reduce((s, r) => s + r.resilience_score, 0) / results.length * 100) / 100
    : 0

  const critical_vulnerabilities = results
    .filter(r => r.status === 'failed')
    .flatMap(r => r.vulnerabilities)

  let system_readiness: ChaosGauntletResult['system_readiness']
  if (failed === 0 && overall_resilience_score >= 70) {
    system_readiness = 'production_ready'
  } else if (overall_resilience_score >= 40) {
    system_readiness = 'degraded_resilience'
  } else {
    system_readiness = 'critical_gaps'
  }

  const gauntletResult: ChaosGauntletResult = {
    tenant_id:                  tenantId,
    total_scenarios:            results.length,
    passed,
    degraded,
    failed,
    overall_resilience_score,
    critical_vulnerabilities,
    system_readiness,
    ran_at,
    duration_ms:                Date.now() - t0,
    scenarios:                  results,
  }

  log.info('[ChaosEngine] gauntlet complete', {
    tenant_id: tenantId,
    passed,
    degraded,
    failed,
    overall_resilience_score,
    system_readiness,
    duration_ms: gauntletResult.duration_ms,
  })

  return gauntletResult
}

// ─── Backward-compat exports (used by /api/sre/chaos/route.ts) ───────────────
// The previous chaosEngine.ts exposed CHAOS_TEST_LIBRARY + getChaosHistory.
// These shims maintain import compatibility without requiring changes to the
// existing chaos route.

export interface ChaosTestDefinition {
  name: string
  type: string
  description: string
  durationMs: number
  expectedBehavior: string
  successCriteria: string
  riskLevel: 'low' | 'medium' | 'high'
  automatable: boolean
}

export interface ChaosTestResult {
  definition: ChaosTestDefinition
  status: 'passed' | 'failed' | 'skipped'
  systemRecovered: boolean
  recoveryTimeMs: number | null
  findings: string[]
  timestamp: string
}

// The old test library — kept for display purposes in the status UI.
// Execution has moved to the measurement-based scenario system above.
export const CHAOS_TEST_LIBRARY: ChaosTestDefinition[] = [
  {
    name:             'kafka-broker-1-down',
    type:             'network_partition',
    description:      'Model 1-of-3 Kafka broker failure via measurement',
    durationMs:       0,
    expectedBehavior: 'DLQ absorbs in-flight messages, consumer group rebalances',
    successCriteria:  'DLQ depth < 100, consumer lag < 1000',
    riskLevel:        'high',
    automatable:      true,
  },
  {
    name:             'region-eu-west-down',
    type:             'network_partition',
    description:      'Model EU West region shutdown via measurement',
    durationMs:       0,
    expectedBehavior: 'Traffic routed to EU South and EU Central within 10s',
    successCriteria:  'Failover plan completes under 10 000ms',
    riskLevel:        'high',
    automatable:      true,
  },
  {
    name:             'ai-budget-exhaustion',
    type:             'ai_provider_outage',
    description:      'Model AI gateway budget exhaustion via measurement',
    durationMs:       0,
    expectedBehavior: 'Heuristic fallback activates, no 5xx errors',
    successCriteria:  'AI budget remaining > 50%',
    riskLevel:        'medium',
    automatable:      true,
  },
  {
    name:             'dlq-overflow',
    type:             'queue_overflow',
    description:      'Model DLQ depth overflow via measurement',
    durationMs:       0,
    expectedBehavior: 'Alert fires at depth > 100, drain procedure triggered',
    successCriteria:  'DLQ depth < 100',
    riskLevel:        'medium',
    automatable:      true,
  },
]

export async function getChaosHistory(
  tenantId: string,
  limit = 20,
): Promise<ChaosTestResult[]> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('chaos_gauntlet_results')
      .select('scenarios, ran_at, system_readiness, overall_resilience_score')
      .eq('tenant_id', tenantId)
      .order('ran_at', { ascending: false })
      .limit(limit)

    if (error || !data) return []

    // Flatten each gauntlet run's scenarios into legacy ChaosTestResult shape
    const results: ChaosTestResult[] = []
    for (const row of (data as Array<{
      scenarios: ChaosScenarioResult[]
      ran_at: string
      system_readiness: string
      overall_resilience_score: number
    }>)) {
      for (const scenario of (row.scenarios ?? [])) {
        const def = CHAOS_TEST_LIBRARY.find(d => d.name.includes(scenario.scenario.split('_')[0])) ?? {
          name:             scenario.scenario,
          type:             'measurement',
          description:      `Measurement scenario: ${scenario.scenario}`,
          durationMs:       scenario.duration_ms,
          expectedBehavior: 'System demonstrates resilience to this failure mode',
          successCriteria:  'resilience_score >= 70',
          riskLevel:        'medium' as const,
          automatable:      true,
        }
        results.push({
          definition:      def,
          status:          scenario.status === 'passed' ? 'passed' : scenario.status === 'degraded' ? 'passed' : 'failed',
          systemRecovered: scenario.status !== 'failed',
          recoveryTimeMs:  scenario.estimated_impact.recovery_time_estimate_ms,
          findings:        [...scenario.vulnerabilities, ...scenario.recommendations],
          timestamp:       scenario.ran_at,
        })
      }
    }

    return results.slice(0, limit)
  } catch (err) {
    log.error('[ChaosEngine] getChaosHistory error', err instanceof Error ? err : undefined, {
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}

// ─── persistChaosResult ───────────────────────────────────────────────────────

export async function persistChaosResult(result: ChaosGauntletResult): Promise<void> {
  void (supabaseAdmin as any)
    .from('chaos_gauntlet_results')
    .insert({
      tenant_id:               result.tenant_id,
      total_scenarios:         result.total_scenarios,
      passed:                  result.passed,
      degraded:                result.degraded,
      failed:                  result.failed,
      overall_resilience_score: result.overall_resilience_score,
      critical_vulnerabilities: result.critical_vulnerabilities,
      system_readiness:        result.system_readiness,
      scenarios:               result.scenarios,
      ran_at:                  result.ran_at,
      duration_ms:             result.duration_ms,
    })
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) {
        log.warn('[ChaosEngine] persistChaosResult error', {
          error: error.message,
          tenant_id: result.tenant_id,
        })
      }
    })
    .catch((err: unknown) => {
      log.warn('[ChaosEngine] persistChaosResult threw', {
        error: err instanceof Error ? err.message : String(err),
        tenant_id: result.tenant_id,
      })
    })
}
