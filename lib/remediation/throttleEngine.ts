// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Throttle Engine
// lib/remediation/throttleEngine.ts
//
// Per-tenant dynamic throttling with formula-based factor computation.
//
// Formula (computeThrottleFactor):
//   base_penalty = (latency_spike - 1.0) × 0.3
//                + error_rate × 0.4
//                + (cost_spike - 1.0) × 0.2
//                + Math.min(queue_depth / 1000, 1.0) × 0.1
//   throttle_factor = clamp(1.0 - base_penalty, 0, 1)
//
// LoadMode mapping:
//   throttle_factor > 0.8  → NORMAL
//   0.5–0.8                → STRESSED
//   0.2–0.5                → CRITICAL
//   < 0.2                  → EMERGENCY
//
// All Redis operations are fail-open. AbortSignal.timeout(500) on all calls.
// Throttle context stored in Redis for 30 min (key: throttle_context:{tenantId}).
// =============================================================================

import { setLoadMode, hasLoadModeHold, type LoadMode } from '@/lib/runtime/loadGovernor'
import { type IncidentRow }           from '@/lib/incidents/incidentIngestor'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ThrottleContext {
  tenant_id:     string
  latency_spike: number  // ratio: current_p95 / baseline_p95  (1.0 = normal)
  error_rate:    number  // 0–1
  cost_spike:    number  // ratio: current_cost / baseline_cost (1.0 = normal)
  queue_depth:   number  // absolute queue depth
}

export interface ThrottleDecision {
  tenant_id:          string
  throttle_factor:    number    // 0–1: 0 = full block, 1 = no throttle
  target_load_mode:   LoadMode
  ai_token_reduction: number    // fraction to reduce AI token budget (0–1)
  queue_dampening:    number    // fraction to reduce queue processing rate (0–1)
  shedding_threshold: number    // requests/min above which to shed load
  justification:      string
  computed_at:        string
}

// ─── Redis helpers (Upstash REST — same pattern as economicsCache.ts) ─────────

interface RedisConfig { url: string; token: string }

function getRedisConfig(): RedisConfig | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return { url, token }
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
        signal:  AbortSignal.timeout(500),
      },
    )
  } catch {
    // fail-open: ignore Redis write errors
  }
}

async function redisGet(key: string): Promise<string | null> {
  const cfg = getRedisConfig()
  if (!cfg) return null
  try {
    const res = await fetch(
      `${cfg.url}/get/${encodeURIComponent(key)}`,
      {
        headers: { Authorization: `Bearer ${cfg.token}` },
        signal:  AbortSignal.timeout(500),
      },
    )
    if (!res.ok) return null
    const body = await res.json() as { result: string | null }
    return body.result
  } catch {
    return null
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
        signal:  AbortSignal.timeout(500),
      },
    )
  } catch {
    // fail-open: ignore Redis delete errors
  }
}

// ─── Core formula ─────────────────────────────────────────────────────────────

/**
 * Computes the throttle factor for a tenant given its current system context.
 *
 * Formula:
 *   base_penalty = (latency_spike - 1.0) × 0.3
 *                + error_rate × 0.4
 *                + (cost_spike - 1.0) × 0.2
 *                + Math.min(queue_depth / 1000, 1.0) × 0.1
 *
 *   throttle_factor = clamp(1.0 - base_penalty, 0, 1)
 *
 * Returns a value in [0, 1]:
 *   1.0 = no throttle (all signals nominal)
 *   0.0 = full block  (all signals maxed out)
 */
export function computeThrottleFactor(ctx: ThrottleContext): number {
  const latencyPenalty = (ctx.latency_spike - 1.0) * 0.3
  const errorPenalty   = ctx.error_rate * 0.4
  const costPenalty    = (ctx.cost_spike - 1.0) * 0.2
  const queuePenalty   = Math.min(ctx.queue_depth / 1000, 1.0) * 0.1

  const basePenalty    = latencyPenalty + errorPenalty + costPenalty + queuePenalty
  const throttleFactor = Math.max(0, Math.min(1, 1.0 - basePenalty))

  return throttleFactor
}

/**
 * Maps a throttle factor to a LoadMode.
 *
 *   > 0.8  → NORMAL
 *   0.5–0.8 → STRESSED
 *   0.2–0.5 → CRITICAL
 *   < 0.2  → EMERGENCY
 */
function throttleFactorToLoadMode(throttleFactor: number): LoadMode {
  if (throttleFactor > 0.8) return 'NORMAL'
  if (throttleFactor >= 0.5) return 'STRESSED'
  if (throttleFactor >= 0.2) return 'CRITICAL'
  return 'EMERGENCY'
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Builds a complete ThrottleDecision from a ThrottleContext.
 *
 * Derived fields:
 *   ai_token_reduction   = 1 - throttle_factor
 *   queue_dampening      = max(0, 1 - throttle_factor × 1.5)
 *   shedding_threshold   = 1000 × throttle_factor  (requests/min)
 */
export function buildThrottleDecision(ctx: ThrottleContext): ThrottleDecision {
  const throttleFactor   = computeThrottleFactor(ctx)
  const targetLoadMode   = throttleFactorToLoadMode(throttleFactor)
  const aiTokenReduction = 1 - throttleFactor
  const queueDampening   = Math.max(0, 1 - throttleFactor * 1.5)
  const sheddingThreshold = 1000 * throttleFactor

  const justification =
    `throttle_factor=${throttleFactor.toFixed(4)} ` +
    `[latency_spike=${ctx.latency_spike.toFixed(2)} ` +
    `error_rate=${ctx.error_rate.toFixed(3)} ` +
    `cost_spike=${ctx.cost_spike.toFixed(2)} ` +
    `queue_depth=${ctx.queue_depth}] → ` +
    `mode=${targetLoadMode} ` +
    `ai_token_reduction=${(aiTokenReduction * 100).toFixed(1)}% ` +
    `queue_dampening=${(queueDampening * 100).toFixed(1)}% ` +
    `shedding_threshold=${Math.round(sheddingThreshold)} req/min`

  return {
    tenant_id:          ctx.tenant_id,
    throttle_factor:    throttleFactor,
    target_load_mode:   targetLoadMode,
    ai_token_reduction: aiTokenReduction,
    queue_dampening:    queueDampening,
    shedding_threshold: sheddingThreshold,
    justification,
    computed_at:        new Date().toISOString(),
  }
}

/**
 * Applies a throttle decision for the tenant:
 *   1. Builds the ThrottleDecision from the context.
 *   2. Calls setLoadMode() with the target load mode.
 *   3. Stores the throttle context in Redis (TTL 30 min).
 *
 * Fail-open: if any step fails, returns applied=false with the decision still
 * populated so the caller can inspect what would have been applied.
 */
export async function applyThrottle(
  ctx: ThrottleContext,
): Promise<{ decision: ThrottleDecision; applied: boolean }> {
  const decision = buildThrottleDecision(ctx)

  try {
    await setLoadMode(ctx.tenant_id, decision.target_load_mode, 'auto:throttle')
    await redisSet(
      `throttle_context:${ctx.tenant_id}`,
      JSON.stringify(decision),
      1_800,   // 30 min TTL
    )
    return { decision, applied: true }
  } catch {
    // fail-open
    return { decision, applied: false }
  }
}

/**
 * Retrieves the most recently stored ThrottleDecision for a tenant.
 * Returns null if none exists or Redis is unavailable.
 */
export async function getActiveThrottle(tenantId: string): Promise<ThrottleDecision | null> {
  const raw = await redisGet(`throttle_context:${tenantId}`)
  if (raw === null) return null
  try {
    return JSON.parse(raw) as ThrottleDecision
  } catch {
    return null
  }
}

/**
 * Clears the active throttle for a tenant:
 *   1. Deletes the throttle_context:{tenantId} key from Redis.
 *   2. If no load-mode hold is active, restores the load mode to NORMAL.
 *
 * Fail-open: errors are logged but not re-thrown.
 */
export async function clearThrottle(tenantId: string): Promise<void> {
  try {
    await redisDel(`throttle_context:${tenantId}`)
    const held = await hasLoadModeHold(tenantId).catch(() => false)
    if (!held) {
      await setLoadMode(tenantId, 'NORMAL', 'auto:throttle_cleared')
    }
  } catch (err) {
    console.error('[throttleEngine] clearThrottle failed', tenantId, err)
  }
}

/**
 * Builds a ThrottleContext from an IncidentRow's metrics_snapshot.
 *
 * Baselines:
 *   latency_spike  = p95_latency_ms / 200  (baseline = 200 ms)
 *   error_rate     = metrics_snapshot.error_rate (0–1, default 0)
 *   cost_spike     = cost_per_hour / 1     (baseline = 1 EUR/h)
 *   queue_depth    = metrics_snapshot.queue_depth (default 0)
 */
export function buildThrottleContextFromIncident(incident: IncidentRow): ThrottleContext {
  const snap = incident.metrics_snapshot

  return {
    tenant_id:     incident.tenant_id,
    latency_spike: (snap.p95_latency_ms ?? 200) / 200,
    error_rate:    snap.error_rate    ?? 0,
    cost_spike:    (snap.cost_per_hour ?? 1) / 1,
    queue_depth:   snap.queue_depth   ?? 0,
  }
}
