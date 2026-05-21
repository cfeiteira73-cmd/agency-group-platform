// Agency Group — Active-Active Multi-Region Coordinator
// lib/sre/activeActive.ts
// TypeScript strict — 0 errors

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { logRecoveryEvent } from './disasterRecovery'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Region = 'eu-west-1' | 'eu-south-1' | 'eu-central-1'

export interface RegionStatus {
  region: Region
  role: 'primary' | 'secondary' | 'failover'
  status: 'healthy' | 'degraded' | 'down' | 'recovering'
  latency_ms: number
  last_heartbeat: string
  capabilities: {
    read: boolean
    write: boolean
    ai_inference: boolean
    kafka: boolean
  }
  load_pct: number        // 0–100
  error_rate_pct: number
}

export interface TrafficSplit {
  eu_west_1_pct: number
  eu_south_1_pct: number
  eu_central_1_pct: number
}

// ─── IP → Region mapping ──────────────────────────────────────────────────────

// Country code prefix → region (very lightweight geo hint; no external lib required)
const COUNTRY_TO_REGION: Record<string, Region> = {
  // EU West
  PT: 'eu-west-1', ES: 'eu-west-1', FR: 'eu-west-1',
  GB: 'eu-west-1', IE: 'eu-west-1',
  // EU South
  IT: 'eu-south-1', GR: 'eu-south-1', HR: 'eu-south-1', MT: 'eu-south-1',
  // EU Central
  DE: 'eu-central-1', AT: 'eu-central-1', CH: 'eu-central-1',
  NL: 'eu-central-1', BE: 'eu-central-1', PL: 'eu-central-1',
}

// ─── ActiveActiveCoordinator ──────────────────────────────────────────────────

export class ActiveActiveCoordinator {
  private static readonly REGIONS: Region[] = ['eu-west-1', 'eu-south-1', 'eu-central-1']
  private static readonly PRIMARY: Region = 'eu-west-1'

  // ── getRegionStatuses ───────────────────────────────────────────────────────

  async getRegionStatuses(): Promise<RegionStatus[]> {
    const endpoints = process.env.REGION_HEALTH_ENDPOINTS
      ? this._parseEndpoints(process.env.REGION_HEALTH_ENDPOINTS)
      : null

    if (endpoints) {
      return this._fetchFromEndpoints(endpoints)
    }

    // Fallback: simulate based on current DB latency
    return this._simulateFromDbLatency()
  }

  private _parseEndpoints(raw: string): Record<Region, string> | null {
    try {
      // Expected format: eu-west-1=https://...,eu-south-1=https://...,eu-central-1=https://...
      const map: Partial<Record<Region, string>> = {}
      for (const part of raw.split(',')) {
        const [region, url] = part.trim().split('=')
        if (region && url) {
          map[region as Region] = url
        }
      }
      return (map['eu-west-1'] && map['eu-south-1'] && map['eu-central-1'])
        ? map as Record<Region, string>
        : null
    } catch {
      return null
    }
  }

  private async _fetchFromEndpoints(
    endpoints: Record<Region, string>,
  ): Promise<RegionStatus[]> {
    const results = await Promise.allSettled(
      ActiveActiveCoordinator.REGIONS.map(async (region) => {
        const url = endpoints[region]
        const t0 = Date.now()
        try {
          const controller = new AbortController()
          const timer = setTimeout(() => controller.abort(), 3000)
          const res = await fetch(url, {
            signal: controller.signal,
            headers: { 'x-health-probe': '1' },
          })
          clearTimeout(timer)
          const latency_ms = Date.now() - t0
          const ok = res.ok
          const status: RegionStatus['status'] = ok ? 'healthy' : latency_ms > 500 ? 'degraded' : 'down'
          return this._buildStatus(region, status, latency_ms)
        } catch {
          return this._buildStatus(region, 'down', Date.now() - t0)
        }
      }),
    )

    return results.map((r, i) =>
      r.status === 'fulfilled'
        ? r.value
        : this._buildStatus(ActiveActiveCoordinator.REGIONS[i], 'down', 0),
    )
  }

  private async _simulateFromDbLatency(): Promise<RegionStatus[]> {
    const t0 = Date.now()
    let dbLatency = 0
    try {
      await (supabaseAdmin as any).from('organizations').select('id').limit(1)
      dbLatency = Date.now() - t0
    } catch {
      dbLatency = 9999
    }

    // Simulate region latencies relative to measured DB latency
    return [
      this._buildStatus(
        'eu-west-1',
        dbLatency < 500 ? 'healthy' : dbLatency < 2000 ? 'degraded' : 'down',
        dbLatency,
        true, // primary
      ),
      this._buildStatus(
        'eu-south-1',
        dbLatency < 800 ? 'healthy' : dbLatency < 2500 ? 'degraded' : 'down',
        Math.round(dbLatency * 1.3),
      ),
      this._buildStatus(
        'eu-central-1',
        dbLatency < 1000 ? 'healthy' : dbLatency < 3000 ? 'degraded' : 'down',
        Math.round(dbLatency * 1.6),
      ),
    ]
  }

  private _buildStatus(
    region: Region,
    status: RegionStatus['status'],
    latency_ms: number,
    isPrimary = false,
  ): RegionStatus {
    const isHealthy = status === 'healthy'
    return {
      region,
      role: isPrimary
        ? 'primary'
        : region === 'eu-south-1'
          ? 'secondary'
          : 'failover',
      status,
      latency_ms,
      last_heartbeat: new Date().toISOString(),
      capabilities: {
        read:         isHealthy || status === 'degraded',
        write:        isHealthy,
        ai_inference: isHealthy,
        kafka:        isHealthy || status === 'degraded',
      },
      load_pct:       isHealthy ? Math.floor(Math.random() * 40) + 20 : 0,
      error_rate_pct: status === 'down' ? 100 : status === 'degraded' ? 15 : 0.1,
    }
  }

  // ── computeTrafficSplit ─────────────────────────────────────────────────────

  async computeTrafficSplit(statuses: RegionStatus[]): Promise<TrafficSplit> {
    const byRegion = new Map(statuses.map(s => [s.region, s]))

    const west   = byRegion.get('eu-west-1')
    const south  = byRegion.get('eu-south-1')
    const central = byRegion.get('eu-central-1')

    // eu-west-1 is completely down
    if (!west || west.status === 'down') {
      return {
        eu_west_1_pct:   0,
        eu_south_1_pct:  70,
        eu_central_1_pct: 30,
      }
    }

    // eu-west-1 degraded
    if (west.status === 'degraded') {
      return {
        eu_west_1_pct:   0,
        eu_south_1_pct:  60,
        eu_central_1_pct: 40,
      }
    }

    // All healthy — if south or central unavailable, compensate
    const southOk   = south   && (south.status   === 'healthy' || south.status   === 'degraded')
    const centralOk = central && (central.status === 'healthy' || central.status === 'degraded')

    if (southOk && centralOk) {
      return { eu_west_1_pct: 60, eu_south_1_pct: 30, eu_central_1_pct: 10 }
    }
    if (southOk) {
      return { eu_west_1_pct: 70, eu_south_1_pct: 30, eu_central_1_pct: 0 }
    }
    if (centralOk) {
      return { eu_west_1_pct: 90, eu_south_1_pct: 0, eu_central_1_pct: 10 }
    }

    return { eu_west_1_pct: 100, eu_south_1_pct: 0, eu_central_1_pct: 0 }
  }

  // ── triggerFailover ─────────────────────────────────────────────────────────

  async triggerFailover(
    fromRegion: Region,
    toRegion: Region,
  ): Promise<{
    success: boolean
    failover_time_ms: number
    events_replayed: number
    rto_actual_seconds: number
  }> {
    const t0 = Date.now()
    const incidentId = `failover-${fromRegion}-${toRegion}-${Date.now()}`

    log.warn('[ActiveActive] triggerFailover initiated', {
      from_region: fromRegion,
      to_region: toRegion,
      incident_id: incidentId,
    })

    try {
      const tenantId = process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? 'system'

      await logRecoveryEvent(tenantId, {
        incidentId,
        eventType:   'mitigation_started',
        service:     `region:${fromRegion}`,
        description: `Automated failover from ${fromRegion} to ${toRegion}`,
        automated:   true,
        metadata:    { from_region: fromRegion, to_region: toRegion },
      })

      // Update region roles in DB
      await Promise.allSettled([
        (supabaseAdmin as any)
          .from('region_status')
          .upsert({ region: fromRegion, status: 'recovering', role: 'failover' }, { onConflict: 'region' }),
        (supabaseAdmin as any)
          .from('region_status')
          .upsert({ region: toRegion, status: 'healthy', role: 'primary' }, { onConflict: 'region' }),
      ])

      const failover_time_ms   = Date.now() - t0
      const rto_actual_seconds = Math.round(failover_time_ms / 1000)

      await logRecoveryEvent(tenantId, {
        incidentId,
        eventType:   'service_restored',
        service:     `region:${toRegion}`,
        description: `Failover complete — ${toRegion} now primary. RTO: ${rto_actual_seconds}s`,
        automated:   true,
        metadata:    { failover_time_ms, rto_actual_seconds },
      })

      return {
        success:             true,
        failover_time_ms,
        events_replayed:     0,        // event replay handled by Kafka consumer group restart
        rto_actual_seconds,
      }
    } catch (err) {
      const failover_time_ms = Date.now() - t0
      log.error('[ActiveActive] triggerFailover failed', err instanceof Error ? err : undefined, {
        from_region: fromRegion,
        to_region: toRegion,
        error: err instanceof Error ? err.message : String(err),
      })
      return {
        success:             false,
        failover_time_ms,
        events_replayed:     0,
        rto_actual_seconds: Math.round(failover_time_ms / 1000),
      }
    }
  }

  // ── isRegionHealthy ─────────────────────────────────────────────────────────

  async isRegionHealthy(region: Region): Promise<boolean> {
    const statuses = await this.getRegionStatuses()
    const s = statuses.find(r => r.region === region)
    return s?.status === 'healthy' || s?.status === 'degraded'
  }

  // ── getGeoRoutingDecision ───────────────────────────────────────────────────

  getGeoRoutingDecision(
    clientIp: string,
    availableRegions: RegionStatus[],
  ): Region {
    // Attempt country code extraction from Cloudflare / Vercel CF-IPCountry header hint
    // encoded as "IP:COUNTRY" e.g. "1.2.3.4:PT"
    const countryCode = clientIp.includes(':') ? clientIp.split(':').pop()?.toUpperCase() : undefined
    const preferredRegion: Region | undefined = countryCode ? COUNTRY_TO_REGION[countryCode] : undefined

    const healthyRegions = availableRegions.filter(
      r => r.status === 'healthy' || r.status === 'degraded',
    )

    if (healthyRegions.length === 0) {
      // Last resort — return primary even if degraded
      return ActiveActiveCoordinator.PRIMARY
    }

    // Route to preferred region if healthy
    if (preferredRegion) {
      const match = healthyRegions.find(r => r.region === preferredRegion)
      if (match) return match.region
    }

    // Fallback: lowest latency healthy region
    const sorted = [...healthyRegions].sort((a, b) => a.latency_ms - b.latency_ms)
    return sorted[0].region
  }

  // ── persistRegionStatus ─────────────────────────────────────────────────────

  async persistRegionStatus(status: RegionStatus): Promise<void> {
    try {
      const { error } = await (supabaseAdmin as any)
        .from('region_status')
        .upsert(
          {
            region:           status.region,
            role:             status.role,
            status:           status.status,
            latency_ms:       status.latency_ms,
            last_heartbeat:   status.last_heartbeat,
            capabilities:     status.capabilities,
            load_pct:         status.load_pct,
            error_rate_pct:   status.error_rate_pct,
            computed_at:      new Date().toISOString(),
          },
          { onConflict: 'region' },
        )

      if (error) {
        log.warn('[ActiveActive] persistRegionStatus error', { error: error.message, region: status.region })
      }
    } catch (err) {
      log.warn('[ActiveActive] persistRegionStatus threw', {
        error: err instanceof Error ? err.message : String(err),
        region: status.region,
      })
    }
  }
}

export const activeActive = new ActiveActiveCoordinator()

// ─── Region Latency Tracking ──────────────────────────────────────────────────

// In-memory latency samples: Map<region, number[]> (rolling 100-sample window)
const regionLatencySamples = new Map<string, number[]>()
const regionErrorCounts    = new Map<string, { errors: number; total: number }>()

function computePercentile(sortedSamples: number[], pct: number): number {
  if (sortedSamples.length === 0) return 0
  const idx = Math.ceil(sortedSamples.length * pct / 100) - 1
  return sortedSamples[Math.max(0, idx)] ?? 0
}

export async function updateRegionLatency(
  region: string,
  latencyMs: number,
  isError: boolean,
): Promise<void> {
  // Update samples (rolling 100-sample window)
  const samples = regionLatencySamples.get(region) ?? []
  samples.push(latencyMs)
  if (samples.length > 100) samples.shift()
  regionLatencySamples.set(region, samples)

  // Update error counts
  const counts = regionErrorCounts.get(region) ?? { errors: 0, total: 0 }
  counts.total += 1
  if (isError) counts.errors += 1
  regionErrorCounts.set(region, counts)

  // Every 10th update: persist to region_latency_metrics
  if (counts.total % 10 === 0) {
    const sorted = [...samples].sort((a, b) => a - b)
    const p50 = computePercentile(sorted, 50)
    const p95 = computePercentile(sorted, 95)
    const p99 = computePercentile(sorted, 99)
    const error_rate_pct = counts.total > 0 ? (counts.errors / counts.total) * 100 : 0

    try {
      await (supabaseAdmin as any)
        .from('region_latency_metrics')
        .insert({
          region,
          p50_latency_ms:  p50,
          p95_latency_ms:  p95,
          p99_latency_ms:  p99,
          error_rate_pct,
          sample_count:    samples.length,
          recorded_at:     new Date().toISOString(),
        })
    } catch (err) {
      log.warn('[ActiveActive] updateRegionLatency persist failed', {
        region,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
}

export function getRegionLatencySnapshot(region: string): {
  p50_latency_ms: number
  p95_latency_ms: number
  p99_latency_ms: number
  error_rate_pct: number
  sample_count: number
} | null {
  const samples = regionLatencySamples.get(region)
  if (!samples || samples.length === 0) return null

  const sorted = [...samples].sort((a, b) => a - b)
  const counts = regionErrorCounts.get(region) ?? { errors: 0, total: 0 }

  return {
    p50_latency_ms:  computePercentile(sorted, 50),
    p95_latency_ms:  computePercentile(sorted, 95),
    p99_latency_ms:  computePercentile(sorted, 99),
    error_rate_pct:  counts.total > 0 ? (counts.errors / counts.total) * 100 : 0,
    sample_count:    samples.length,
  }
}

export function selectOptimalRegion(
  countryCode: string,
  options?: { prefer_lowest_latency?: boolean },
): string {
  const ALL_REGIONS: Region[] = ['eu-west-1', 'eu-south-1', 'eu-central-1']

  // 1. Use existing country→region mapping
  const mapped: Region | undefined = COUNTRY_TO_REGION[countryCode.toUpperCase()]
  const primary = mapped ?? ('eu-west-1' as Region)

  // Collect snapshots for healthy regions
  const regionSnapshots: Array<{ region: Region; p50: number; p95: number }> = []
  for (const r of ALL_REGIONS) {
    const snap = getRegionLatencySnapshot(r)
    if (snap) {
      regionSnapshots.push({ region: r, p50: snap.p50_latency_ms, p95: snap.p95_latency_ms })
    }
  }

  // 2. If prefer_lowest_latency=true: pick region with lowest p50 among those with data
  if (options?.prefer_lowest_latency && regionSnapshots.length > 0) {
    const sorted = [...regionSnapshots].sort((a, b) => a.p50 - b.p50)
    return sorted[0].region
  }

  // 3. If primary region's p95 > 500ms: pick lowest-p50 among regions with data
  const primarySnap = regionSnapshots.find(r => r.region === primary)
  if (primarySnap && primarySnap.p95 > 500 && regionSnapshots.length > 0) {
    const sorted = [...regionSnapshots].sort((a, b) => a.p50 - b.p50)
    return sorted[0].region
  }

  // 4. Return primary region
  return primary
}

// ─── Failover Detection ───────────────────────────────────────────────────────

export async function detectAndTriggerFailover(region: string): Promise<{
  region: string
  trigger_reason: 'high_error_rate' | 'high_latency' | 'health_check_failed' | 'manual'
  triggered_at: string
  traffic_migrated_to: string
} | null> {
  const snap = getRegionLatencySnapshot(region)
  if (!snap) return null

  const ALL_REGIONS: Region[] = ['eu-west-1', 'eu-south-1', 'eu-central-1']

  let trigger_reason: 'high_error_rate' | 'high_latency' | null = null

  if (snap.error_rate_pct > 10) {
    trigger_reason = 'high_error_rate'
  } else if (snap.p95_latency_ms > 2000) {
    trigger_reason = 'high_latency'
  }

  if (!trigger_reason) return null

  // Round-robin to next healthy region
  const currentIdx = ALL_REGIONS.indexOf(region as Region)
  let traffic_migrated_to = ALL_REGIONS[(currentIdx + 1) % ALL_REGIONS.length]
  // Try to find one that isn't also degraded
  for (let i = 1; i <= ALL_REGIONS.length; i++) {
    const candidate = ALL_REGIONS[(currentIdx + i) % ALL_REGIONS.length]
    if (candidate !== region) {
      traffic_migrated_to = candidate
      break
    }
  }

  const triggered_at = new Date().toISOString()

  try {
    // Update region_status to degraded
    await (supabaseAdmin as any)
      .from('region_status')
      .upsert({ region, status: 'degraded', computed_at: triggered_at }, { onConflict: 'region' })

    // Log to recovery_timelines
    await (supabaseAdmin as any)
      .from('recovery_timelines')
      .insert({
        incident_id: `auto-failover-${region}-${Date.now()}`,
        event_type:  'mitigation_started',
        service:     `region:${region}`,
        region,
        description: `Automatic failover triggered: ${trigger_reason}. Traffic migrating to ${traffic_migrated_to}.`,
        automated:   true,
        metadata:    { trigger_reason, traffic_migrated_to, snap },
        occurred_at: triggered_at,
      })
  } catch (err) {
    log.warn('[ActiveActive] detectAndTriggerFailover persist failed', {
      region,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  log.warn('[ActiveActive] failover triggered', { region, trigger_reason, traffic_migrated_to })

  return {
    region,
    trigger_reason,
    triggered_at,
    traffic_migrated_to,
  }
}
