// =============================================================================
// Agency Group — Traffic Router
// lib/remediation/trafficRouter.ts
//
// Region failover and latency-based routing decisions.
// Stores routing preferences in Redis; does NOT perform actual DNS/CDN changes.
//
// Routing preferences are written to Upstash Redis with TTLs so they auto-expire
// and the system recovers to default routing without manual intervention.
//
// TypeScript strict — 0 errors
// =============================================================================

import { CURRENT_REGION } from '@/lib/events/globalOrdering'
import { setLoadMode, hasLoadModeHold, type LoadMode } from '@/lib/runtime/loadGovernor'

// ─── Public types ─────────────────────────────────────────────────────────────

export type RoutingStrategy = 'primary' | 'fallback' | 'emergency_static' | 'tenant_isolated'

export interface RegionRoute {
  region:        string
  strategy:      RoutingStrategy
  load_mode:     LoadMode
  preferred_for: string[]   // tenant_ids that prefer this route
  activated_at:  string
  reason:        string
  expires_at:    string     // TTL for the routing preference
}

export interface RoutingDecision {
  tenant_id:        string
  from_region:      string
  to_region:        string
  strategy:         RoutingStrategy
  reason:           string
  load_mode_change: LoadMode | null   // load mode to apply; null if no change
  confidence:       number            // 0–1
  applied:          boolean
}

// ─── Region priority order ────────────────────────────────────────────────────

const REGION_FALLBACK_ORDER: string[] = ['eu-west', 'us-east', 'eu-north', 'ap-southeast']

// ─── Redis config ─────────────────────────────────────────────────────────────

interface RedisConfig { url: string; token: string }

function getRedisConfig(): RedisConfig | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return { url, token }
}

// ─── Redis helpers ────────────────────────────────────────────────────────────

async function redisGet(key: string): Promise<string | null> {
  const cfg = getRedisConfig()
  if (!cfg) return null
  try {
    const res = await fetch(
      `${cfg.url}/get/${encodeURIComponent(key)}`,
      {
        headers: { Authorization: `Bearer ${cfg.token}` },
        signal:  AbortSignal.timeout(300),
      },
    )
    if (!res.ok) return null
    const body = await res.json() as { result: string | null }
    return body.result
  } catch {
    return null
  }
}

async function redisSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  const cfg = getRedisConfig()
  if (!cfg) return
  try {
    await fetch(
      `${cfg.url}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}?ex=${ttlSeconds}`,
      {
        method:  'POST',
        headers: { Authorization: `Bearer ${cfg.token}` },
        signal:  AbortSignal.timeout(300),
      },
    )
  } catch {
    // fail-open: ignore Redis write errors
  }
}

async function redisDel(key: string): Promise<void> {
  const cfg = getRedisConfig()
  if (!cfg) return
  try {
    await fetch(
      `${cfg.url}/del/${encodeURIComponent(key)}`,
      {
        method:  'POST',
        headers: { Authorization: `Bearer ${cfg.token}` },
        signal:  AbortSignal.timeout(300),
      },
    )
  } catch {
    // fail-open: ignore Redis delete errors
  }
}

/**
 * XADD with MAXLEN ~ 100. Fire-and-forget, fail-open.
 * Used for routing event audit streams.
 */
async function redisXAdd(key: string, fields: Record<string, string>): Promise<void> {
  const cfg = getRedisConfig()
  if (!cfg) return

  const fieldPairs: string[] = []
  for (const [k, v] of Object.entries(fields)) {
    fieldPairs.push(k, v)
  }

  const body = JSON.stringify([
    ['XADD', key, 'MAXLEN', '~', '100', '*', ...fieldPairs],
  ])

  try {
    await fetch(`${cfg.url}/pipeline`, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${cfg.token}`,
        'Content-Type': 'application/json',
      },
      body,
      signal: AbortSignal.timeout(500),
    })
  } catch {
    // fail-open
  }
}

// ─── getNextFallbackRegion ────────────────────────────────────────────────────

/**
 * Returns the next region in REGION_FALLBACK_ORDER after `currentRegion`.
 * Wraps around: if currentRegion is last, returns the first non-current region.
 * If currentRegion is not in the list, returns the first region.
 */
export function getNextFallbackRegion(currentRegion: string): string {
  const idx = REGION_FALLBACK_ORDER.indexOf(currentRegion)

  if (idx === -1) {
    // Unknown region — return first in list
    return REGION_FALLBACK_ORDER[0]
  }

  const nextIdx = (idx + 1) % REGION_FALLBACK_ORDER.length

  // Wrap-around: if we've wrapped back to the same (unlikely with 4 regions, but safe)
  if (REGION_FALLBACK_ORDER[nextIdx] === currentRegion) {
    // Find first non-current region
    const alt = REGION_FALLBACK_ORDER.find(r => r !== currentRegion)
    return alt ?? REGION_FALLBACK_ORDER[0]
  }

  return REGION_FALLBACK_ORDER[nextIdx]
}

// ─── routeToFallback ──────────────────────────────────────────────────────────

/**
 * Initiates a failover for `tenantId` from `currentRegion` to the next
 * region in the fallback order.
 *
 * Side-effects:
 *   - Sets load mode to STRESSED
 *   - Writes routing preference to Redis (TTL 1h)
 *   - Appends a routing event to the tenant's routing audit stream
 */
export async function routeToFallback(
  tenantId:      string,
  currentRegion: string,
  reason:        string,
): Promise<RoutingDecision> {
  const nextRegion = getNextFallbackRegion(currentRegion)
  const now        = new Date().toISOString()

  // Apply load mode change
  await setLoadMode(tenantId, 'STRESSED', 'auto:reroute')

  // Store routing preference (1h TTL)
  await redisSet(`routing:${tenantId}:preferred_region`, nextRegion, 3600)

  // Append routing event to audit stream — fire-and-forget
  void redisXAdd(`routing_events:${tenantId}`, {
    from:     currentRegion,
    to:       nextRegion,
    reason,
    strategy: 'fallback',
    at:       now,
  })

  return {
    tenant_id:        tenantId,
    from_region:      currentRegion,
    to_region:        nextRegion,
    strategy:         'fallback',
    reason,
    load_mode_change: 'STRESSED',
    confidence:       0.85,
    applied:          true,
  }
}

// ─── routeToEmergencyStatic ───────────────────────────────────────────────────

/**
 * Routes `tenantId` to emergency static content — a last-resort measure when
 * all dynamic regions are unavailable.
 *
 * Side-effects:
 *   - Sets load mode to EMERGENCY
 *   - Writes routing preference to Redis (TTL 30 min)
 */
export async function routeToEmergencyStatic(
  tenantId: string,
  reason:   string,
): Promise<RoutingDecision> {
  const fromRegion = CURRENT_REGION
  const now        = new Date().toISOString()

  // Apply emergency load mode
  await setLoadMode(tenantId, 'EMERGENCY', 'auto:emergency_route')

  // Store routing preference (30 min TTL)
  await redisSet(`routing:${tenantId}:preferred_region`, 'emergency_static', 1800)

  // Append routing event to audit stream — fire-and-forget
  void redisXAdd(`routing_events:${tenantId}`, {
    from:     fromRegion,
    to:       'emergency_static',
    reason,
    strategy: 'emergency_static',
    at:       now,
  })

  return {
    tenant_id:        tenantId,
    from_region:      fromRegion,
    to_region:        'emergency_static',
    strategy:         'emergency_static',
    reason,
    load_mode_change: 'EMERGENCY',
    confidence:       0.95,
    applied:          true,
  }
}

// ─── isolateTenantTraffic ─────────────────────────────────────────────────────

/**
 * Isolates a single tenant's traffic to prevent a noisy-neighbour scenario
 * from affecting other tenants.
 *
 * Side-effects:
 *   - Sets tenant isolation flag in Redis (TTL 1h)
 *   - Sets load mode to EMERGENCY
 */
export async function isolateTenantTraffic(
  tenantId: string,
  reason:   string,
): Promise<RoutingDecision> {
  const fromRegion = CURRENT_REGION
  const now        = new Date().toISOString()

  // Set isolation flag (1h TTL)
  await redisSet(`tenant_isolated:${tenantId}`, 'true', 3600)

  // Apply emergency load mode for this context
  await setLoadMode(tenantId, 'EMERGENCY', 'auto:tenant_isolation')

  // Append routing event to audit stream — fire-and-forget
  void redisXAdd(`routing_events:${tenantId}`, {
    from:     fromRegion,
    to:       'isolated',
    reason,
    strategy: 'tenant_isolated',
    at:       now,
  })

  return {
    tenant_id:        tenantId,
    from_region:      fromRegion,
    to_region:        'isolated',
    strategy:         'tenant_isolated',
    reason,
    load_mode_change: 'EMERGENCY',
    confidence:       0.9,
    applied:          true,
  }
}

// ─── getCurrentRoute ──────────────────────────────────────────────────────────

/**
 * Returns the active custom routing for a tenant, or null if the tenant is
 * using default routing.
 *
 * Reads `routing:{tenantId}:preferred_region` from Redis.
 */
export async function getCurrentRoute(tenantId: string): Promise<RegionRoute | null> {
  const preferred = await redisGet(`routing:${tenantId}:preferred_region`)
  if (preferred === null) return null

  // Infer strategy from stored value
  let strategy: RoutingStrategy = 'fallback'
  if (preferred === 'emergency_static') strategy = 'emergency_static'
  else if (preferred === 'isolated')    strategy = 'tenant_isolated'

  // We don't persist full route metadata separately to keep Redis writes minimal.
  // Return a best-effort RegionRoute from the stored value.
  const now = new Date()
  return {
    region:        preferred,
    strategy,
    load_mode:     strategy === 'fallback' ? 'STRESSED' : 'EMERGENCY',
    preferred_for: [tenantId],
    activated_at:  now.toISOString(),  // activation time not stored separately — approximate
    reason:        'stored_routing_preference',
    expires_at:    new Date(now.getTime() + 3600 * 1000).toISOString(),
  }
}

// ─── restoreDefaultRoute ──────────────────────────────────────────────────────

/**
 * Removes any custom routing preference for a tenant and restores the load
 * governor to NORMAL mode.
 *
 * Safe to call even when no custom routing is active.
 */
export async function restoreDefaultRoute(tenantId: string): Promise<void> {
  // Always remove the routing preference key
  await redisDel(`routing:${tenantId}:preferred_region`)

  // Only restore NORMAL mode when no other remediation holds a load-mode lock
  const held = await hasLoadModeHold(tenantId).catch(() => false)
  if (!held) {
    await setLoadMode(tenantId, 'NORMAL', 'auto:route_restored')
  }
}
