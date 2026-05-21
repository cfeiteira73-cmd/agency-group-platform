// TypeScript strict — 0 errors
// lib/sre/activeActiveRouter.ts
// Multi-Region Resilience Layer: latency-based failover across EU regions

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type RegionId   = 'eu-west' | 'eu-south' | 'eu-central'
export type RegionMode = 'active' | 'hot_standby' | 'cold_failover'
export type RegionHealth = 'healthy' | 'degraded' | 'unavailable'

export interface RegionConfig {
  id: RegionId
  name: string
  mode: RegionMode
  supabase_url: string
  latency_threshold_ms: number
  health: RegionHealth
  last_health_check: string
  avg_latency_ms: number | null
  error_rate_pct: number | null
  priority: number
}

export interface RoutingDecision {
  selected_region: RegionId
  reason: string
  fallback_used: boolean
  latency_at_decision: number | null
  decided_at: string
}

// ─── In-memory health cache (refreshed by checkAllRegionHealth) ───────────────

interface HealthCache {
  health: RegionHealth
  avg_latency_ms: number | null
  error_rate_pct: number | null
  last_check: string
}

const _healthCache = new Map<RegionId, HealthCache>()

function _cached(region: RegionId): HealthCache {
  return _healthCache.get(region) ?? {
    health: 'healthy',
    avg_latency_ms: null,
    error_rate_pct: null,
    last_check: new Date(0).toISOString(),
  }
}

// ─── getRegionConfigs ──────────────────────────────────────────────────────────

export function getRegionConfigs(): RegionConfig[] {
  const primary    = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const southUrl   = process.env.SUPABASE_EU_SOUTH_URL   ?? ''
  const centralUrl = process.env.SUPABASE_EU_CENTRAL_URL ?? ''

  const cWest    = _cached('eu-west')
  const cSouth   = _cached('eu-south')
  const cCentral = _cached('eu-central')

  return [
    {
      id: 'eu-west',
      name: 'EU-West (Lisbon/Frankfurt)',
      mode: 'active',
      supabase_url: primary,
      latency_threshold_ms: 500,
      health: cWest.health,
      last_health_check: cWest.last_check,
      avg_latency_ms: cWest.avg_latency_ms,
      error_rate_pct: cWest.error_rate_pct,
      priority: 1,
    },
    {
      id: 'eu-south',
      name: 'EU-South (Milan/Madrid)',
      mode: southUrl ? 'hot_standby' : 'cold_failover',
      supabase_url: southUrl,
      latency_threshold_ms: 700,
      health: southUrl ? cSouth.health : 'unavailable',
      last_health_check: cSouth.last_check,
      avg_latency_ms: cSouth.avg_latency_ms,
      error_rate_pct: cSouth.error_rate_pct,
      priority: 2,
    },
    {
      id: 'eu-central',
      name: 'EU-Central (Amsterdam/Warsaw)',
      mode: centralUrl ? 'hot_standby' : 'cold_failover',
      supabase_url: centralUrl,
      latency_threshold_ms: 800,
      health: centralUrl ? cCentral.health : 'unavailable',
      last_health_check: cCentral.last_check,
      avg_latency_ms: cCentral.avg_latency_ms,
      error_rate_pct: cCentral.error_rate_pct,
      priority: 3,
    },
  ]
}

// ─── routeRequest ─────────────────────────────────────────────────────────────

export async function routeRequest(
  tenantId: string,
  opts?: { force_region?: RegionId; latency_threshold_override?: number },
): Promise<RoutingDecision> {
  const decided_at = new Date().toISOString()

  // Forced routing
  if (opts?.force_region) {
    const decision: RoutingDecision = {
      selected_region: opts.force_region,
      reason: 'forced',
      fallback_used: opts.force_region !== 'eu-west',
      latency_at_decision: null,
      decided_at,
    }
    void _persistRoutingDecision(tenantId, decision)
    return decision
  }

  const configs = getRegionConfigs()
  const west    = configs.find(c => c.id === 'eu-west')!
  const south   = configs.find(c => c.id === 'eu-south')!
  const central = configs.find(c => c.id === 'eu-central')!

  const threshold = opts?.latency_threshold_override ?? west.latency_threshold_ms
  const westLatency = west.avg_latency_ms

  // 1. EU-West healthy and latency within threshold
  if (west.health === 'healthy' && (westLatency === null || westLatency < threshold)) {
    const decision: RoutingDecision = {
      selected_region: 'eu-west',
      reason: 'primary_healthy',
      fallback_used: false,
      latency_at_decision: westLatency,
      decided_at,
    }
    void _persistRoutingDecision(tenantId, decision)
    return decision
  }

  // 2. EU-West latency too high — try EU-South
  const southUrl = process.env.SUPABASE_EU_SOUTH_URL ?? ''
  if (southUrl && south.health !== 'unavailable') {
    const decision: RoutingDecision = {
      selected_region: 'eu-south',
      reason: 'failover_latency',
      fallback_used: true,
      latency_at_decision: south.avg_latency_ms,
      decided_at,
    }
    void _persistRoutingDecision(tenantId, decision)
    return decision
  }

  // 3. Try EU-Central
  const centralUrl = process.env.SUPABASE_EU_CENTRAL_URL ?? ''
  if (centralUrl && central.health !== 'unavailable') {
    const decision: RoutingDecision = {
      selected_region: 'eu-central',
      reason: 'failover_error_rate',
      fallback_used: true,
      latency_at_decision: central.avg_latency_ms,
      decided_at,
    }
    void _persistRoutingDecision(tenantId, decision)
    return decision
  }

  // 4. Graceful degradation — fallback to EU-West regardless
  const decision: RoutingDecision = {
    selected_region: 'eu-west',
    reason: 'primary_healthy',
    fallback_used: false,
    latency_at_decision: westLatency,
    decided_at,
  }
  void _persistRoutingDecision(tenantId, decision)
  return decision
}

async function _persistRoutingDecision(tenantId: string, d: RoutingDecision): Promise<void> {
  try {
    const tid = tenantId || (process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001')
    await (supabaseAdmin as any).from('routing_decisions').insert({
      tenant_id:       tid,
      selected_region: d.selected_region,
      reason:          d.reason,
      fallback_used:   d.fallback_used,
      latency_ms:      d.latency_at_decision,
      decided_at:      d.decided_at,
    })
  } catch (e) {
    log.warn('[activeActiveRouter] _persistRoutingDecision failed', {
      error: e instanceof Error ? e.message : String(e),
    })
  }
}

// ─── recordHealthCheck ────────────────────────────────────────────────────────

export async function recordHealthCheck(
  region: RegionId,
  latency_ms: number,
  healthy: boolean,
  error_rate_pct?: number,
): Promise<void> {
  const checked_at = new Date().toISOString()

  // Update in-memory cache
  const prev = _healthCache.get(region)
  const prevLatency = prev?.avg_latency_ms ?? null
  const newAvg = prevLatency !== null
    ? Math.round((prevLatency + latency_ms) / 2)
    : latency_ms

  _healthCache.set(region, {
    health: healthy ? 'healthy' : latency_ms < 1000 ? 'degraded' : 'unavailable',
    avg_latency_ms: newAvg,
    error_rate_pct: error_rate_pct ?? null,
    last_check: checked_at,
  })

  void (async () => {
    try {
      await (supabaseAdmin as any).from('region_health_log').insert({
        region_id:  region,
        healthy,
        latency_ms,
        error_rate: error_rate_pct ?? null,
        checked_at,
      })
    } catch (e) {
      log.warn('[activeActiveRouter] recordHealthCheck persist failed', {
        error: e instanceof Error ? e.message : String(e),
      })
    }
  })()
}

// ─── checkAllRegionHealth ─────────────────────────────────────────────────────

export async function checkAllRegionHealth(): Promise<Record<RegionId, { healthy: boolean; latency_ms: number }>> {
  const configs = getRegionConfigs()

  const results = await Promise.all(
    configs.map(async (cfg): Promise<[RegionId, { healthy: boolean; latency_ms: number }]> => {
      if (!cfg.supabase_url) {
        return [cfg.id, { healthy: false, latency_ms: 0 }]
      }
      const t0 = Date.now()
      try {
        const resp = await fetch(`${cfg.supabase_url}/rest/v1/`, {
          signal: AbortSignal.timeout(3000),
          headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '' },
        })
        const latency_ms = Date.now() - t0
        const healthy = resp.status < 500
        void recordHealthCheck(cfg.id, latency_ms, healthy)
        return [cfg.id, { healthy, latency_ms }]
      } catch {
        const latency_ms = Date.now() - t0
        void recordHealthCheck(cfg.id, latency_ms, false)
        return [cfg.id, { healthy: false, latency_ms }]
      }
    }),
  )

  return Object.fromEntries(results) as Record<RegionId, { healthy: boolean; latency_ms: number }>
}

// ─── getActiveRegion ──────────────────────────────────────────────────────────

export function getActiveRegion(): RegionId {
  const configs = getRegionConfigs()
  const healthy = configs.filter(c => c.health === 'healthy').sort((a, b) => a.priority - b.priority)
  return healthy[0]?.id ?? 'eu-west'
}

// ─── getRegionHealthHistory ───────────────────────────────────────────────────

export async function getRegionHealthHistory(
  region?: RegionId,
  hours = 24,
): Promise<Array<{ region: RegionId; healthy: boolean; latency_ms: number; checked_at: string }>> {
  try {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
    let q = (supabaseAdmin as any)
      .from('region_health_log')
      .select('region_id, healthy, latency_ms, checked_at')
      .gte('checked_at', since)
      .order('checked_at', { ascending: false })
      .limit(500)

    if (region) {
      q = q.eq('region_id', region)
    }

    const { data, error } = await q
    if (error) {
      log.warn('[activeActiveRouter] getRegionHealthHistory query error', { error: error.message })
      return []
    }

    return ((data as Array<{ region_id: string; healthy: boolean; latency_ms: number; checked_at: string }>) ?? []).map(
      row => ({
        region:     row.region_id as RegionId,
        healthy:    row.healthy,
        latency_ms: row.latency_ms,
        checked_at: row.checked_at,
      }),
    )
  } catch (e) {
    log.warn('[activeActiveRouter] getRegionHealthHistory threw', {
      error: e instanceof Error ? e.message : String(e),
    })
    return []
  }
}
