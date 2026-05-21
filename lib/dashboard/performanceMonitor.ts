// Agency Group — Dashboard Performance Monitor
// lib/dashboard/performanceMonitor.ts
// TypeScript strict — 0 errors
//
// Tracks and aggregates portal performance metrics:
// API latency by endpoint, DB query efficiency, bundle size awareness.
// All metrics stored in performance_metrics table for trending.

import { supabaseAdmin } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PerformanceMetric {
  metric_id: string
  tenant_id: string
  endpoint: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  response_time_ms: number
  status_code: number
  db_queries_count: number | null
  cache_hit: boolean
  measured_at: string
}

export interface PerformanceReport {
  report_id: string
  tenant_id: string
  period_hours: number // last N hours analyzed

  by_endpoint: {
    endpoint: string
    call_count: number
    avg_response_ms: number
    p95_response_ms: number
    error_rate_pct: number
    slowest_calls: number // calls > 2000ms
  }[]

  overall: {
    total_calls: number
    avg_response_ms: number
    p95_response_ms: number
    error_rate_pct: number
    calls_per_hour: number
    slow_endpoints: string[] // endpoints with avg > 1000ms
    fast_endpoints: string[] // endpoints with avg < 100ms
  }

  db_efficiency: {
    estimated_slow_queries: number // API calls > 500ms (proxy for slow DB)
    cache_hit_rate_pct: number
    efficiency_score: number // 0–100
  }

  performance_grade: 'EXCELLENT' | 'GOOD' | 'DEGRADED' | 'CRITICAL'
  recommendations: string[]

  generated_at: string
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function percentile(sorted: number[], pct: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.ceil((pct / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

function generateReportId(): string {
  return `rpt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

// ---------------------------------------------------------------------------
// recordMetric — fire-and-forget insert into performance_metrics
// ---------------------------------------------------------------------------

export async function recordMetric(
  metric: Omit<PerformanceMetric, 'metric_id' | 'measured_at'>
): Promise<void> {
  try {
    await (supabaseAdmin as any)
      .from('performance_metrics')
      .insert({
        tenant_id: metric.tenant_id,
        endpoint: metric.endpoint,
        method: metric.method,
        response_time_ms: metric.response_time_ms,
        status_code: metric.status_code,
        db_queries_count: metric.db_queries_count ?? null,
        cache_hit: metric.cache_hit,
      })
  } catch {
    // Fire-and-forget — never throw
  }
}

// ---------------------------------------------------------------------------
// getSlowEndpoints — returns endpoints with avg response > thresholdMs
// ---------------------------------------------------------------------------

export async function getSlowEndpoints(
  tenantId: string,
  thresholdMs = 1000
): Promise<string[]> {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await (supabaseAdmin as any)
      .from('performance_metrics')
      .select('endpoint, response_time_ms')
      .eq('tenant_id', tenantId)
      .gte('measured_at', since)

    if (error || !data) return []

    const rows = data as { endpoint: string; response_time_ms: number }[]

    // Group by endpoint
    const byEndpoint = new Map<string, number[]>()
    for (const row of rows) {
      const arr = byEndpoint.get(row.endpoint) ?? []
      arr.push(row.response_time_ms)
      byEndpoint.set(row.endpoint, arr)
    }

    const slow: string[] = []
    for (const [endpoint, times] of byEndpoint) {
      const avg = times.reduce((a, b) => a + b, 0) / times.length
      if (avg > thresholdMs) slow.push(endpoint)
    }

    return slow
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// computePerformanceGrade
// ---------------------------------------------------------------------------

export function computePerformanceGrade(
  overall: PerformanceReport['overall']
): PerformanceReport['performance_grade'] {
  const { avg_response_ms, error_rate_pct } = overall

  if (avg_response_ms < 200 && error_rate_pct < 1) return 'EXCELLENT'
  if (avg_response_ms < 500 && error_rate_pct < 5) return 'GOOD'
  if (avg_response_ms >= 1000 || error_rate_pct >= 10) return 'CRITICAL'
  return 'DEGRADED'
}

// ---------------------------------------------------------------------------
// generatePerformanceReport — aggregates from performance_metrics table
// ---------------------------------------------------------------------------

export async function generatePerformanceReport(
  tenantId: string,
  periodHours = 24
): Promise<PerformanceReport> {
  const since = new Date(Date.now() - periodHours * 60 * 60 * 1000).toISOString()

  let rows: PerformanceMetric[] = []

  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('performance_metrics')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('measured_at', since)
      .order('measured_at', { ascending: true })

    if (!error && data) {
      rows = data as PerformanceMetric[]
    }
  } catch {
    // Fall through with empty rows — report still generated with zeros
  }

  // ── Group by endpoint ────────────────────────────────────────────────────
  const endpointMap = new Map<string, PerformanceMetric[]>()
  for (const row of rows) {
    const arr = endpointMap.get(row.endpoint) ?? []
    arr.push(row)
    endpointMap.set(row.endpoint, arr)
  }

  const by_endpoint = Array.from(endpointMap.entries()).map(([endpoint, metrics]) => {
    const times = metrics.map((m) => m.response_time_ms).sort((a, b) => a - b)
    const errors = metrics.filter((m) => m.status_code >= 500).length
    const slowest_calls = metrics.filter((m) => m.response_time_ms > 2000).length
    const avg_response_ms =
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0
    const p95_response_ms = Math.round(percentile(times, 95))
    const error_rate_pct =
      metrics.length > 0 ? Math.round((errors / metrics.length) * 100 * 10) / 10 : 0

    return {
      endpoint,
      call_count: metrics.length,
      avg_response_ms,
      p95_response_ms,
      error_rate_pct,
      slowest_calls,
    }
  })

  // ── Overall stats ────────────────────────────────────────────────────────
  const allTimes = rows.map((r) => r.response_time_ms).sort((a, b) => a - b)
  const totalErrors = rows.filter((r) => r.status_code >= 500).length
  const totalCalls = rows.length
  const avg_response_ms =
    allTimes.length > 0
      ? Math.round(allTimes.reduce((a, b) => a + b, 0) / allTimes.length)
      : 0
  const p95_response_ms = Math.round(percentile(allTimes, 95))
  const error_rate_pct =
    totalCalls > 0 ? Math.round((totalErrors / totalCalls) * 100 * 10) / 10 : 0
  const calls_per_hour = Math.round(totalCalls / Math.max(periodHours, 1))

  const slow_endpoints = by_endpoint
    .filter((e) => e.avg_response_ms > 1000)
    .map((e) => e.endpoint)

  const fast_endpoints = by_endpoint
    .filter((e) => e.avg_response_ms < 100 && e.call_count > 0)
    .map((e) => e.endpoint)

  const overall: PerformanceReport['overall'] = {
    total_calls: totalCalls,
    avg_response_ms,
    p95_response_ms,
    error_rate_pct,
    calls_per_hour,
    slow_endpoints,
    fast_endpoints,
  }

  // ── DB efficiency ────────────────────────────────────────────────────────
  const estimated_slow_queries = rows.filter((r) => r.response_time_ms > 500).length
  const cacheHits = rows.filter((r) => r.cache_hit).length
  const cache_hit_rate_pct =
    totalCalls > 0 ? Math.round((cacheHits / totalCalls) * 100 * 10) / 10 : 0

  // Efficiency score: penalise slow queries and low cache hit rate
  const slowPenalty = totalCalls > 0 ? (estimated_slow_queries / totalCalls) * 50 : 0
  const cachePenalty = Math.max(0, (50 - cache_hit_rate_pct) * 0.5)
  const efficiency_score = Math.round(Math.max(0, 100 - slowPenalty - cachePenalty))

  const db_efficiency: PerformanceReport['db_efficiency'] = {
    estimated_slow_queries,
    cache_hit_rate_pct,
    efficiency_score,
  }

  // ── Recommendations ──────────────────────────────────────────────────────
  const recommendations: string[] = []
  if (avg_response_ms > 1000)
    recommendations.push('Consider adding DB indexes or response caching')
  if (error_rate_pct > 5)
    recommendations.push('Investigate error patterns in slow endpoints')
  if (cache_hit_rate_pct < 50)
    recommendations.push('Implement response caching for read-heavy endpoints')
  if (slow_endpoints.length > 0)
    recommendations.push(
      `Optimize slow endpoints: ${slow_endpoints.slice(0, 3).join(', ')}`
    )
  if (recommendations.length === 0)
    recommendations.push('Performance is healthy — no immediate action required')

  const performance_grade = computePerformanceGrade(overall)

  // ── Persist report ───────────────────────────────────────────────────────
  const report: PerformanceReport = {
    report_id: generateReportId(),
    tenant_id: tenantId,
    period_hours: periodHours,
    by_endpoint,
    overall,
    db_efficiency,
    performance_grade,
    recommendations,
    generated_at: new Date().toISOString(),
  }

  try {
    await (supabaseAdmin as any).from('performance_reports').insert({
      tenant_id: tenantId,
      period_hours: periodHours,
      by_endpoint,
      overall,
      db_efficiency,
      performance_grade,
      recommendations,
    })
  } catch {
    // Fire-and-forget persistence
  }

  return report
}
