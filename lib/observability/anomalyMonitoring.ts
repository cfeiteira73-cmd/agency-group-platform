// AGENCY GROUP — SH-ROS Observability: anomalyMonitoring | AMI: 22506

import { supabaseAdmin } from '@/lib/supabase'
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

export class AnomalyMonitor {
  private readonly _callbacks: AnomalyCallback[] = []
  private readonly _baselines: Map<string, BaselineRecord> = new Map()
  private readonly _dlqWindow: number[] = [] // timestamps of DLQ events

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

  /** Record a DLQ event timestamp (called externally) */
  recordDLQEvent(): void {
    this._dlqWindow.push(Date.now())
    // Clean old entries
    const fiveMinAgo = Date.now() - 5 * 60 * 1000
    while (this._dlqWindow.length > 0 && this._dlqWindow[0] < fiveMinAgo) {
      this._dlqWindow.shift()
    }
  }

  private _getOrSetBaseline(key: string, currentValue: number): number {
    const rec = this._baselines.get(key)
    if (!rec) {
      this._baselines.set(key, { sum: currentValue, count: 1, last_updated: Date.now() })
      return currentValue
    }
    // Rolling average: update baseline with EMA (alpha=0.1)
    const updated = rec.sum * 0.9 + currentValue * 0.1
    this._baselines.set(key, { sum: updated, count: rec.count + 1, last_updated: Date.now() })
    return rec.sum
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
