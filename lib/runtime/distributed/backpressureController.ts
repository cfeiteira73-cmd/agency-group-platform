// AGENCY GROUP — SH-ROS Distributed: Distributed Backpressure Controller | AMI: 22506
// Per-region, per-tenant backpressure — prevents any single org from overwhelming the system
// Extends the existing queueBackpressure with distributed awareness
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import type { Region } from './multiRegionRouter'
import logger from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BackpressureState {
  org_id: string
  region: Region
  queue_depth: number
  processing_rate: number  // events/second
  throttle_factor: number  // 0=full throttle, 1=full stop
  paused: boolean
  last_evaluated_at: string
}

export interface RegionBackpressure {
  region: Region
  total_queue_depth: number
  active_tenants: number
  paused_tenants: number
  avg_processing_rate: number
  global_throttle: boolean
  last_evaluated_at: string
}

export interface BackpressureConfig {
  org_high_watermark: number    // per-org queue depth to start throttling
  org_pause_watermark: number   // per-org queue depth to pause
  region_high_watermark: number // total region queue to start global throttle
  region_pause_watermark: number// total region queue to pause all writes
  recovery_rate: number         // % queue depth reduction before resuming
}

// ─── Default configuration ────────────────────────────────────────────────────

const DEFAULT_CONFIG: BackpressureConfig = {
  org_high_watermark:    100,    // Throttle at 100 events queued per org
  org_pause_watermark:   1_000,  // Pause at 1K events queued per org
  region_high_watermark: 10_000, // Regional throttle at 10K total
  region_pause_watermark: 100_000, // Regional pause at 100K
  recovery_rate:         0.5,    // Resume when queue drops to 50% of watermark
}

// ─── Distributed Backpressure Controller ─────────────────────────────────────

export class DistributedBackpressureController {
  private _orgStates = new Map<string, BackpressureState>()
  private _regionStates = new Map<Region, RegionBackpressure>()
  private _config: BackpressureConfig

  constructor(config: Partial<BackpressureConfig> = {}) {
    this._config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Check if an org can publish events.
   * Returns true if allowed, false if backpressured.
   */
  canPublish(org_id: string, region: Region): boolean {
    // Check regional backpressure first (global ceiling)
    const regional = this._regionStates.get(region)
    if (regional?.global_throttle) {
      logger.warn('[Backpressure] Regional throttle active', { region, org_id })
      return false
    }

    // Check org-level backpressure
    const state = this._orgStates.get(this._key(org_id, region))
    if (state?.paused) return false

    return true
  }

  /**
   * Get current throttle factor for an org (0=none, 1=full stop).
   * Used to implement rate limiting at the publisher.
   */
  getThrottleFactor(org_id: string, region: Region): number {
    const state = this._orgStates.get(this._key(org_id, region))
    const regional = this._regionStates.get(region)
    return Math.max(state?.throttle_factor ?? 0, regional?.global_throttle ? 1 : 0)
  }

  /**
   * Update queue depth for an org — triggers backpressure evaluation.
   * Called by queue metrics collector.
   */
  updateQueueDepth(org_id: string, region: Region, queue_depth: number): void {
    const key = this._key(org_id, region)
    const existing = this._orgStates.get(key)
    const was_paused = existing?.paused ?? false

    let throttle_factor = 0
    let paused = false

    if (queue_depth >= this._config.org_pause_watermark) {
      paused = true
      throttle_factor = 1.0
    } else if (queue_depth >= this._config.org_high_watermark) {
      // Linear throttle between high watermark and pause watermark
      throttle_factor = (queue_depth - this._config.org_high_watermark) /
        (this._config.org_pause_watermark - this._config.org_high_watermark)
    } else if (was_paused) {
      // Recovery: only unpause when below 50% of high watermark
      paused = queue_depth > this._config.org_high_watermark * this._config.recovery_rate
    }

    const state: BackpressureState = {
      org_id,
      region,
      queue_depth,
      processing_rate: existing?.processing_rate ?? 0,
      throttle_factor: Math.min(1, Math.max(0, throttle_factor)),
      paused,
      last_evaluated_at: new Date().toISOString(),
    }

    this._orgStates.set(key, state)

    if (paused && !was_paused) {
      logger.warn('[Backpressure] Org PAUSED', { org_id, region, queue_depth })
    } else if (!paused && was_paused) {
      logger.info('[Backpressure] Org RESUMED', { org_id, region, queue_depth })
    }
  }

  /**
   * Update regional backpressure state.
   * Called by the region health monitor.
   */
  updateRegionalState(region: Region, total_queue_depth: number): void {
    const active_tenants = Array.from(this._orgStates.values())
      .filter(s => s.region === region).length

    const paused_tenants = Array.from(this._orgStates.values())
      .filter(s => s.region === region && s.paused).length

    const global_throttle = total_queue_depth >= this._config.region_high_watermark

    const existing = this._regionStates.get(region)
    const was_throttled = existing?.global_throttle ?? false

    this._regionStates.set(region, {
      region,
      total_queue_depth,
      active_tenants,
      paused_tenants,
      avg_processing_rate: 0,
      global_throttle,
      last_evaluated_at: new Date().toISOString(),
    })

    if (global_throttle && !was_throttled) {
      logger.error('[Backpressure] REGIONAL THROTTLE ACTIVATED', {
        region, total_queue_depth, threshold: this._config.region_high_watermark,
      })
    } else if (!global_throttle && was_throttled) {
      logger.info('[Backpressure] Regional throttle released', { region })
    }
  }

  /**
   * Get current queue depths from Supabase for all orgs.
   * Used for periodic backpressure evaluation.
   */
  async evaluateFromDB(region: Region): Promise<void> {
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }

    // Count unprocessed events per org in the last 10 minutes (proxy for queue depth)
    const since = new Date(Date.now() - 10 * 60_000).toISOString()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb.from('runtime_events') as any)
      .select('org_id')
      .gte('created_at', since)
      .is('metadata->processed_at', null)  // unprocessed events
      .limit(10_000)

    if (error || !data) return

    // Count per org
    const counts: Record<string, number> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const row of data as any[]) {
      const oid = row.org_id as string
      counts[oid] = (counts[oid] ?? 0) + 1
    }

    const total = Object.values(counts).reduce((s, v) => s + v, 0)
    this.updateRegionalState(region, total)

    for (const [org_id, depth] of Object.entries(counts)) {
      this.updateQueueDepth(org_id, region, depth)
    }
  }

  /**
   * Get snapshot of all backpressure states.
   */
  getSnapshot(): {
    org_states: BackpressureState[]
    region_states: RegionBackpressure[]
    paused_count: number
    throttled_count: number
  } {
    const org_states = Array.from(this._orgStates.values())
    const region_states = Array.from(this._regionStates.values())
    return {
      org_states,
      region_states,
      paused_count: org_states.filter(s => s.paused).length,
      throttled_count: org_states.filter(s => s.throttle_factor > 0).length,
    }
  }

  private _key(org_id: string, region: Region): string {
    return `${region}:${org_id}`
  }
}

export const distributedBackpressureController = new DistributedBackpressureController()
