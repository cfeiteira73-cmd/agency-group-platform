// AGENCY GROUP — SH-ROS Queue: queueHealth | AMI: 22506
// Real-time queue health monitoring with degradation alerts and recovery callbacks.

import { supabaseAdmin } from '@/lib/supabase'
import type { IQueueProvider, QueueHealth } from './queueProvider'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseAdmin as any

// ─── QueueHealthMonitor ───────────────────────────────────────────────────────

export class QueueHealthMonitor {
  private readonly provider: IQueueProvider
  private intervalHandle: ReturnType<typeof setInterval> | null = null
  private lastHealth: QueueHealth | null = null
  private previousStatus: QueueHealth['status'] | null = null

  private degradedCallbacks: Array<(health: QueueHealth) => void> = []
  private recoveredCallbacks: Array<() => void> = []

  constructor(provider: IQueueProvider) {
    this.provider = provider
  }

  // ── startMonitoring ────────────────────────────────────────────────────────

  startMonitoring(intervalMs: number): void {
    if (this.intervalHandle) return // already running

    // Run immediately, then on interval
    void this.runCheck()
    this.intervalHandle = setInterval(() => {
      void this.runCheck()
    }, intervalMs)
  }

  // ── stopMonitoring ─────────────────────────────────────────────────────────

  stopMonitoring(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle)
      this.intervalHandle = null
    }
  }

  // ── getLastHealth ──────────────────────────────────────────────────────────

  getLastHealth(): QueueHealth {
    if (!this.lastHealth) {
      return {
        provider: 'unknown',
        status: 'unavailable',
        lag: 0,
        dlq_count: 0,
        latency_p50: 0,
        latency_p95: 0,
        latency_p99: 0,
      }
    }
    return this.lastHealth
  }

  // ── onDegraded ─────────────────────────────────────────────────────────────

  onDegraded(callback: (health: QueueHealth) => void): void {
    this.degradedCallbacks.push(callback)
  }

  // ── onRecovered ────────────────────────────────────────────────────────────

  onRecovered(callback: () => void): void {
    this.recoveredCallbacks.push(callback)
  }

  // ── Internal check ─────────────────────────────────────────────────────────

  private async runCheck(): Promise<void> {
    try {
      const health = await this.provider.getHealth()
      this.lastHealth = health

      const wasDegraded =
        this.previousStatus === 'degraded' || this.previousStatus === 'unavailable'
      const isDegraded = health.status === 'degraded' || health.status === 'unavailable'

      if (isDegraded && !wasDegraded) {
        // Transition into degraded — fire callbacks and persist alert
        for (const cb of this.degradedCallbacks) {
          try {
            cb(health)
          } catch (err) {
            console.error('[QueueHealthMonitor] degraded callback error:', err)
          }
        }
        await this.emitSystemAlert(health)
      } else if (!isDegraded && wasDegraded) {
        // Transition to healthy — fire recovery callbacks
        for (const cb of this.recoveredCallbacks) {
          try {
            cb()
          } catch (err) {
            console.error('[QueueHealthMonitor] recovered callback error:', err)
          }
        }
        await this.emitRecoveryAlert(health)
      }

      this.previousStatus = health.status
    } catch (err) {
      console.error('[QueueHealthMonitor] runCheck error:', err)
    }
  }

  // ── Persist alert to Supabase ──────────────────────────────────────────────

  private async emitSystemAlert(health: QueueHealth): Promise<void> {
    try {
      const { error } = await sb.from('system_alerts').insert({
        id: crypto.randomUUID(),
        severity: health.status === 'unavailable' ? 'critical' : 'warning',
        component: 'queue',
        message: `Queue ${health.provider} is ${health.status}. Lag: ${health.lag}, DLQ: ${health.dlq_count}, p95: ${health.latency_p95}ms`,
        metadata: health,
        created_at: new Date().toISOString(),
        resolved: false,
      })

      if (error) {
        console.error('[QueueHealthMonitor] Failed to persist system alert:', error)
      }
    } catch (err) {
      console.error('[QueueHealthMonitor] emitSystemAlert error:', err)
    }
  }

  private async emitRecoveryAlert(health: QueueHealth): Promise<void> {
    try {
      // Resolve open alerts for this component
      const { error } = await sb
        .from('system_alerts')
        .update({ resolved: true, resolved_at: new Date().toISOString() })
        .eq('component', 'queue')
        .eq('resolved', false)

      if (error) {
        console.error('[QueueHealthMonitor] Failed to resolve system alerts:', error)
      }

      // Insert a recovery note
      await sb.from('system_alerts').insert({
        id: crypto.randomUUID(),
        severity: 'info',
        component: 'queue',
        message: `Queue ${health.provider} recovered. Status: healthy. Lag: ${health.lag}`,
        metadata: health,
        created_at: new Date().toISOString(),
        resolved: true,
      })
    } catch (err) {
      console.error('[QueueHealthMonitor] emitRecoveryAlert error:', err)
    }
  }
}
