// AGENCY GROUP — SH-ROS Observability: Latency Heatmap + p50/p95/p99 | AMI: 22506
// Phase Ω∞-6: World-class observability — workflow latency percentiles
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import logger from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LatencyPercentiles {
  p50: number
  p75: number
  p95: number
  p99: number
  p999: number
  min: number
  max: number
  avg: number
  count: number
}

export interface WorkflowLatencyProfile {
  workflow_id: string
  org_id: string
  period_hours: number
  percentiles: LatencyPercentiles
  slo_breach_pct: number   // % of runs exceeding SLO
  slo_target_ms: number
  trend: 'improving' | 'stable' | 'degrading'
}

export interface LatencyHeatmapCell {
  bucket_start: string   // ISO timestamp
  bucket_minutes: number
  workflow_id: string
  p50: number
  p95: number
  p99: number
  sample_count: number
  anomaly: boolean       // p99 > 3x rolling avg
}

export interface ReplayStormDetection {
  detected: boolean
  replay_rate_per_minute: number
  threshold: number
  recommendation: string
}

// ─── Latency Heatmap Engine ───────────────────────────────────────────────────

export class LatencyHeatmapEngine {
  /**
   * Compute latency percentiles for a workflow over a time window.
   */
  async getWorkflowLatency(
    workflow_id: string,
    org_id: string,
    period_hours = 24,
    slo_target_ms = 5000
  ): Promise<WorkflowLatencyProfile> {
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }
    const since = new Date(Date.now() - period_hours * 3_600_000).toISOString()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb.from('runtime_events') as any)
      .select('metadata, created_at')
      .eq('org_id', org_id)
      .eq('event_type', 'workflow_completed')
      .contains('metadata', { workflow_id })
      .gte('created_at', since)
      .limit(2000)

    if (error || !data || data.length === 0) {
      return {
        workflow_id, org_id, period_hours,
        percentiles: { p50: 0, p75: 0, p95: 0, p99: 0, p999: 0, min: 0, max: 0, avg: 0, count: 0 },
        slo_breach_pct: 0,
        slo_target_ms,
        trend: 'stable',
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const latencies = (data ?? []).map((r: any) => (r.metadata as { duration_ms?: number })?.duration_ms ?? 0)
      .filter((ms: number) => ms > 0)
      .sort((a: number, b: number) => a - b)

    const percentiles = this._computePercentiles(latencies)
    const slo_breach_pct = latencies.length > 0
      ? Math.round((latencies.filter((ms: number) => ms > slo_target_ms).length / latencies.length) * 1000) / 10
      : 0

    // Trend: compare first half vs second half p95
    const mid = Math.floor(latencies.length / 2)
    const firstHalfP95 = this._percentile(latencies.slice(0, mid), 95)
    const secondHalfP95 = this._percentile(latencies.slice(mid), 95)
    let trend: WorkflowLatencyProfile['trend'] = 'stable'
    if (firstHalfP95 > 0) {
      const delta = (secondHalfP95 - firstHalfP95) / firstHalfP95
      if (delta < -0.1) trend = 'improving'
      else if (delta > 0.1) trend = 'degrading'
    }

    return { workflow_id, org_id, period_hours, percentiles, slo_breach_pct, slo_target_ms, trend }
  }

  /**
   * Generate a latency heatmap — bucket workflows by time.
   * Returns cells for a 2D time × p95 visualization.
   */
  async generateHeatmap(
    org_id: string,
    period_hours = 6,
    bucket_minutes = 15
  ): Promise<LatencyHeatmapCell[]> {
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }
    const since = new Date(Date.now() - period_hours * 3_600_000).toISOString()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb.from('runtime_events') as any)
      .select('metadata, created_at')
      .eq('org_id', org_id)
      .eq('event_type', 'workflow_completed')
      .gte('created_at', since)
      .limit(5000)

    if (error || !data || data.length === 0) return []

    // Group by (bucket, workflow_id)
    type CellData = { latencies: number[]; bucket_start: Date }
    const cells = new Map<string, CellData>()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const row of data as any[]) {
      const meta = row.metadata as { workflow_id?: string; duration_ms?: number }
      const workflow_id = meta.workflow_id ?? 'unknown'
      const duration_ms = meta.duration_ms ?? 0
      const created = new Date(row.created_at as string)

      // Round to bucket
      const bucket_ms = bucket_minutes * 60_000
      const bucket_start = new Date(Math.floor(created.getTime() / bucket_ms) * bucket_ms)
      const key = `${bucket_start.toISOString()}:${workflow_id}`

      if (!cells.has(key)) cells.set(key, { latencies: [], bucket_start })
      cells.get(key)!.latencies.push(duration_ms)
    }

    // Compute rolling p99 average for anomaly detection
    const allP99s = Array.from(cells.values()).map(c => this._percentile(c.latencies, 99))
    const rollingAvgP99 = allP99s.length > 0 ? allP99s.reduce((s, v) => s + v, 0) / allP99s.length : 0

    const result: LatencyHeatmapCell[] = []
    for (const [key, cell] of cells.entries()) {
      // Key format: `${bucket_start_iso}:${workflow_id}`
      // bucket_start_iso is 24 chars (ISO 8601), so split after first 24+1 chars
      const bucketIso = cell.bucket_start.toISOString()
      const derivedWorkflowId = key.slice(bucketIso.length + 1)

      const sorted = [...cell.latencies].sort((a, b) => a - b)
      const p50 = this._percentile(sorted, 50)
      const p95 = this._percentile(sorted, 95)
      const p99 = this._percentile(sorted, 99)

      result.push({
        bucket_start: bucketIso,
        bucket_minutes,
        workflow_id: derivedWorkflowId,
        p50,
        p95,
        p99,
        sample_count: cell.latencies.length,
        anomaly: rollingAvgP99 > 0 && p99 > rollingAvgP99 * 3,
      })
    }

    return result.sort((a, b) => a.bucket_start.localeCompare(b.bucket_start))
  }

  /**
   * Detect replay storms — too many replays in a short window.
   */
  async detectReplayStorm(org_id: string): Promise<ReplayStormDetection> {
    const REPLAY_STORM_THRESHOLD = 50  // replays per minute
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }
    const since = new Date(Date.now() - 5 * 60_000).toISOString()  // last 5 minutes

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (sb.from('runtime_events') as any)
      .select('id', { count: 'exact', head: true })
      .eq('org_id', org_id)
      .eq('event_type', 'event_replayed')
      .gte('created_at', since)

    const total_replays = count ?? 0
    const replay_rate_per_minute = total_replays / 5

    const detected = replay_rate_per_minute > REPLAY_STORM_THRESHOLD

    if (detected) {
      logger.warn('[LatencyHeatmap] REPLAY STORM DETECTED', {
        org_id, replay_rate_per_minute, threshold: REPLAY_STORM_THRESHOLD,
      })
    }

    return {
      detected,
      replay_rate_per_minute: Math.round(replay_rate_per_minute * 10) / 10,
      threshold: REPLAY_STORM_THRESHOLD,
      recommendation: detected
        ? 'Suspend replay operations and investigate source events for infinite loops'
        : 'Normal replay activity',
    }
  }

  /**
   * Get p50/p95/p99 for all workflows in an org.
   * Used for the Control Tower observability dashboard.
   */
  async getOrgLatencySummary(
    org_id: string,
    period_hours = 24
  ): Promise<Array<{ workflow_id: string } & LatencyPercentiles & { slo_breach_pct: number }>> {
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }
    const since = new Date(Date.now() - period_hours * 3_600_000).toISOString()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb.from('runtime_events') as any)
      .select('metadata')
      .eq('org_id', org_id)
      .eq('event_type', 'workflow_completed')
      .gte('created_at', since)
      .limit(5000)

    if (error || !data) return []

    const byWorkflow = new Map<string, number[]>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const row of data as any[]) {
      const meta = row.metadata as { workflow_id?: string; duration_ms?: number }
      const wid = meta.workflow_id ?? 'unknown'
      const dur = meta.duration_ms ?? 0
      if (!byWorkflow.has(wid)) byWorkflow.set(wid, [])
      byWorkflow.get(wid)!.push(dur)
    }

    return Array.from(byWorkflow.entries()).map(([workflow_id, latencies]) => {
      const sorted = [...latencies].sort((a, b) => a - b)
      const percentiles = this._computePercentiles(sorted)
      const slo_breach_pct = sorted.length > 0
        ? Math.round((sorted.filter(ms => ms > 5000).length / sorted.length) * 1000) / 10
        : 0
      return { workflow_id, ...percentiles, slo_breach_pct }
    }).sort((a, b) => b.p99 - a.p99)  // Worst latency first
  }

  // ─── Percentile utilities ───────────────────────────────────────────────────

  private _percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0
    const idx = Math.ceil((p / 100) * sorted.length) - 1
    return sorted[Math.max(0, Math.min(idx, sorted.length - 1))]
  }

  private _computePercentiles(sorted: number[]): LatencyPercentiles {
    if (sorted.length === 0) {
      return { p50: 0, p75: 0, p95: 0, p99: 0, p999: 0, min: 0, max: 0, avg: 0, count: 0 }
    }
    const avg = sorted.reduce((s, v) => s + v, 0) / sorted.length
    return {
      p50:  this._percentile(sorted, 50),
      p75:  this._percentile(sorted, 75),
      p95:  this._percentile(sorted, 95),
      p99:  this._percentile(sorted, 99),
      p999: this._percentile(sorted, 99.9),
      min:  sorted[0],
      max:  sorted[sorted.length - 1],
      avg:  Math.round(avg),
      count: sorted.length,
    }
  }
}

export const latencyHeatmapEngine = new LatencyHeatmapEngine()
