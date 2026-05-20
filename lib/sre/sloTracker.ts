// Agency Group — SLO Tracker
// lib/sre/sloTracker.ts
// TypeScript strict — 0 errors

import { supabaseAdmin } from '@/lib/supabase'

// ─── In-memory ring buffer per service ───────────────────────────────────────

interface RequestSample {
  success: boolean
  latencyMs: number
  timestamp: number
}

const requestBuffer = new Map<string, RequestSample[]>()

const MAX_BUFFER = 1000
const SLO_TARGET = 99.95

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SloWindow {
  service: string
  windowType: '1m' | '5m' | '1h' | '24h' | '7d' | '30d'
  totalRequests: number
  successfulRequests: number
  p50LatencyMs: number | null
  p95LatencyMs: number | null
  p99LatencyMs: number | null
}

export interface SloMeasurementInput {
  service: string
  windowType: '1m' | '5m' | '1h' | '24h' | '7d' | '30d'
  windowStart: Date
  windowEnd: Date
  totalRequests: number
  successfulRequests: number
  errorRequests: number
  p50LatencyMs: number | null
  p95LatencyMs: number | null
  p99LatencyMs: number | null
}

export interface SloStatus {
  service: string
  current_availability: number
  slo_target: number
  slo_met: boolean
  error_budget_remaining: number
  windows: SloWindow[]
}

// ─── Percentile calculator ────────────────────────────────────────────────────

export function computePercentile(latencies: number[], pct: number): number | null {
  if (latencies.length === 0) return null
  const sorted = [...latencies].sort((a, b) => a - b)
  const idx = Math.ceil((pct / 100) * sorted.length) - 1
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))]
}

// ─── recordRequest ────────────────────────────────────────────────────────────

export async function recordRequest(
  tenantId: string,
  service: string,
  success: boolean,
  latencyMs: number,
): Promise<void> {
  const key = `${tenantId}:${service}`
  const buf = requestBuffer.get(key) ?? []

  buf.push({ success, latencyMs, timestamp: Date.now() })

  if (buf.length > MAX_BUFFER) {
    buf.shift()
  }

  requestBuffer.set(key, buf)

  // Flush to DB every 100 requests (fire-and-forget)
  if (buf.length % 100 === 0) {
    const now = new Date()
    const windowStart = new Date(now.getTime() - 60_000)
    const windowSamples = buf.filter(s => s.timestamp >= windowStart.getTime())
    const successCount = windowSamples.filter(s => s.success).length
    const latencies = windowSamples.map(s => s.latencyMs)

    void persistSloMeasurement(tenantId, {
      service,
      windowType: '1m',
      windowStart,
      windowEnd: now,
      totalRequests: windowSamples.length,
      successfulRequests: successCount,
      errorRequests: windowSamples.length - successCount,
      p50LatencyMs: computePercentile(latencies, 50),
      p95LatencyMs: computePercentile(latencies, 95),
      p99LatencyMs: computePercentile(latencies, 99),
    }).catch(err => console.warn('[SloTracker] persist failed:', err instanceof Error ? err.message : String(err)))
  }
}

// ─── computeSloStatus ─────────────────────────────────────────────────────────

export async function computeSloStatus(
  tenantId: string,
  service: string,
): Promise<SloStatus> {
  const key = `${tenantId}:${service}`
  const buf = requestBuffer.get(key) ?? []
  const now = Date.now()

  // Build windows from buffer
  const WINDOW_DURATIONS: Record<SloWindow['windowType'], number> = {
    '1m':  60_000,
    '5m':  5 * 60_000,
    '1h':  60 * 60_000,
    '24h': 24 * 60 * 60_000,
    '7d':  7 * 24 * 60 * 60_000,
    '30d': 30 * 24 * 60 * 60_000,
  }

  const windows: SloWindow[] = (['1m', '5m', '1h', '24h'] as const).map(windowType => {
    const cutoff = now - WINDOW_DURATIONS[windowType]
    const samples = buf.filter(s => s.timestamp >= cutoff)
    const successCount = samples.filter(s => s.success).length
    const latencies = samples.map(s => s.latencyMs)
    return {
      service,
      windowType,
      totalRequests: samples.length,
      successfulRequests: successCount,
      p50LatencyMs: computePercentile(latencies, 50),
      p95LatencyMs: computePercentile(latencies, 95),
      p99LatencyMs: computePercentile(latencies, 99),
    }
  })

  // Fetch 7d/30d windows from DB
  try {
    const { data: dbRows } = await (supabaseAdmin as any)
      .from('slo_measurements')
      .select('window_type,total_requests,successful_requests,p50_latency_ms,p95_latency_ms,p99_latency_ms')
      .eq('tenant_id', tenantId)
      .eq('service', service)
      .in('window_type', ['7d', '30d'])
      .order('window_start', { ascending: false })
      .limit(2)

    if (dbRows && Array.isArray(dbRows)) {
      for (const row of dbRows as Array<{
        window_type: string
        total_requests: number
        successful_requests: number
        p50_latency_ms: number | null
        p95_latency_ms: number | null
        p99_latency_ms: number | null
      }>) {
        const wt = row.window_type as SloWindow['windowType']
        if (wt === '7d' || wt === '30d') {
          windows.push({
            service,
            windowType: wt,
            totalRequests: row.total_requests,
            successfulRequests: row.successful_requests,
            p50LatencyMs: row.p50_latency_ms,
            p95LatencyMs: row.p95_latency_ms,
            p99LatencyMs: row.p99_latency_ms,
          })
        }
      }
    }
  } catch {
    // DB unavailable — windows from buffer only
  }

  // Current availability from 1h window (or best available)
  const oneHourWindow = windows.find(w => w.windowType === '1h')
  const total = oneHourWindow?.totalRequests ?? 0
  const success = oneHourWindow?.successfulRequests ?? 0
  const current_availability = total > 0 ? (success / total) * 100 : 100

  // Error budget: 30d × (100% - 99.95%) = 21.6 minutes = 1,296,000 ms
  const ERROR_BUDGET_TOTAL_MS = 30 * 24 * 60 * 60 * 1000 * (1 - SLO_TARGET / 100)

  // Estimate consumed from buffer failures
  const failures30d = buf.filter(s => !s.success).length
  // Rough estimate: each failure ~100ms downtime
  const consumed_ms = failures30d * 100
  const error_budget_remaining = Math.max(0, ERROR_BUDGET_TOTAL_MS - consumed_ms)

  return {
    service,
    current_availability: Math.round(current_availability * 1000) / 1000,
    slo_target: SLO_TARGET,
    slo_met: current_availability >= SLO_TARGET,
    error_budget_remaining,
    windows,
  }
}

// ─── persistSloMeasurement ────────────────────────────────────────────────────

export async function persistSloMeasurement(
  tenantId: string,
  measurement: SloMeasurementInput,
): Promise<void> {
  try {
    const { error } = await (supabaseAdmin as any)
      .from('slo_measurements')
      .upsert({
        tenant_id:           tenantId,
        service:             measurement.service,
        window_type:         measurement.windowType,
        window_start:        measurement.windowStart.toISOString(),
        window_end:          measurement.windowEnd.toISOString(),
        total_requests:      measurement.totalRequests,
        successful_requests: measurement.successfulRequests,
        error_requests:      measurement.errorRequests,
        p50_latency_ms:      measurement.p50LatencyMs,
        p95_latency_ms:      measurement.p95LatencyMs,
        p99_latency_ms:      measurement.p99LatencyMs,
        slo_target_pct:      SLO_TARGET,
        computed_at:         new Date().toISOString(),
      }, {
        onConflict: 'tenant_id,service,window_type,window_start',
      })

    if (error) {
      console.warn('[SloTracker] persistSloMeasurement error:', error.message)
    }
  } catch (err) {
    console.warn('[SloTracker] persistSloMeasurement threw:', err instanceof Error ? err.message : String(err))
  }
}
