// AGENCY GROUP — SH-ROS Distributed: Multi-Region Router | AMI: 22506
// Routes events to the correct regional infrastructure
// Tenant isolation preserved globally — org_id determines home region
// =============================================================================

import type { RuntimeEvent } from '@/lib/runtime/types'
import { partitionStrategy } from './partitionStrategy'
import { kafkaClusterAdapter } from './kafkaClusterAdapter'
import logger from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Region = 'eu-west' | 'us-east' | 'ap-south'

export interface RegionConfig {
  region: Region
  supabase_url: string
  primary: boolean
  latency_budget_ms: number  // SLA target for this region
  fallback_regions: Region[]
}

export interface RoutingDecision {
  org_id: string
  target_region: Region
  fallback_region: Region | null
  routing_mode: 'kafka' | 'redis' | 'db'
  partition: number
  latency_budget_ms: number
  reason: string
}

export interface RegionHealth {
  region: Region
  status: 'healthy' | 'degraded' | 'unavailable'
  queue_lag: number
  last_event_at: string | null
  latency_p95_ms: number
}

// ─── Region Configuration ─────────────────────────────────────────────────────

const REGION_CONFIGS: Record<Region, RegionConfig> = {
  'eu-west': {
    region: 'eu-west',
    supabase_url: process.env.SUPABASE_URL ?? '',
    primary: true,
    latency_budget_ms: 100,
    fallback_regions: ['us-east', 'ap-south'],
  },
  'us-east': {
    region: 'us-east',
    supabase_url: process.env.SUPABASE_URL_US ?? process.env.SUPABASE_URL ?? '',
    primary: false,
    latency_budget_ms: 150,
    fallback_regions: ['eu-west', 'ap-south'],
  },
  'ap-south': {
    region: 'ap-south',
    supabase_url: process.env.SUPABASE_URL_AP ?? process.env.SUPABASE_URL ?? '',
    primary: false,
    latency_budget_ms: 200,
    fallback_regions: ['eu-west', 'us-east'],
  },
}

// ─── Multi-Region Router ──────────────────────────────────────────────────────

export class MultiRegionRouter {
  private _regionHealth = new Map<Region, RegionHealth>()
  private _orgRegionCache = new Map<string, { region: Region; expires: number }>()
  private readonly CACHE_TTL = 5 * 60_000  // 5 minutes

  constructor() {
    // Initialize health state for all regions
    for (const region of Object.keys(REGION_CONFIGS) as Region[]) {
      this._regionHealth.set(region, {
        region,
        status: 'healthy',
        queue_lag: 0,
        last_event_at: null,
        latency_p95_ms: 0,
      })
    }
  }

  /**
   * Route an event to the correct region and infrastructure.
   * Deterministic: same org_id always routes to same region (unless failover).
   */
  route(event: RuntimeEvent): RoutingDecision {
    const home_region = this._getHomeRegion(event.org_id)
    const home_health = this._regionHealth.get(home_region)

    let target_region = home_region
    let reason = 'home_region'

    // Failover if home region is unavailable
    if (home_health?.status === 'unavailable') {
      const fallback = this._getFallbackRegion(home_region)
      if (fallback) {
        target_region = fallback
        reason = `failover_from:${home_region}`
        logger.warn('[MultiRegionRouter] Failover activated', {
          org_id: event.org_id, from: home_region, to: fallback,
        })
      }
    }

    // Critical events never degrade to DB mode if Kafka is active
    const routing_mode = this._selectRoutingMode(event, target_region)
    const partition = partitionStrategy.assignPartition(event.org_id, event.priority)
    const config = REGION_CONFIGS[target_region]

    const fallback_region = target_region !== home_region
      ? null
      : this._getFallbackRegion(target_region)

    return {
      org_id: event.org_id,
      target_region,
      fallback_region,
      routing_mode,
      partition,
      latency_budget_ms: config.latency_budget_ms,
      reason,
    }
  }

  /**
   * Get routing decision for a batch of events.
   * Groups by target_region + routing_mode for efficient batching.
   */
  routeBatch(events: RuntimeEvent[]): Map<string, RuntimeEvent[]> {
    const groups = new Map<string, RuntimeEvent[]>()

    for (const event of events) {
      const decision = this.route(event)
      const key = `${decision.target_region}:${decision.routing_mode}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(event)
    }

    return groups
  }

  /**
   * Update health status for a region (called by healthcheck cron).
   */
  updateRegionHealth(region: Region, health: Partial<RegionHealth>): void {
    const current = this._regionHealth.get(region)
    if (!current) return
    this._regionHealth.set(region, { ...current, ...health })

    if (health.status && health.status !== current.status) {
      logger.warn('[MultiRegionRouter] Region health changed', {
        region, from: current.status, to: health.status,
      })
    }
  }

  /**
   * Get current health for all regions.
   */
  getRegionHealth(): RegionHealth[] {
    return Array.from(this._regionHealth.values())
  }

  /**
   * Get the home region for an org.
   * Cached for 5 minutes to avoid repeated partition calculations.
   */
  getOrgRegion(org_id: string): Region {
    return this._getHomeRegion(org_id)
  }

  /**
   * Force re-routing for an org (e.g., after org migration between regions).
   */
  clearOrgCache(org_id: string): void {
    this._orgRegionCache.delete(org_id)
  }

  /**
   * Get routing statistics for monitoring.
   */
  getRoutingStats(): {
    regions: RegionHealth[]
    kafka_active: boolean
    fallover_count: number
    cache_size: number
  } {
    return {
      regions: this.getRegionHealth(),
      kafka_active: kafkaClusterAdapter.isDistributedModeActive(),
      fallover_count: 0,  // tracked in production via metrics
      cache_size: this._orgRegionCache.size,
    }
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private _getHomeRegion(org_id: string): Region {
    const cached = this._orgRegionCache.get(org_id)
    if (cached && cached.expires > Date.now()) return cached.region

    const region = partitionStrategy.getRegion(org_id) as Region
    this._orgRegionCache.set(org_id, { region, expires: Date.now() + this.CACHE_TTL })
    return region
  }

  private _getFallbackRegion(region: Region): Region | null {
    const config = REGION_CONFIGS[region]
    for (const fallback of config.fallback_regions) {
      const health = this._regionHealth.get(fallback)
      if (health?.status !== 'unavailable') return fallback
    }
    return null
  }

  private _selectRoutingMode(
    event: RuntimeEvent,
    region: Region
  ): 'kafka' | 'redis' | 'db' {
    // Mode selection hierarchy:
    // 1. Kafka: if distributed mode active and not degraded
    // 2. Redis: if REDIS_URL set
    // 3. DB: always available (Supabase)
    const kafka_healthy = kafkaClusterAdapter.isDistributedModeActive()
    const redis_available = !!process.env.REDIS_URL

    // Critical events prefer Kafka for ordering guarantees
    if (event.priority === 'critical' || event.priority === 'high') {
      if (kafka_healthy) return 'kafka'
      if (redis_available) return 'redis'
      return 'db'
    }

    // Standard events can use any mode
    if (redis_available) return 'redis'
    if (kafka_healthy) return 'kafka'
    return 'db'

    void region
  }
}

export const multiRegionRouter = new MultiRegionRouter()
