// AGENCY GROUP — SH-ROS | AMI: 22506
// lib/observability/controlPlaneEngine.ts
// Real-time system performance dashboard aggregator — Control Plane
// Wave 44 Agent 4 — Advanced Observability + Control Plane
// =============================================================================

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { logger as log } from '@/lib/observability/logger'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SystemPerformanceSnapshot {
  snapshot_id: string
  tenant_id: string
  captured_at: string

  // API performance
  api_p50_ms: number
  api_p95_ms: number
  api_p99_ms: number
  api_error_rate_pct: number

  // Supply pipeline
  supply_ingestion_rate_per_hour: number
  supply_last_ingest_minutes_ago: number
  supply_active_connectors: number

  // Capital
  capital_pipeline_active_count: number
  capital_avg_stage_duration_hours: number
  escrow_total_held_cents: bigint

  // ML
  ml_drift_score: number
  ml_last_trained_hours_ago: number
  ml_prediction_accuracy: number

  // Opportunities
  opportunities_generated_24h: number
  opportunities_avg_score: number
  matches_sent_24h: number

  // Health composite
  system_health_score: number
  degraded_services: string[]
  active_anomalies: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0
  const idx = Math.ceil((sortedValues.length * p) / 100) - 1
  return sortedValues[Math.max(0, idx)]
}

function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  return p.catch((e) => {
    log.warn('[controlPlaneEngine] metric fetch failed, using fallback', { err: String(e) })
    return fallback
  })
}

// ─── Individual metric fetchers ───────────────────────────────────────────────

async function fetchApiPercentiles(tenantId: string) {
  try {
    const since = new Date(Date.now() - 3_600_000).toISOString()
    const { data } = await (supabaseAdmin as any)
      .from('trace_spans')
      .select('duration_ms, status')
      .eq('tenant_id', tenantId)
      .gte('started_at', since)
      .not('duration_ms', 'is', null)

    const rows = (data ?? []) as Array<{ duration_ms: number; status: string }>
    if (rows.length === 0) return { p50: 0, p95: 0, p99: 0, error_rate_pct: 0 }

    const durations = rows.map((r) => r.duration_ms).sort((a, b) => a - b)
    const failed = rows.filter((r) => r.status === 'FAILED').length

    return {
      p50: percentile(durations, 50),
      p95: percentile(durations, 95),
      p99: percentile(durations, 99),
      error_rate_pct: Math.round((failed / rows.length) * 1000) / 10,
    }
  } catch {
    return { p50: 0, p95: 0, p99: 0, error_rate_pct: 0 }
  }
}

async function fetchSupplyMetrics(tenantId: string) {
  try {
    const hourAgo = new Date(Date.now() - 3_600_000).toISOString()

    const [rateResult, lastIngestResult, connectorResult] = await Promise.allSettled([
      (supabaseAdmin as any)
        .from('raw_opportunity_stream')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('created_at', hourAgo),
      (supabaseAdmin as any)
        .from('ingestion_runs')
        .select('run_at')
        .eq('tenant_id', tenantId)
        .order('run_at', { ascending: false })
        .limit(1)
        .single(),
      (supabaseAdmin as any)
        .from('ingestion_runs')
        .select('provider')
        .eq('tenant_id', tenantId)
        .gte('run_at', hourAgo),
    ])

    const ingestionRate =
      rateResult.status === 'fulfilled' ? (rateResult.value.count ?? 0) : 0

    let lastIngestMinutesAgo = 9999
    if (lastIngestResult.status === 'fulfilled' && lastIngestResult.value.data?.run_at) {
      const runAt = new Date(lastIngestResult.value.data.run_at).getTime()
      lastIngestMinutesAgo = Math.round((Date.now() - runAt) / 60_000)
    }

    let activeConnectors = 0
    if (connectorResult.status === 'fulfilled' && connectorResult.value.data) {
      const rows = connectorResult.value.data as Array<{ provider: string }>
      activeConnectors = new Set(rows.map((r) => r.provider)).size
    }

    return {
      ingestion_rate_per_hour: ingestionRate,
      last_ingest_minutes_ago: lastIngestMinutesAgo,
      active_connectors: activeConnectors,
    }
  } catch {
    return { ingestion_rate_per_hour: 0, last_ingest_minutes_ago: 9999, active_connectors: 0 }
  }
}

async function fetchCapitalMetrics(tenantId: string) {
  try {
    const [pipelineResult, escrowResult] = await Promise.allSettled([
      (supabaseAdmin as any)
        .from('capital_execution_pipelines')
        .select('id, created_at', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .neq('status', 'COMPLETED'),
      (supabaseAdmin as any)
        .from('escrow_positions')
        .select('amount_cents')
        .eq('tenant_id', tenantId)
        .eq('status', 'IN_ESCROW'),
    ])

    const pipelineCount =
      pipelineResult.status === 'fulfilled' ? (pipelineResult.value.count ?? 0) : 0

    let escrowTotal = BigInt(0)
    if (escrowResult.status === 'fulfilled' && escrowResult.value.data) {
      const rows = escrowResult.value.data as Array<{ amount_cents: string | number }>
      escrowTotal = rows.reduce((s, r) => s + BigInt(r.amount_cents ?? 0), BigInt(0))
    }

    return {
      pipeline_active_count: pipelineCount,
      avg_stage_duration_hours: 0, // computed from events if available
      escrow_total_held_cents: escrowTotal,
    }
  } catch {
    return { pipeline_active_count: 0, avg_stage_duration_hours: 0, escrow_total_held_cents: BigInt(0) }
  }
}

async function fetchMlMetrics(tenantId: string) {
  try {
    const { data } = await (supabaseAdmin as any)
      .from('ml_reality_alignments')
      .select('drift_score, trained_at, prediction_accuracy')
      .eq('tenant_id', tenantId)
      .order('trained_at', { ascending: false })
      .limit(1)
      .single()

    if (!data) return { drift_score: 0, last_trained_hours_ago: 9999, prediction_accuracy: 0 }

    const row = data as { drift_score?: number; trained_at?: string; prediction_accuracy?: number }
    const trainedHoursAgo = row.trained_at
      ? Math.round((Date.now() - new Date(row.trained_at).getTime()) / 3_600_000)
      : 9999

    return {
      drift_score: row.drift_score ?? 0,
      last_trained_hours_ago: trainedHoursAgo,
      prediction_accuracy: row.prediction_accuracy ?? 0,
    }
  } catch {
    return { drift_score: 0, last_trained_hours_ago: 9999, prediction_accuracy: 0 }
  }
}

async function fetchOpportunityMetrics(tenantId: string) {
  try {
    const since24h = new Date(Date.now() - 86_400_000).toISOString()

    const [countResult, avgResult, matchResult] = await Promise.allSettled([
      (supabaseAdmin as any)
        .from('opportunity_scores')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('created_at', since24h),
      (supabaseAdmin as any)
        .from('opportunity_scores')
        .select('score')
        .eq('tenant_id', tenantId)
        .gte('created_at', since24h),
      (supabaseAdmin as any)
        .from('investor_matches')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('created_at', since24h),
    ])

    const generated24h =
      countResult.status === 'fulfilled' ? (countResult.value.count ?? 0) : 0

    let avgScore = 0
    if (avgResult.status === 'fulfilled' && avgResult.value.data) {
      const rows = avgResult.value.data as Array<{ score: number }>
      if (rows.length > 0) {
        avgScore = rows.reduce((s, r) => s + Number(r.score), 0) / rows.length
      }
    }

    const matchesSent24h =
      matchResult.status === 'fulfilled' ? (matchResult.value.count ?? 0) : 0

    return {
      opportunities_generated_24h: generated24h,
      opportunities_avg_score: Math.round(avgScore * 100) / 100,
      matches_sent_24h: matchesSent24h,
    }
  } catch {
    return { opportunities_generated_24h: 0, opportunities_avg_score: 0, matches_sent_24h: 0 }
  }
}

async function fetchActiveAnomaliesCount(tenantId: string): Promise<number> {
  try {
    const { count } = await (supabaseAdmin as any)
      .from('anomaly_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('resolved_at', null)

    return count ?? 0
  } catch {
    return 0
  }
}

// ─── Health scoring ───────────────────────────────────────────────────────────

function computeHealthScore(
  activeAnomalies: number,
  apiErrorRate: number,
  supplyLastIngestMin: number,
  mlDriftScore: number
): { score: number; degraded: string[] } {
  let score = 100
  const degraded: string[] = []

  // Anomaly penalty: -10 per anomaly (min 0)
  const anomalyPenalty = Math.min(100, activeAnomalies * 10)
  score -= anomalyPenalty
  if (activeAnomalies > 0) degraded.push('anomaly-detected')

  // API error rate
  if (apiErrorRate >= 5) {
    score -= 20
    degraded.push('api-high-error-rate')
  } else if (apiErrorRate >= 1) {
    score -= 10
  }

  // Supply freshness
  if (supplyLastIngestMin <= 60) {
    score += 0 // healthy, no bonus needed (score starts at 100)
  } else {
    score -= 20
    degraded.push('supply-stale')
  }

  // ML drift
  if (mlDriftScore >= 0.1) {
    score -= 20
    degraded.push('ml-drift-detected')
  }

  return { score: Math.max(0, Math.min(100, score)), degraded }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Capture a full performance snapshot for the given tenant.
 * All sub-queries run in parallel with individual error isolation.
 */
export async function capturePerformanceSnapshot(
  tenantId: string
): Promise<SystemPerformanceSnapshot> {
  const snapshotId = randomUUID()
  const capturedAt = new Date().toISOString()

  const [apiMetrics, supplyMetrics, capitalMetrics, mlMetrics, oppMetrics, activeAnomalies] =
    await Promise.all([
      safe(fetchApiPercentiles(tenantId), { p50: 0, p95: 0, p99: 0, error_rate_pct: 0 }),
      safe(fetchSupplyMetrics(tenantId), {
        ingestion_rate_per_hour: 0,
        last_ingest_minutes_ago: 9999,
        active_connectors: 0,
      }),
      safe(fetchCapitalMetrics(tenantId), {
        pipeline_active_count: 0,
        avg_stage_duration_hours: 0,
        escrow_total_held_cents: BigInt(0),
      }),
      safe(fetchMlMetrics(tenantId), {
        drift_score: 0,
        last_trained_hours_ago: 9999,
        prediction_accuracy: 0,
      }),
      safe(fetchOpportunityMetrics(tenantId), {
        opportunities_generated_24h: 0,
        opportunities_avg_score: 0,
        matches_sent_24h: 0,
      }),
      safe(fetchActiveAnomaliesCount(tenantId), 0),
    ])

  const { score: system_health_score, degraded: degraded_services } = computeHealthScore(
    activeAnomalies,
    apiMetrics.error_rate_pct,
    supplyMetrics.last_ingest_minutes_ago,
    mlMetrics.drift_score
  )

  const snapshot: SystemPerformanceSnapshot = {
    snapshot_id: snapshotId,
    tenant_id: tenantId,
    captured_at: capturedAt,

    api_p50_ms: apiMetrics.p50,
    api_p95_ms: apiMetrics.p95,
    api_p99_ms: apiMetrics.p99,
    api_error_rate_pct: apiMetrics.error_rate_pct,

    supply_ingestion_rate_per_hour: supplyMetrics.ingestion_rate_per_hour,
    supply_last_ingest_minutes_ago: supplyMetrics.last_ingest_minutes_ago,
    supply_active_connectors: supplyMetrics.active_connectors,

    capital_pipeline_active_count: capitalMetrics.pipeline_active_count,
    capital_avg_stage_duration_hours: capitalMetrics.avg_stage_duration_hours,
    escrow_total_held_cents: capitalMetrics.escrow_total_held_cents,

    ml_drift_score: mlMetrics.drift_score,
    ml_last_trained_hours_ago: mlMetrics.last_trained_hours_ago,
    ml_prediction_accuracy: mlMetrics.prediction_accuracy,

    opportunities_generated_24h: oppMetrics.opportunities_generated_24h,
    opportunities_avg_score: oppMetrics.opportunities_avg_score,
    matches_sent_24h: oppMetrics.matches_sent_24h,

    system_health_score,
    degraded_services,
    active_anomalies: activeAnomalies,
  }

  // Persist snapshot — fire-and-forget
  void (supabaseAdmin as any)
    .from('performance_snapshots')
    .insert({
      snapshot_id: snapshotId,
      tenant_id: tenantId,
      captured_at: capturedAt,
      api_p50_ms: snapshot.api_p50_ms,
      api_p95_ms: snapshot.api_p95_ms,
      api_p99_ms: snapshot.api_p99_ms,
      api_error_rate_pct: snapshot.api_error_rate_pct,
      supply_ingestion_rate_per_hour: snapshot.supply_ingestion_rate_per_hour,
      supply_last_ingest_minutes_ago: snapshot.supply_last_ingest_minutes_ago,
      supply_active_connectors: snapshot.supply_active_connectors,
      capital_pipeline_active_count: snapshot.capital_pipeline_active_count,
      capital_avg_stage_duration_hours: snapshot.capital_avg_stage_duration_hours,
      escrow_total_held_cents: snapshot.escrow_total_held_cents.toString(),
      ml_drift_score: snapshot.ml_drift_score,
      ml_last_trained_hours_ago: snapshot.ml_last_trained_hours_ago,
      ml_prediction_accuracy: snapshot.ml_prediction_accuracy,
      opportunities_generated_24h: snapshot.opportunities_generated_24h,
      opportunities_avg_score: snapshot.opportunities_avg_score,
      matches_sent_24h: snapshot.matches_sent_24h,
      system_health_score: snapshot.system_health_score,
      degraded_services: snapshot.degraded_services,
      active_anomalies: snapshot.active_anomalies,
    })
    .catch((e: unknown) =>
      console.warn('[controlPlaneEngine] snapshot persist failed:', e)
    )

  return snapshot
}

/**
 * Return a series of recent performance snapshots for a tenant.
 */
export async function getPerformanceTrend(
  tenantId: string,
  hours = 24
): Promise<SystemPerformanceSnapshot[]> {
  try {
    const since = new Date(Date.now() - hours * 3_600_000).toISOString()

    const { data, error } = await (supabaseAdmin as any)
      .from('performance_snapshots')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('captured_at', since)
      .order('captured_at', { ascending: false })

    if (error) {
      log.warn('[controlPlaneEngine] getPerformanceTrend error', { err: error })
      return []
    }

    // Convert escrow bigint from string stored in DB
    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      ...row,
      escrow_total_held_cents: BigInt((row.escrow_total_held_cents as string | number) ?? 0),
    })) as SystemPerformanceSnapshot[]
  } catch (e) {
    log.warn('[controlPlaneEngine] getPerformanceTrend exception', { err: String(e) })
    return []
  }
}
