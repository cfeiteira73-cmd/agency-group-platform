// Agency Group — Statistical Anomaly Detector
// lib/observability/anomalyDetector.ts
// Z-score based anomaly detection per metric. Real-time alerting to anomaly_alerts table.
// TypeScript strict — 0 errors

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseAdmin as any

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnomalyAlert {
  alert_id: string
  tenant_id: string
  metric_name: string
  component: string
  observed_value: number
  baseline_mean: number
  baseline_stddev: number
  z_score: number
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM'
  detected_at: string
  acknowledged: boolean
}

export interface AnomalyDetectionReport {
  tenant_id: string
  generated_at: string
  metrics_analyzed: number
  anomalies_found: number
  alerts: AnomalyAlert[]
  system_anomaly_score: number
}

// ─── computeZScore ────────────────────────────────────────────────────────────

export function computeZScore(value: number, mean: number, stddev: number): number {
  if (stddev === 0) return 0
  return (value - mean) / stddev
}

// ─── Helper: compute mean and stddev from a number array ─────────────────────

function computeStats(values: number[]): { mean: number; stddev: number } {
  if (values.length === 0) return { mean: 0, stddev: 0 }
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance =
    values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length
  return { mean, stddev: Math.sqrt(variance) }
}

// ─── Helper: severity from z-score ───────────────────────────────────────────

function severityFromZ(absZ: number): AnomalyAlert['severity'] | null {
  if (absZ > 3) return 'CRITICAL'
  if (absZ > 2) return 'HIGH'
  if (absZ > 1.5) return 'MEDIUM'
  return null
}

// ─── detectAnomalies ──────────────────────────────────────────────────────────

export async function detectAnomalies(tenantId: string): Promise<AnomalyDetectionReport> {
  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const generatedAt = now.toISOString()

  const alerts: AnomalyAlert[] = []
  let metricsAnalyzed = 0

  // ── Metric 1 & 2: API error rate + query latency from performance_metrics ──

  const [perfRecentRes, perfBaselineRes] = await Promise.all([
    sb
      .from('performance_metrics')
      .select('metric_name, value, component')
      .eq('tenant_id', tenantId)
      .gte('recorded_at', oneHourAgo),

    sb
      .from('performance_metrics')
      .select('metric_name, value, component')
      .eq('tenant_id', tenantId)
      .gte('recorded_at', sevenDaysAgo)
      .lt('recorded_at', oneHourAgo),
  ])

  const perfRecent: Record<string, unknown>[] = perfRecentRes.data ?? []
  const perfBaseline: Record<string, unknown>[] = perfBaselineRes.data ?? []

  // Group by metric_name
  const recentByMetric = new Map<string, { values: number[]; component: string }>()
  const baselineByMetric = new Map<string, number[]>()

  for (const row of perfRecent) {
    const name = row.metric_name as string
    const val = row.value as number
    const comp = (row.component as string) ?? 'api'
    if (!recentByMetric.has(name)) recentByMetric.set(name, { values: [], component: comp })
    recentByMetric.get(name)!.values.push(val)
  }

  for (const row of perfBaseline) {
    const name = row.metric_name as string
    const val = row.value as number
    if (!baselineByMetric.has(name)) baselineByMetric.set(name, [])
    baselineByMetric.get(name)!.push(val)
  }

  for (const [metricName, { values, component }] of recentByMetric) {
    if (!['error_rate', 'api_error_rate', 'query_latency', 'db_latency'].includes(metricName))
      continue
    metricsAnalyzed++

    const baselineVals = baselineByMetric.get(metricName) ?? []
    const { mean, stddev } = computeStats(baselineVals)
    const currentAvg = values.reduce((a, b) => a + b, 0) / values.length
    const z = computeZScore(currentAvg, mean, stddev)
    const absZ = Math.abs(z)
    const severity = severityFromZ(absZ)

    if (severity !== null) {
      alerts.push({
        alert_id: `alert_${metricName}_${Date.now()}`,
        tenant_id: tenantId,
        metric_name: metricName,
        component,
        observed_value: currentAvg,
        baseline_mean: mean,
        baseline_stddev: stddev,
        z_score: z,
        severity,
        detected_at: generatedAt,
        acknowledged: false,
      })
    }
  }

  // ── Metric 3: Deal creation rate ───────────────────────────────────────────

  metricsAnalyzed++

  const [dealsRecentRes, dealsBaselineRes] = await Promise.all([
    sb
      .from('deals')
      .select('id, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', oneHourAgo),

    sb
      .from('deals')
      .select('id, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', sevenDaysAgo)
      .lt('created_at', oneHourAgo),
  ])

  const dealsRecent: Record<string, unknown>[] = dealsRecentRes.data ?? []
  const dealsBaseline: Record<string, unknown>[] = dealsBaselineRes.data ?? []

  // Hourly buckets for baseline
  const hourlyDeals: number[] = []
  const hoursInBaseline = 7 * 24 - 1
  const bucketSize = Math.ceil(dealsBaseline.length / Math.max(hoursInBaseline, 1))
  // Simplified: use total/hours as average per-hour
  const baselineHourlyAvg = dealsBaseline.length / Math.max(hoursInBaseline, 1)
  // Simulate variance: assume stddev = sqrt(mean) (Poisson approximation)
  const dealsBaselineMean = baselineHourlyAvg
  const dealsBaselineStddev = Math.sqrt(Math.max(baselineHourlyAvg, 1))
  void bucketSize // suppress unused warning

  const dealsCurrentCount = dealsRecent.length
  const dealsZ = computeZScore(dealsCurrentCount, dealsBaselineMean, dealsBaselineStddev)
  const dealsAbsZ = Math.abs(dealsZ)
  const dealsSeverity = severityFromZ(dealsAbsZ)

  if (dealsSeverity !== null) {
    alerts.push({
      alert_id: `alert_deal_rate_${Date.now() + 1}`,
      tenant_id: tenantId,
      metric_name: 'deal_creation_rate',
      component: 'crm',
      observed_value: dealsCurrentCount,
      baseline_mean: dealsBaselineMean,
      baseline_stddev: dealsBaselineStddev,
      z_score: dealsZ,
      severity: dealsSeverity,
      detected_at: generatedAt,
      acknowledged: false,
    })
  }

  // ── Metric 4: Match score distribution ────────────────────────────────────

  metricsAnalyzed++

  const [matchesRecentRes, matchesBaselineRes] = await Promise.all([
    sb
      .from('matches')
      .select('score')
      .eq('tenant_id', tenantId)
      .gte('created_at', oneHourAgo)
      .limit(500),

    sb
      .from('matches')
      .select('score')
      .eq('tenant_id', tenantId)
      .gte('created_at', sevenDaysAgo)
      .lt('created_at', oneHourAgo)
      .limit(5000),
  ])

  const matchesRecent: { score: number }[] = (matchesRecentRes.data ?? []) as { score: number }[]
  const matchesBaseline: { score: number }[] = (matchesBaselineRes.data ?? []) as {
    score: number
  }[]

  if (matchesBaseline.length > 0 && matchesRecent.length > 0) {
    const baselineScores = matchesBaseline.map(m => m.score).filter(s => typeof s === 'number')
    const recentAvgScore =
      matchesRecent.reduce((a, m) => a + (m.score ?? 0), 0) / matchesRecent.length

    const { mean: matchMean, stddev: matchStddev } = computeStats(baselineScores)
    const matchZ = computeZScore(recentAvgScore, matchMean, matchStddev)
    const matchSeverity = severityFromZ(Math.abs(matchZ))

    if (matchSeverity !== null) {
      alerts.push({
        alert_id: `alert_match_score_${Date.now() + 2}`,
        tenant_id: tenantId,
        metric_name: 'match_score_avg',
        component: 'ml',
        observed_value: recentAvgScore,
        baseline_mean: matchMean,
        baseline_stddev: matchStddev,
        z_score: matchZ,
        severity: matchSeverity,
        detected_at: generatedAt,
        acknowledged: false,
      })
    }
  }

  // ── Metric 5: Auth failure rate ────────────────────────────────────────────

  metricsAnalyzed++

  const [authRecentRes, authBaselineRes] = await Promise.all([
    sb
      .from('siem_events')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('action', 'auth_failure')
      .gte('created_at', oneHourAgo),

    sb
      .from('siem_events')
      .select('id, created_at')
      .eq('tenant_id', tenantId)
      .eq('action', 'auth_failure')
      .gte('created_at', sevenDaysAgo)
      .lt('created_at', oneHourAgo),
  ])

  const authRecentCount: number = (authRecentRes.data ?? []).length
  const authBaselineRows: Record<string, unknown>[] = authBaselineRes.data ?? []
  const authBaselineHours = Math.max((7 * 24 - 1), 1)
  const authBaselineHourlyAvg = authBaselineRows.length / authBaselineHours
  const authBaselineStddev = Math.sqrt(Math.max(authBaselineHourlyAvg, 1))

  const authZ = computeZScore(authRecentCount, authBaselineHourlyAvg, authBaselineStddev)
  const authSeverity = severityFromZ(Math.abs(authZ))

  if (authSeverity !== null) {
    alerts.push({
      alert_id: `alert_auth_failure_${Date.now() + 3}`,
      tenant_id: tenantId,
      metric_name: 'auth_failure_rate',
      component: 'auth',
      observed_value: authRecentCount,
      baseline_mean: authBaselineHourlyAvg,
      baseline_stddev: authBaselineStddev,
      z_score: authZ,
      severity: authSeverity,
      detected_at: generatedAt,
      acknowledged: false,
    })
  }

  // ── Persist new alerts (fire-and-forget) ──────────────────────────────────

  if (alerts.length > 0) {
    void sb
      .from('anomaly_alerts')
      .insert(
        alerts.map(a => ({
          tenant_id: a.tenant_id,
          alert_id: a.alert_id,
          metric_name: a.metric_name,
          component: a.component,
          observed_value: a.observed_value,
          baseline_mean: a.baseline_mean,
          baseline_stddev: a.baseline_stddev,
          z_score: a.z_score,
          severity: a.severity,
          detected_at: a.detected_at,
          acknowledged: false,
        }))
      )
      .then(({ error }: { error: unknown }) => {
        if (error) log.info('[anomalyDetector] persist warn', { error })
      })
      .catch((e: unknown) => console.warn('[anomalyDetector]', e))
  }

  // System anomaly score: average of abs z-scores, capped at 10, normalized to 0-1
  const systemAnomalyScore =
    alerts.length > 0
      ? Math.min(alerts.reduce((a, b) => a + Math.abs(b.z_score), 0) / alerts.length / 10, 1.0)
      : 0

  return {
    tenant_id: tenantId,
    generated_at: generatedAt,
    metrics_analyzed: metricsAnalyzed,
    anomalies_found: alerts.length,
    alerts,
    system_anomaly_score: systemAnomalyScore,
  }
}
