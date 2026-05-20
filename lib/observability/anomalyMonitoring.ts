// AGENCY GROUP — SH-ROS Observability: anomalyMonitoring | AMI: 22506
//
// Persistence strategy:
//   _baselines  → write-through cache backed by `anomaly_baselines` Supabase table.
//                 On cold start (empty Map) the first checkMetrics() call loads from DB.
//   _dlqWindow  → write-through cache backed by `runtime_events` table query.
//                 Cold start reconstitutes the last-5-min DLQ events from DB.
//   Alert dedup → Upstash Redis key `alert_dedup:{alertId}` with 1-hour TTL.

import { supabaseAdmin } from '@/lib/supabase'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseAdmin as any
import { metricsRegistry } from './metricsRegistry'

export interface AnomalyCheck {
  metric: string
  org_id?: string
  current_value: number
  baseline: number
  deviation_pct: number
  severity: 'info' | 'warning' | 'critical'
  detected_at: string
  description: string
}

export interface AnomalyRunSummary {
  tenant_id: string
  ran_at: string
  total: number
  critical: number
  warning: number
  checks: AnomalyCheck[]
}

type AnomalyCallback = (check: AnomalyCheck) => void

interface BaselineRecord {
  sum: number
  count: number
  last_updated: number
}

// ---------------------------------------------------------------------------
// Redis helpers for alert deduplication
// ---------------------------------------------------------------------------

// Returns 'NEW' when key was set (alert not deduped), 'EXISTS' when key existed (alert deduped), 'UNAVAILABLE' when Redis unreachable
async function redisSetNX(key: string, value: string, ttlSec: number): Promise<'NEW' | 'EXISTS' | 'UNAVAILABLE'> {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return 'UNAVAILABLE'
  let attempt = 0
  while (attempt < 3) {
    try {
      const res = await fetch(
        `${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}?NX=true&EX=${ttlSec}`,
        { method: 'GET', headers: { Authorization: `Bearer ${token}` } },
      )
      if (res.status === 429) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 200))
        attempt++
        continue
      }
      if (!res.ok) {
        console.error('[AnomalyMonitor] Redis set failed — unreachable, logging incident')
        void _writeRedisIncident('redis_unreachable', `HTTP ${res.status} from Upstash`)
        return 'UNAVAILABLE'
      }
      const json = await res.json() as { result: string | null }
      // Redis NX: returns 'OK' when key was set (new), null when key already existed
      return json.result === 'OK' ? 'NEW' : 'EXISTS'
    } catch (err) {
      attempt++
      if (attempt >= 3) {
        console.error('[AnomalyMonitor] Redis unreachable after 3 attempts:', err)
        void _writeRedisIncident('redis_unreachable', String(err))
        return 'UNAVAILABLE'
      }
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 200))
    }
  }
  return 'UNAVAILABLE'
}

async function _writeRedisIncident(type: string, detail: string): Promise<void> {
  try {
    await supabaseAdmin.from('incidents').insert({
      tenant_id:        'agency-group',
      severity:         'P2',
      subsystem:        'cache',
      raw_error:        `Redis ${type}: ${detail}`,
      status:           'open',
      metrics_snapshot: { source: 'anomaly-monitor', type },
    })
  } catch { /* best effort */ }
}

async function isAlertDeduped(alertId: string): Promise<boolean> {
  const result = await redisSetNX(`alert_dedup:${alertId}`, '1', 3600)
  if (result === 'UNAVAILABLE') {
    // Redis down — do NOT suppress alerts. Fail open so critical alerts are never silently dropped.
    console.warn('[AnomalyMonitor] Redis unavailable for dedup check — sending alert without dedup')
    return false
  }
  // 'EXISTS' = already deduped (alert was sent within TTL window), 'NEW' = first occurrence
  return result === 'EXISTS'
}

export class AnomalyMonitor {
  private readonly _callbacks: AnomalyCallback[] = []
  // Write-through cache: populated from Supabase on first access (cold start recovery)
  private readonly _baselines: Map<string, BaselineRecord> = new Map()
  private _baselinesLoaded = false
  // Write-through cache: DLQ event timestamps — reconstituted from DB on cold start
  private readonly _dlqWindow: number[] = []
  private _dlqLoaded = false

  /**
   * Run all anomaly checks for a single tenant/org and return a summary.
   * Designed for cron invocation — no setInterval, stateless-compatible.
   * Critical anomalies are also written to system_alerts in Supabase.
   */
  async runAnomalyCheck(tenantId: string): Promise<AnomalyRunSummary> {
    const checks = await this.checkMetrics(tenantId)

    const critical = checks.filter((c) => c.severity === 'critical')
    const warning  = checks.filter((c) => c.severity === 'warning')

    for (const check of critical) {
      await this._emitCriticalAlert(check)
    }

    for (const check of checks) {
      for (const cb of this._callbacks) {
        try { cb(check) } catch {}
      }
    }

    return {
      tenant_id: tenantId,
      ran_at:    new Date().toISOString(),
      total:     checks.length,
      critical:  critical.length,
      warning:   warning.length,
      checks,
    }
  }

  async checkMetrics(org_id?: string): Promise<AnomalyCheck[]> {
    // Recover persistent state on cold start
    await Promise.all([this._ensureBaselinesLoaded(), this._ensureDLQLoaded()])

    const checks: AnomalyCheck[] = []
    const snapshot = metricsRegistry.exportJSON()
    const now = new Date().toISOString()

    // 1. Event latency > 2x baseline
    for (const [key, stats] of Object.entries(snapshot.histograms)) {
      if (!key.startsWith('shros_event_duration_ms')) continue
      const orgMatch = org_id ? key.includes(`org_id="${org_id}"`) : true
      if (!orgMatch) continue

      const current_p95 = stats.p95
      const baseKey = `latency_${key}`
      const baseline = this._getOrSetBaseline(baseKey, current_p95)
      const deviation_pct = baseline > 0 ? ((current_p95 - baseline) / baseline) * 100 : 0

      if (deviation_pct > 100) {
        checks.push({
          metric: 'shros_event_duration_ms_p95',
          org_id,
          current_value: current_p95,
          baseline,
          deviation_pct,
          severity: deviation_pct > 200 ? 'critical' : 'warning',
          detected_at: now,
          description: `Event latency p95 is ${deviation_pct.toFixed(1)}% above baseline (${current_p95}ms vs ${baseline}ms)`,
        })
      }
    }

    // 2. DLQ spike > 5 in 5 minutes
    const fiveMinAgo = Date.now() - 5 * 60 * 1000
    const recentDLQ = this._dlqWindow.filter((t) => t >= fiveMinAgo).length

    if (recentDLQ > 5) {
      checks.push({
        metric: 'shros_dlq_total',
        org_id,
        current_value: recentDLQ,
        baseline: 5,
        deviation_pct: ((recentDLQ - 5) / 5) * 100,
        severity: recentDLQ > 20 ? 'critical' : 'warning',
        detected_at: now,
        description: `DLQ spike detected: ${recentDLQ} events in last 5 minutes (threshold: 5)`,
      })
    }

    // 3. Failure rate > 20%: agents_total status=failed vs total
    const totalAgents = this._sumCounters(snapshot.counters, 'shros_agents_total', org_id)
    const failedAgents = this._sumCounters(snapshot.counters, 'shros_agents_total', org_id, 'status="failed"')
    if (totalAgents > 10) {
      const failure_rate = (failedAgents / totalAgents) * 100
      if (failure_rate > 20) {
        checks.push({
          metric: 'shros_agent_failure_rate',
          org_id,
          current_value: failure_rate,
          baseline: 20,
          deviation_pct: failure_rate - 20,
          severity: failure_rate > 50 ? 'critical' : 'warning',
          detected_at: now,
          description: `Agent failure rate is ${failure_rate.toFixed(1)}% (threshold: 20%)`,
        })
      }
    }

    // 4. Economic score drop > 30%
    for (const [key, value] of Object.entries(snapshot.gauges)) {
      if (!key.startsWith('shros_economic_score')) continue
      const orgMatch = org_id ? key.includes(`org_id="${org_id}"`) : true
      if (!orgMatch) continue

      const baseKey = `econ_${key}`
      const baseline = this._getOrSetBaseline(baseKey, value)
      const drop_pct = baseline > 0 ? ((baseline - value) / baseline) * 100 : 0

      if (drop_pct > 30) {
        checks.push({
          metric: 'shros_economic_score',
          org_id,
          current_value: value,
          baseline,
          deviation_pct: drop_pct,
          severity: drop_pct > 50 ? 'critical' : 'warning',
          detected_at: now,
          description: `Economic score dropped ${drop_pct.toFixed(1)}% from baseline (${value.toFixed(2)} vs ${baseline.toFixed(2)})`,
        })
      }
    }

    return checks
  }

  onAnomaly(callback: AnomalyCallback): void {
    this._callbacks.push(callback)
  }

  /** Record a DLQ event timestamp (called externally) — persists to runtime_events */
  recordDLQEvent(): void {
    const now = Date.now()
    this._dlqWindow.push(now)
    // Clean old in-memory entries
    const fiveMinAgo = now - 5 * 60 * 1000
    while (this._dlqWindow.length > 0 && this._dlqWindow[0] < fiveMinAgo) {
      this._dlqWindow.shift()
    }
    // Persist DLQ event to runtime_events so cold starts can reconstitute the window
    void Promise.resolve(supabaseAdmin.from('runtime_events').insert({
      org_id:           'agency-group',
      type:             'dlq_event',
      status:           'completed',
      correlation_id:   `dlq-${now}`,
      trace_id:         'system-anomaly-monitor',
      source_system:    'agent',
      payload:          { recorded_at: new Date(now).toISOString() },
      event_timestamp:  new Date(now).toISOString(),
    })).then(({ error }: { error: { message: string } | null }) => {
      if (error) console.warn('[AnomalyMonitor] DLQ persist failed:', error.message)
    }).catch((err: unknown) => {
      console.warn('[AnomalyMonitor] DLQ persist threw:', err)
    })
  }

  /** Load DLQ window from DB on cold start */
  private async _ensureDLQLoaded(): Promise<void> {
    if (this._dlqLoaded) return
    this._dlqLoaded = true
    try {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const { data } = await supabaseAdmin
        .from('runtime_events')
        .select('event_timestamp')
        .eq('type', 'dlq_event')
        .gte('event_timestamp', fiveMinAgo)
      if (data) {
        for (const row of data as { event_timestamp: string }[]) {
          this._dlqWindow.push(new Date(row.event_timestamp).getTime())
        }
        this._dlqWindow.sort((a, b) => a - b)
      }
    } catch (err) {
      console.warn('[AnomalyMonitor] DLQ cold-start load failed:', err)
    }
  }

  private _getOrSetBaseline(key: string, currentValue: number): number {
    const rec = this._baselines.get(key)
    if (!rec) {
      const newRec: BaselineRecord = { sum: currentValue, count: 1, last_updated: Date.now() }
      this._baselines.set(key, newRec)
      // Persist new baseline
      void this._persistBaseline(key, newRec)
      return currentValue
    }
    // Rolling average: update baseline with EMA (alpha=0.1)
    const updated = rec.sum * 0.9 + currentValue * 0.1
    const updatedRec: BaselineRecord = { sum: updated, count: rec.count + 1, last_updated: Date.now() }
    this._baselines.set(key, updatedRec)
    // Persist updated baseline (fire-and-forget)
    void this._persistBaseline(key, updatedRec)
    return rec.sum
  }

  private async _persistBaseline(key: string, rec: BaselineRecord): Promise<void> {
    try {
      await sb.from('anomaly_baselines').upsert({
        baseline_key: key,
        ema_value: rec.sum,
        sample_count: rec.count,
        last_updated: new Date(rec.last_updated).toISOString(),
      }, { onConflict: 'baseline_key' })
    } catch (err) {
      console.warn('[AnomalyMonitor] baseline persist failed:', err)
    }
  }

  /** Load baselines from Supabase on cold start */
  private async _ensureBaselinesLoaded(): Promise<void> {
    if (this._baselinesLoaded) return
    this._baselinesLoaded = true
    try {
      const { data } = await sb
        .from('anomaly_baselines')
        .select('baseline_key, ema_value, sample_count, last_updated')
      if (data) {
        for (const row of data as { baseline_key: string; ema_value: number; sample_count: number; last_updated: string }[]) {
          this._baselines.set(row.baseline_key, {
            sum:          row.ema_value,
            count:        row.sample_count,
            last_updated: new Date(row.last_updated).getTime(),
          })
        }
      }
    } catch (err) {
      console.warn('[AnomalyMonitor] baselines cold-start load failed:', err)
    }
  }

  private _sumCounters(
    counters: Record<string, number>,
    prefix: string,
    org_id?: string,
    labelFilter?: string,
  ): number {
    let total = 0
    for (const [key, value] of Object.entries(counters)) {
      if (!key.startsWith(prefix)) continue
      if (org_id && !key.includes(`org_id="${org_id}"`)) continue
      if (labelFilter && !key.includes(labelFilter)) continue
      total += value
    }
    return total
  }

  private async _emitCriticalAlert(check: AnomalyCheck): Promise<void> {
    // Deduplicate: skip if same alert was emitted within the last hour
    const alertId = `${check.metric}:${check.org_id ?? 'global'}:${check.severity}`
    const deduped = await isAlertDeduped(alertId)
    if (deduped) {
      console.log(`[AnomalyMonitor] alert deduped (Redis TTL active): ${alertId}`)
      return
    }

    try {
      await supabaseAdmin.from('system_alerts').insert({
        alert_type: 'anomaly_detected',
        severity: 'P1',
        title: `Anomaly: ${check.metric}`,
        message: check.description,
        org_id: check.org_id ?? null,
        metadata: {
          metric: check.metric,
          current_value: check.current_value,
          baseline: check.baseline,
          deviation_pct: check.deviation_pct,
        },
        created_at: check.detected_at,
        acknowledged: false,
      })
    } catch (err) {
      console.warn('[AnomalyMonitor] failed to emit critical alert:', err)
    }
  }
}

export const anomalyMonitor = new AnomalyMonitor()

/**
 * Standalone cron-compatible entry point.
 * Runs all anomaly checks for a single tenant and returns a summary.
 * Delegates to the singleton AnomalyMonitor instance.
 */
export async function runAnomalyCheck(tenantId: string): Promise<AnomalyRunSummary> {
  return anomalyMonitor.runAnomalyCheck(tenantId)
}
