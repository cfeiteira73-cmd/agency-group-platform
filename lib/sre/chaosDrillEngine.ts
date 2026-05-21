// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Chaos Drill Engine (Wave 33)
// lib/sre/chaosDrillEngine.ts
//
// Weekly chaos drill simulations. MEASUREMENT-BASED ONLY — reads DB state,
// models blast radius. NEVER injects real failures, NEVER calls process.exit(),
// NEVER kills connections.
// =============================================================================

import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type DrillScenario =
  | 'db_shutdown'         // simulate DB becoming unavailable
  | 'kafka_loss'          // simulate all Kafka topics lost
  | 'region_kill'         // simulate primary region going down
  | 'network_partition'   // simulate network split
  | 'latency_spike'       // simulate high latency (>2s)
  | 'ml_corruption'       // simulate ML models becoming invalid
  | 'cascade_failure'     // simulate 3 services failing simultaneously

export interface DrillScenarioResult {
  scenario: DrillScenario
  blast_radius: 'low' | 'medium' | 'high' | 'critical'
  estimated_data_loss_events: number
  estimated_recovery_time_minutes: number
  affected_tenants: number
  affected_transactions: number    // capital_transactions in flight
  mitigation_steps: string[]
  current_resilience_score: number // 0–100
  passed: boolean
}

export interface ChaosDrillReport {
  id: string
  tenant_id: string
  scenarios_run: DrillScenario[]
  results: DrillScenarioResult[]
  overall_grade: 'S' | 'A' | 'B' | 'C' | 'D'
  critical_weaknesses: string[]
  recommendations: string[]
  drill_type: 'scheduled' | 'manual' | 'triggered'
  ran_at: string
}

// ─── DB readers ───────────────────────────────────────────────────────────────

interface DrillSnapshot {
  active_transactions: number
  active_settlements: number
  unprocessed_kafka_events: number
  canonical_assets_count: number
  active_bids_count: number
  recent_roi_inferences: number    // roi_predictions in last hour
  active_ml_models: number
  recent_ml_artifact_backup: boolean // ml_artifact_log has backup within 24h
  recent_event_count_5min: number  // kafka_event_log events in last 5 min
  tenant_count: number
}

async function readDrillSnapshot(tenantId: string): Promise<DrillSnapshot> {
  const db = supabaseAdmin as any
  const snap: DrillSnapshot = {
    active_transactions: 0,
    active_settlements: 0,
    unprocessed_kafka_events: 0,
    canonical_assets_count: 0,
    active_bids_count: 0,
    recent_roi_inferences: 0,
    active_ml_models: 0,
    recent_ml_artifact_backup: false,
    recent_event_count_5min: 0,
    tenant_count: 1,
  }

  // Active capital_transactions
  try {
    const { count } = await db
      .from('capital_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .in('status', ['pending', 'processing', 'in_flight'])
    snap.active_transactions = (count as number) ?? 0
  } catch { /* non-fatal */ }

  // Active settlement_records
  try {
    const { count } = await db
      .from('settlement_records')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .in('status', ['pending', 'processing'])
    snap.active_settlements = (count as number) ?? 0
  } catch { /* non-fatal */ }

  // Unprocessed kafka events
  try {
    const { count } = await db
      .from('kafka_event_log')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('processed_at', null)
    snap.unprocessed_kafka_events = (count as number) ?? 0
  } catch { /* non-fatal */ }

  // Canonical assets
  try {
    const { count } = await db
      .from('canonical_assets')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
    snap.canonical_assets_count = (count as number) ?? 0
  } catch { /* non-fatal */ }

  // Active bids (from canonical_assets or separate bids table)
  try {
    const { count } = await db
      .from('canonical_assets')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'bid_active')
    snap.active_bids_count = (count as number) ?? 0
  } catch { /* non-fatal */ }

  // ROI predictions in last hour (ML inference calls)
  try {
    const cutoff1h = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await db
      .from('roi_predictions')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('predicted_at', cutoff1h)
    snap.recent_roi_inferences = (count as number) ?? 0
  } catch { /* non-fatal */ }

  // Active ML models
  try {
    const { count } = await db
      .from('ml_models')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
    snap.active_ml_models = (count as number) ?? 0
  } catch {
    try {
      const { count } = await db
        .from('ml_model_registry')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
      snap.active_ml_models = (count as number) ?? 0
    } catch { /* non-fatal */ }
  }

  // Recent ML artifact backup (within 24h)
  try {
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count } = await db
      .from('ml_artifact_log')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', cutoff24h)
    snap.recent_ml_artifact_backup = ((count as number) ?? 0) > 0
  } catch { /* non-fatal */ }

  // Recent events in last 5 min
  try {
    const cutoff5m = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { count } = await db
      .from('kafka_event_log')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('emitted_at', cutoff5m)
    snap.recent_event_count_5min = (count as number) ?? 0
  } catch { /* non-fatal */ }

  // Tenant count (global)
  try {
    const { count } = await db
      .from('tenants')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
    snap.tenant_count = Math.max(1, (count as number) ?? 1)
  } catch {
    snap.tenant_count = 1
  }

  return snap
}

// ─── Scenario evaluators ──────────────────────────────────────────────────────

function evalDbShutdown(snap: DrillSnapshot): DrillScenarioResult {
  const inFlight = snap.active_transactions + snap.active_settlements
  const blast_radius: DrillScenarioResult['blast_radius'] =
    inFlight === 0 ? 'low' :
    inFlight <= 5 ? 'medium' :
    inFlight <= 20 ? 'high' :
    'critical'

  const score = blast_radius === 'low' ? 90 : blast_radius === 'medium' ? 65 : blast_radius === 'high' ? 35 : 10

  return {
    scenario: 'db_shutdown',
    blast_radius,
    estimated_data_loss_events: snap.unprocessed_kafka_events,
    estimated_recovery_time_minutes: 5,
    affected_tenants: snap.tenant_count,
    affected_transactions: inFlight,
    mitigation_steps: [
      'Enable PITR on Supabase (minimum 7-day retention)',
      'Verify daily backup_snapshots are completing successfully',
      'Implement write-ahead log shipping to standby',
      'Configure automatic failover to read replica',
    ],
    current_resilience_score: score,
    passed: blast_radius !== 'critical',
  }
}

function evalKafkaLoss(snap: DrillSnapshot): DrillScenarioResult {
  const unprocessed = snap.unprocessed_kafka_events
  const blast_radius: DrillScenarioResult['blast_radius'] =
    unprocessed === 0 ? 'low' :
    unprocessed < 50 ? 'medium' :
    unprocessed < 200 ? 'high' :
    'critical'

  const score = unprocessed === 0 ? 95 : unprocessed < 50 ? 70 : unprocessed < 200 ? 40 : 10

  return {
    scenario: 'kafka_loss',
    blast_radius,
    estimated_data_loss_events: unprocessed,
    estimated_recovery_time_minutes: 10,
    affected_tenants: snap.tenant_count,
    affected_transactions: snap.active_transactions,
    mitigation_steps: [
      'Configure Kafka topic replication factor >= 3',
      'Enable Kafka log compaction for state recovery',
      'Implement dead-letter queue with automatic replay',
      'Use kafka_event_log as persistent event store fallback',
    ],
    current_resilience_score: score,
    passed: unprocessed < 100,
  }
}

function evalRegionKill(snap: DrillSnapshot): DrillScenarioResult {
  const total = snap.canonical_assets_count + snap.active_bids_count
  const blast_radius: DrillScenarioResult['blast_radius'] =
    total < 10 ? 'low' :
    total < 100 ? 'medium' :
    total < 500 ? 'high' :
    'critical'

  const score = blast_radius === 'low' ? 85 : blast_radius === 'medium' ? 65 : blast_radius === 'high' ? 40 : 15

  return {
    scenario: 'region_kill',
    blast_radius,
    estimated_data_loss_events: 0, // regions replicate synchronously
    estimated_recovery_time_minutes: 10,
    affected_tenants: snap.tenant_count,
    affected_transactions: snap.active_transactions,
    mitigation_steps: [
      'Enable Supabase read replica in EU-Central',
      'Configure automatic DNS failover (TTL <= 60s)',
      'Deploy to multiple Vercel edge regions',
      'Implement circuit breaker for region health checks',
    ],
    current_resilience_score: score,
    passed: blast_radius !== 'critical',
  }
}

function evalNetworkPartition(snap: DrillSnapshot): DrillScenarioResult {
  const recentEvents = snap.recent_event_count_5min
  const blast_radius: DrillScenarioResult['blast_radius'] =
    recentEvents <= 10 ? 'low' :
    recentEvents <= 50 ? 'medium' :
    recentEvents <= 200 ? 'high' :
    'critical'

  const score = blast_radius === 'low' ? 85 : blast_radius === 'medium' ? 60 : blast_radius === 'high' ? 35 : 10

  return {
    scenario: 'network_partition',
    blast_radius,
    estimated_data_loss_events: Math.floor(recentEvents * 0.5), // 50% of in-flight would be lost
    estimated_recovery_time_minutes: 15,
    affected_tenants: snap.tenant_count,
    affected_transactions: snap.active_transactions,
    mitigation_steps: [
      'Implement idempotent writes for all critical operations',
      'Use optimistic locking with conflict resolution',
      'Deploy event sourcing to recover from split-brain scenarios',
      'Configure consensus timeout thresholds for partition detection',
    ],
    current_resilience_score: score,
    passed: blast_radius !== 'critical' && blast_radius !== 'high',
  }
}

function evalLatencySpike(snap: DrillSnapshot): DrillScenarioResult {
  const inferences = snap.recent_roi_inferences
  // High inference volume = high blast radius under latency
  const blast_radius: DrillScenarioResult['blast_radius'] =
    inferences < 10 ? 'low' :
    inferences < 50 ? 'medium' :
    inferences < 200 ? 'high' :
    'critical'

  const score = blast_radius === 'low' ? 90 : blast_radius === 'medium' ? 70 : blast_radius === 'high' ? 45 : 20

  return {
    scenario: 'latency_spike',
    blast_radius,
    estimated_data_loss_events: 0, // latency doesn't cause data loss
    estimated_recovery_time_minutes: 3,
    affected_tenants: snap.tenant_count,
    affected_transactions: snap.active_transactions,
    mitigation_steps: [
      'Implement request timeouts on all ML inference calls (max 2s)',
      'Configure circuit breaker to fall back to heuristics at >2s latency',
      'Enable response caching for ROI predictions (TTL: 5min)',
      'Add queue depth monitoring with auto-scaling triggers',
    ],
    current_resilience_score: score,
    passed: blast_radius !== 'critical',
  }
}

function evalMlCorruption(snap: DrillSnapshot): DrillScenarioResult {
  const hasBackup = snap.recent_ml_artifact_backup
  const activeModels = snap.active_ml_models

  const blast_radius: DrillScenarioResult['blast_radius'] =
    activeModels === 0 ? 'low' :
    hasBackup ? 'medium' :
    activeModels < 5 ? 'high' :
    'critical'

  const score = activeModels === 0 ? 90 : hasBackup ? 75 : 25

  return {
    scenario: 'ml_corruption',
    blast_radius,
    estimated_data_loss_events: 0,
    estimated_recovery_time_minutes: hasBackup ? 15 : 60,
    affected_tenants: snap.tenant_count,
    affected_transactions: 0,
    mitigation_steps: [
      'Ensure ml_artifact_log backups run every 6h (not just 24h)',
      'Implement model versioning with immutable artifact storage in S3',
      'Configure automatic rollback to last known-good model version',
      'Maintain heuristic fallbacks for all ML-powered scoring',
    ],
    current_resilience_score: score,
    passed: hasBackup,
  }
}

function evalCascadeFailure(
  dbResult: DrillScenarioResult,
  kafkaResult: DrillScenarioResult,
  regionResult: DrillScenarioResult,
): DrillScenarioResult {
  const scores = [dbResult.current_resilience_score, kafkaResult.current_resilience_score, regionResult.current_resilience_score]
  const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)

  const radii = [dbResult.blast_radius, kafkaResult.blast_radius, regionResult.blast_radius]
  const blast_radius: DrillScenarioResult['blast_radius'] =
    radii.includes('critical') ? 'critical' :
    radii.includes('high') ? 'critical' : // cascade amplifies
    radii.filter(r => r === 'medium').length >= 2 ? 'high' :
    'medium'

  const totalDataLoss = dbResult.estimated_data_loss_events + kafkaResult.estimated_data_loss_events
  const maxRecovery = Math.max(
    dbResult.estimated_recovery_time_minutes,
    kafkaResult.estimated_recovery_time_minutes,
    regionResult.estimated_recovery_time_minutes,
  )

  return {
    scenario: 'cascade_failure',
    blast_radius,
    estimated_data_loss_events: totalDataLoss,
    estimated_recovery_time_minutes: maxRecovery * 1.5, // cascade takes longer
    affected_tenants: Math.max(dbResult.affected_tenants, kafkaResult.affected_tenants, regionResult.affected_tenants),
    affected_transactions: Math.max(dbResult.affected_transactions, kafkaResult.affected_transactions, regionResult.affected_transactions),
    mitigation_steps: [
      'Implement bulkhead isolation between DB, Kafka, and region layers',
      'Configure independent circuit breakers for each service dependency',
      'Deploy incident runbooks for cascade scenarios (3+ simultaneous failures)',
      'Establish war-room protocol: designate incident commander on-call',
      ...new Set([...dbResult.mitigation_steps.slice(0, 1), ...kafkaResult.mitigation_steps.slice(0, 1)]),
    ],
    current_resilience_score: Math.min(avgScore, blast_radius === 'critical' ? 20 : 50),
    passed: blast_radius !== 'critical',
  }
}

// ─── Grade calculator ─────────────────────────────────────────────────────────

function computeGrade(results: DrillScenarioResult[]): ChaosDrillReport['overall_grade'] {
  const criticalCount = results.filter(r => r.blast_radius === 'critical' && !r.passed).length
  const failedCount = results.filter(r => !r.passed).length
  const highCount = results.filter(r => r.blast_radius === 'high').length
  const mediumFailedCount = results.filter(r => r.blast_radius === 'medium' && !r.passed).length

  if (criticalCount >= 1) return 'D'
  if (failedCount === 0 && highCount === 0) return 'S'
  if (failedCount === 1 && highCount === 0) return 'A'
  if (highCount >= 1 || mediumFailedCount >= 2) return 'C'
  if (mediumFailedCount >= 1) return 'B'
  return 'A'
}

// ─── runSingleDrillScenario ───────────────────────────────────────────────────

export async function runSingleDrillScenario(
  tenantId: string,
  scenario: DrillScenario,
): Promise<DrillScenarioResult> {
  const snap = await readDrillSnapshot(tenantId)

  switch (scenario) {
    case 'db_shutdown':
      return evalDbShutdown(snap)
    case 'kafka_loss':
      return evalKafkaLoss(snap)
    case 'region_kill':
      return evalRegionKill(snap)
    case 'network_partition':
      return evalNetworkPartition(snap)
    case 'latency_spike':
      return evalLatencySpike(snap)
    case 'ml_corruption':
      return evalMlCorruption(snap)
    case 'cascade_failure': {
      // Cascade uses the other 3 results
      const [db, kafka, region] = await Promise.all([
        Promise.resolve(evalDbShutdown(snap)),
        Promise.resolve(evalKafkaLoss(snap)),
        Promise.resolve(evalRegionKill(snap)),
      ])
      return evalCascadeFailure(db, kafka, region)
    }
    default: {
      const _exhaustive: never = scenario
      throw new Error(`Unknown drill scenario: ${String(_exhaustive)}`)
    }
  }
}

// ─── runChaosDrill ────────────────────────────────────────────────────────────

const ALL_DRILL_SCENARIOS: DrillScenario[] = [
  'db_shutdown',
  'kafka_loss',
  'region_kill',
  'network_partition',
  'latency_spike',
  'ml_corruption',
  'cascade_failure',
]

export async function runChaosDrill(
  tenantId: string,
  opts?: {
    scenarios?: DrillScenario[]
    drill_type?: ChaosDrillReport['drill_type']
  },
): Promise<ChaosDrillReport> {
  const drillType = opts?.drill_type ?? 'manual'
  const scenariosToRun = opts?.scenarios ?? ALL_DRILL_SCENARIOS
  const ran_at = new Date().toISOString()

  log.info('[ChaosDrill] starting drill', {
    tenant_id: tenantId,
    scenarios: scenariosToRun,
    drill_type: drillType,
  })

  // Read snapshot once for all non-cascade scenarios
  const snap = await readDrillSnapshot(tenantId)

  const results: DrillScenarioResult[] = []

  for (const scenario of scenariosToRun) {
    try {
      let result: DrillScenarioResult

      if (scenario === 'cascade_failure') {
        const db = evalDbShutdown(snap)
        const kafka = evalKafkaLoss(snap)
        const region = evalRegionKill(snap)
        result = evalCascadeFailure(db, kafka, region)
      } else {
        switch (scenario) {
          case 'db_shutdown':        result = evalDbShutdown(snap); break
          case 'kafka_loss':         result = evalKafkaLoss(snap); break
          case 'region_kill':        result = evalRegionKill(snap); break
          case 'network_partition':  result = evalNetworkPartition(snap); break
          case 'latency_spike':      result = evalLatencySpike(snap); break
          case 'ml_corruption':      result = evalMlCorruption(snap); break
          default: {
            const _exhaustive: never = scenario
            throw new Error(`Unknown: ${String(_exhaustive)}`)
          }
        }
      }

      results.push(result)
    } catch (err) {
      log.warn('[ChaosDrill] scenario threw', {
        scenario,
        error: err instanceof Error ? err.message : String(err),
      })
      // Push a default failed result
      results.push({
        scenario,
        blast_radius: 'critical',
        estimated_data_loss_events: 0,
        estimated_recovery_time_minutes: 0,
        affected_tenants: 1,
        affected_transactions: 0,
        mitigation_steps: ['Fix drill engine connectivity'],
        current_resilience_score: 0,
        passed: false,
      })
    }
  }

  const overall_grade = computeGrade(results)

  const critical_weaknesses = results
    .filter(r => !r.passed || r.blast_radius === 'critical')
    .map(r => `[${r.scenario}] blast_radius=${r.blast_radius}, score=${r.current_resilience_score}`)

  const recommendations = Array.from(
    new Set(results.flatMap(r => r.mitigation_steps)),
  ).slice(0, 10)

  const reportId = createHash('sha256')
    .update(`${tenantId}:${ran_at}:${drillType}`)
    .digest('hex')
    .slice(0, 36)

  const report: ChaosDrillReport = {
    id: reportId,
    tenant_id: tenantId,
    scenarios_run: scenariosToRun,
    results,
    overall_grade,
    critical_weaknesses,
    recommendations,
    drill_type: drillType,
    ran_at,
  }

  log.info('[ChaosDrill] drill complete', {
    tenant_id: tenantId,
    grade: overall_grade,
    scenarios_run: scenariosToRun.length,
    passed: results.filter(r => r.passed).length,
    failed: results.filter(r => !r.passed).length,
  })

  await persistDrillReport(report)
  return report
}

// ─── Persistence ──────────────────────────────────────────────────────────────

export async function persistDrillReport(report: ChaosDrillReport): Promise<void> {
  const db = supabaseAdmin as any
  void db
    .from('chaos_drill_reports')
    .insert({
      id: report.id,
      tenant_id: report.tenant_id,
      scenarios_run: report.scenarios_run,
      results: report.results,
      overall_grade: report.overall_grade,
      critical_weaknesses: report.critical_weaknesses,
      recommendations: report.recommendations,
      drill_type: report.drill_type,
      ran_at: report.ran_at,
    })
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) log.warn('[ChaosDrill] persistDrillReport failed', { error: error.message, report_id: report.id })
    })
    .catch((e: unknown) => log.warn('[ChaosDrill] persistDrillReport threw', {
      error: e instanceof Error ? e.message : String(e),
      report_id: report.id,
    }))
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getDrillHistory(
  tenantId: string,
  limit = 20,
): Promise<ChaosDrillReport[]> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('chaos_drill_reports')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('ran_at', { ascending: false })
      .limit(limit)

    if (error || !data) return []
    return data as ChaosDrillReport[]
  } catch {
    return []
  }
}
