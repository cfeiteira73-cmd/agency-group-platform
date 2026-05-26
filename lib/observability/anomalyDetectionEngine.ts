// AGENCY GROUP — SH-ROS | AMI: 22506
// lib/observability/anomalyDetectionEngine.ts
// Z-score based anomaly detection with 7-day rolling baseline
// Wave 44 Agent 4 — Advanced Observability + Control Plane
// =============================================================================

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { logger as log } from '@/lib/observability/logger'

// ─── Types ───────────────────────────────────────────────────────────────────

export type MetricName =
  | 'api_response_ms'
  | 'supply_ingestion_count'
  | 'opportunity_score_avg'
  | 'capital_flow_cents'
  | 'match_count'
  | 'deal_close_rate'
  | 'error_rate_pct'
  | 'escrow_balance_cents'

export type AnomalyLevel = 'NORMAL' | 'WATCH' | 'WARNING' | 'CRITICAL'

export interface MetricDataPoint {
  metric_name: MetricName
  value: number
  tenant_id: string
  recorded_at: string
}

export interface AnomalyAlert {
  alert_id: string
  tenant_id: string
  metric_name: MetricName
  observed_value: number
  baseline_mean: number
  baseline_stddev: number
  z_score: number
  level: AnomalyLevel
  detected_at: string
  resolved_at: string | null
  description: string
}

// ─── All known metric names ───────────────────────────────────────────────────

const ALL_METRIC_NAMES: MetricName[] = [
  'api_response_ms',
  'supply_ingestion_count',
  'opportunity_score_avg',
  'capital_flow_cents',
  'match_count',
  'deal_close_rate',
  'error_rate_pct',
  'escrow_balance_cents',
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeStddev(values: number[], mean: number): number {
  if (values.length < 2) return 0
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length
  return Math.sqrt(variance)
}

function zScoreLevel(absZ: number): AnomalyLevel {
  if (absZ > 4) return 'CRITICAL'
  if (absZ > 3) return 'WARNING'
  if (absZ > 2) return 'WATCH'
  return 'NORMAL'
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Record a metric data point. Fire-and-forget — never throws.
 */
export function recordMetric(metricName: MetricName, value: number, tenantId: string): void {
  void (supabaseAdmin as any)
    .from('metric_datapoints')
    .insert({
      tenant_id: tenantId,
      metric_name: metricName,
      value,
      recorded_at: new Date().toISOString(),
    })
    .catch((e: unknown) => console.warn('[anomalyDetectionEngine] recordMetric failed:', e))
}

/**
 * Compute the rolling baseline (mean + stddev) for a metric.
 */
export async function computeBaseline(
  metricName: MetricName,
  tenantId: string,
  windowDays = 7
): Promise<{ mean: number; stddev: number; sample_count: number }> {
  try {
    const since = new Date(Date.now() - windowDays * 86_400_000).toISOString()

    const { data, error } = await (supabaseAdmin as any)
      .from('metric_datapoints')
      .select('value')
      .eq('tenant_id', tenantId)
      .eq('metric_name', metricName)
      .gte('recorded_at', since)

    if (error) {
      log.warn('[anomalyDetectionEngine] computeBaseline error', { err: error })
      return { mean: 0, stddev: 0, sample_count: 0 }
    }

    const rows = (data ?? []) as Array<{ value: number }>
    if (rows.length === 0) return { mean: 0, stddev: 0, sample_count: 0 }

    const values = rows.map((r) => Number(r.value))
    const mean = values.reduce((s, v) => s + v, 0) / values.length
    const stddev = computeStddev(values, mean)

    return { mean, stddev, sample_count: values.length }
  } catch (e) {
    log.warn('[anomalyDetectionEngine] computeBaseline exception', { err: String(e) })
    return { mean: 0, stddev: 0, sample_count: 0 }
  }
}

/**
 * Detect anomaly for a current observed value against the 7-day baseline.
 * Returns null if insufficient data or the value is NORMAL.
 */
export async function detectAnomaly(
  metricName: MetricName,
  currentValue: number,
  tenantId: string
): Promise<AnomalyAlert | null> {
  try {
    const baseline = await computeBaseline(metricName, tenantId)

    if (baseline.sample_count < 10) return null

    const z_score = (currentValue - baseline.mean) / (baseline.stddev || 1)
    const level = zScoreLevel(Math.abs(z_score))

    if (level === 'NORMAL') return null

    const alertId = randomUUID()
    const detectedAt = new Date().toISOString()
    const description = `Metric "${metricName}" z-score ${z_score.toFixed(2)} (observed=${currentValue}, mean=${baseline.mean.toFixed(2)}, stddev=${baseline.stddev.toFixed(2)}) — level: ${level}`

    const alert: AnomalyAlert = {
      alert_id: alertId,
      tenant_id: tenantId,
      metric_name: metricName,
      observed_value: currentValue,
      baseline_mean: baseline.mean,
      baseline_stddev: baseline.stddev,
      z_score,
      level,
      detected_at: detectedAt,
      resolved_at: null,
      description,
    }

    void (supabaseAdmin as any)
      .from('anomaly_alerts')
      .insert({
        alert_id: alertId,
        tenant_id: tenantId,
        metric_name: metricName,
        observed_value: currentValue,
        baseline_mean: baseline.mean,
        baseline_stddev: baseline.stddev,
        z_score,
        level,
        detected_at: detectedAt,
        description,
      })
      .catch((e: unknown) => console.warn('[anomalyDetectionEngine] detectAnomaly insert failed:', e))

    return alert
  } catch (e) {
    log.warn('[anomalyDetectionEngine] detectAnomaly exception', { err: String(e) })
    return null
  }
}

/**
 * Scan all metrics for the given tenant and return any anomalies found.
 */
export async function runFullAnomalyScan(
  tenantId: string
): Promise<{ scanned: number; anomalies: AnomalyAlert[] }> {
  const anomalies: AnomalyAlert[] = []

  for (const metricName of ALL_METRIC_NAMES) {
    try {
      // Get the latest recorded value for this metric
      const { data } = await (supabaseAdmin as any)
        .from('metric_datapoints')
        .select('value')
        .eq('tenant_id', tenantId)
        .eq('metric_name', metricName)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .single()

      if (!data) continue

      const latestValue = Number((data as { value: number }).value)
      const alert = await detectAnomaly(metricName, latestValue, tenantId)
      if (alert) anomalies.push(alert)
    } catch (_) {
      // Silently skip metrics with no data
    }
  }

  return { scanned: ALL_METRIC_NAMES.length, anomalies }
}

/**
 * Mark an anomaly alert as resolved. Fire-and-forget.
 */
export async function resolveAnomaly(alertId: string): Promise<void> {
  void (supabaseAdmin as any)
    .from('anomaly_alerts')
    .update({ resolved_at: new Date().toISOString() })
    .eq('alert_id', alertId)
    .catch((e: unknown) => console.warn('[anomalyDetectionEngine] resolveAnomaly failed:', e))
}

/**
 * Return all unresolved anomaly alerts for a tenant.
 */
export async function getActiveAlerts(tenantId: string): Promise<AnomalyAlert[]> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('anomaly_alerts')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('resolved_at', null)
      .order('detected_at', { ascending: false })

    if (error) {
      log.warn('[anomalyDetectionEngine] getActiveAlerts error', { err: error })
      return []
    }

    return (data ?? []) as AnomalyAlert[]
  } catch (e) {
    log.warn('[anomalyDetectionEngine] getActiveAlerts exception', { err: String(e) })
    return []
  }
}
