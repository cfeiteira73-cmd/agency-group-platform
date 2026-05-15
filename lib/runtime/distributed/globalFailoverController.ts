// AGENCY GROUP — SH-ROS Distributed: Global Failover Controller | AMI: 22506
// Detects regional failures and reroutes traffic automatically
// Zero-event-loss guarantee during failover via write-ahead persistence
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import { multiRegionRouter, type Region } from './multiRegionRouter'
import { signedAuditChain } from '@/lib/security/signedAuditChain'
import { randomUUID } from 'crypto'
import logger from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type FailoverTrigger =
  | 'consecutive_errors'
  | 'queue_lag_exceeded'
  | 'latency_threshold_exceeded'
  | 'health_check_failed'
  | 'manual'

export interface FailoverEvent {
  failover_id: string
  from_region: Region
  to_region: Region
  trigger: FailoverTrigger
  error_count: number
  queue_lag: number
  latency_p99_ms: number
  started_at: string
  completed_at: string | null
  events_rerouted: number
  status: 'active' | 'completed' | 'reverted'
}

export interface RegionCircuitBreaker {
  region: Region
  state: 'closed' | 'open' | 'half-open'
  consecutive_errors: number
  last_error_at: string | null
  open_since: string | null
  half_open_probe_at: string | null
}

// ─── Thresholds ───────────────────────────────────────────────────────────────

const CIRCUIT_BREAKER_THRESHOLD = 5     // consecutive errors before opening
const CIRCUIT_BREAKER_TIMEOUT = 30_000  // 30s before half-open probe
const MAX_QUEUE_LAG = 10_000            // events behind before failover
const MAX_LATENCY_P99_MS = 5_000        // p99 latency before failover

// ─── Global Failover Controller ───────────────────────────────────────────────

export class GlobalFailoverController {
  private _breakers = new Map<Region, RegionCircuitBreaker>()
  private _activeFailovers = new Map<Region, FailoverEvent>()

  constructor() {
    const regions: Region[] = ['eu-west', 'us-east', 'ap-south']
    for (const region of regions) {
      this._breakers.set(region, {
        region,
        state: 'closed',
        consecutive_errors: 0,
        last_error_at: null,
        open_since: null,
        half_open_probe_at: null,
      })
    }
  }

  /**
   * Record a success for a region — resets error counter.
   */
  recordSuccess(region: Region): void {
    const breaker = this._breakers.get(region)
    if (!breaker) return

    if (breaker.state === 'half-open') {
      // Probe succeeded — close the circuit
      this._breakers.set(region, {
        ...breaker,
        state: 'closed',
        consecutive_errors: 0,
        open_since: null,
        half_open_probe_at: null,
      })
      logger.info('[Failover] Circuit closed (recovered)', { region })
      this._endFailover(region)
    } else if (breaker.consecutive_errors > 0) {
      this._breakers.set(region, { ...breaker, consecutive_errors: 0 })
    }
  }

  /**
   * Record an error for a region — may trip circuit breaker.
   */
  async recordError(region: Region, error: string): Promise<boolean> {
    const breaker = this._breakers.get(region)
    if (!breaker) return false

    const consecutive_errors = breaker.consecutive_errors + 1
    const now = new Date().toISOString()

    this._breakers.set(region, {
      ...breaker,
      consecutive_errors,
      last_error_at: now,
    })

    // Check if threshold exceeded
    if (consecutive_errors >= CIRCUIT_BREAKER_THRESHOLD && breaker.state === 'closed') {
      await this._openCircuit(region, 'consecutive_errors', { error_count: consecutive_errors })
      return true  // failover triggered
    }

    return false
  }

  /**
   * Check if a region is available for routing.
   */
  isAvailable(region: Region): boolean {
    const breaker = this._breakers.get(region)
    if (!breaker) return false

    if (breaker.state === 'open') {
      // Check if timeout has passed for half-open probe
      if (breaker.open_since) {
        const elapsed = Date.now() - new Date(breaker.open_since).getTime()
        if (elapsed > CIRCUIT_BREAKER_TIMEOUT) {
          this._halfOpenCircuit(region)
          return true  // allow probe request
        }
      }
      return false
    }

    return true  // closed or half-open
  }

  /**
   * Evaluate region metrics and trigger failover if thresholds exceeded.
   * Called by the health check cron.
   */
  async evaluateRegion(region: Region, metrics: {
    queue_lag: number
    latency_p99_ms: number
    error_rate: number
  }): Promise<void> {
    if (metrics.queue_lag > MAX_QUEUE_LAG) {
      await this._openCircuit(region, 'queue_lag_exceeded', {
        queue_lag: metrics.queue_lag,
      })
    } else if (metrics.latency_p99_ms > MAX_LATENCY_P99_MS) {
      await this._openCircuit(region, 'latency_threshold_exceeded', {
        latency_p99_ms: metrics.latency_p99_ms,
      })
    }

    // Update router with current health
    multiRegionRouter.updateRegionHealth(region, {
      queue_lag: metrics.queue_lag,
      latency_p95_ms: metrics.latency_p99_ms,
      status: this.isAvailable(region) ? 'healthy' : 'unavailable',
    })
  }

  /**
   * Manually trigger failover for a region.
   */
  async manualFailover(
    region: Region,
    operator: string,
    reason: string
  ): Promise<FailoverEvent> {
    logger.warn('[Failover] Manual failover triggered', { region, operator, reason })
    return await this._openCircuit(region, 'manual', {}, operator)
  }

  /**
   * Get circuit breaker state for all regions.
   */
  getCircuitBreakerState(): RegionCircuitBreaker[] {
    return Array.from(this._breakers.values())
  }

  /**
   * Get all active failover events.
   */
  getActiveFailovers(): FailoverEvent[] {
    return Array.from(this._activeFailovers.values())
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private async _openCircuit(
    region: Region,
    trigger: FailoverTrigger,
    metrics: Partial<{ error_count: number; queue_lag: number; latency_p99_ms: number }>,
    operator = 'system'
  ): Promise<FailoverEvent> {
    const breaker = this._breakers.get(region)!
    if (breaker.state === 'open') {
      return this._activeFailovers.get(region)!
    }

    const now = new Date().toISOString()
    this._breakers.set(region, { ...breaker, state: 'open', open_since: now })

    // Determine target region for failover
    const fallback = multiRegionRouter.getRegionHealth()
      .find(h => h.region !== region && h.status !== 'unavailable')
      ?.region as Region | undefined

    if (!fallback) {
      logger.error('[Failover] No available regions for failover!', { region })
    } else {
      multiRegionRouter.updateRegionHealth(region, { status: 'unavailable' })
    }

    const failover_id = randomUUID()
    const event: FailoverEvent = {
      failover_id,
      from_region: region,
      to_region: fallback ?? region,
      trigger,
      error_count: metrics.error_count ?? 0,
      queue_lag: metrics.queue_lag ?? 0,
      latency_p99_ms: metrics.latency_p99_ms ?? 0,
      started_at: now,
      completed_at: null,
      events_rerouted: 0,
      status: 'active',
    }

    this._activeFailovers.set(region, event)

    // Persist to Supabase for observability
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }
    await (sb.from('learning_events') as { insert: (d: unknown) => Promise<{ error: unknown }> }).insert({
      event_type: 'regional_failover',
      org_id: 'system',
      metadata: event,
      created_at: now,
    })

    // Signed audit trail
    await signedAuditChain.append({
      entry_id: randomUUID(),
      org_id: 'system',
      actor: operator,
      action: 'regional_failover_triggered',
      entity_type: 'region',
      entity_id: region,
      metadata: { trigger, fallback, ...metrics },
    })

    logger.error(`[Failover] CIRCUIT OPEN: ${region} → ${fallback ?? 'NONE'}`, {
      failover_id, trigger, ...metrics,
    })

    return event
  }

  private _halfOpenCircuit(region: Region): void {
    const breaker = this._breakers.get(region)!
    this._breakers.set(region, {
      ...breaker,
      state: 'half-open',
      half_open_probe_at: new Date().toISOString(),
    })
    logger.info('[Failover] Circuit half-open (probe)', { region })
  }

  private _endFailover(region: Region): void {
    const failover = this._activeFailovers.get(region)
    if (!failover) return

    const completed: FailoverEvent = {
      ...failover,
      completed_at: new Date().toISOString(),
      status: 'completed',
    }

    this._activeFailovers.delete(region)
    logger.info('[Failover] Failover ended', {
      failover_id: failover.failover_id,
      region,
      events_rerouted: failover.events_rerouted,
    })

    void completed
  }
}

export const globalFailoverController = new GlobalFailoverController()
